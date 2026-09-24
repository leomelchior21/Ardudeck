"""Deploy pipeline: sketch -> compile -> upload, with classroom-friendly
progress reporting at every step.

The pipeline never blocks the API thread: a job runs in the background and
pushes progress events on the event bus, which the WebSocket hub forwards to
the screen that started it.
"""

from __future__ import annotations

import logging
import re
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..bus import EventBus
from ..config import Settings
from ..errors import ApiError
from ..hardware import HardwareManager
from ..runtime import RuntimeService
from .arduino_cli import ArduinoCli, CommandResult
from .messages import friendly_error

log = logging.getLogger(__name__)

SANITIZE_RE = re.compile(r"[^A-Za-z0-9_-]+")


def sanitize_sketch_name(name: str) -> str:
    cleaned = SANITIZE_RE.sub("_", name or "").strip("_-")[:40]
    if not cleaned:
        cleaned = "ArduDeckProject"
    if cleaned[0].isdigit():
        cleaned = f"P_{cleaned}"
    return cleaned


@dataclass
class Step:
    id: str
    label: str
    status: str = "pending"
    message: str | None = None
    hints: list[str] = field(default_factory=list)
    details: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"id": self.id, "label": self.label, "status": self.status}
        if self.message:
            payload["message"] = self.message
        if self.hints:
            payload["hints"] = list(self.hints)
        if self.details:
            payload["details"] = self.details
        return payload


class DeployCancelled(Exception):
    pass


class DeployService:
    def __init__(
        self,
        settings: Settings,
        bus: EventBus,
        manager: HardwareManager,
        runtime: RuntimeService,
        cli: ArduinoCli | None = None,
    ) -> None:
        self._settings = settings
        self._bus = bus
        self._manager = manager
        self._runtime = runtime
        self._lock = threading.RLock()
        self._job: dict[str, Any] | None = None
        self._thread: threading.Thread | None = None
        self._cancel = threading.Event()
        self._logs: deque[str] = deque(maxlen=600)
        self._cli = cli or ArduinoCli(
            executable=settings.arduino_cli,
            fqbn=settings.fqbn,
            on_log=self._append_log,
        )

    # ----------------------------------------------------------------- public

    def start_deploy(self, name: str, code: str) -> dict[str, Any]:
        self._guard_idle()
        if not isinstance(code, str) or "void setup" not in code or "void loop" not in code:
            raise ApiError(
                "There is a problem in the code.",
                code="invalid-code",
                status_code=400,
                hint="Open the code view and check the last change.",
            )
        port = self._hardware_port()
        job = self._new_job(
            "deploy",
            [
                Step("prepare", "Preparing project"),
                Step("check", "Checking hardware"),
                Step("compile", "Building the program"),
                Step("upload", "Sending to the Arduino"),
                Step("finish", "Ready"),
            ],
            name=name,
            port=port,
        )
        self._start_thread(job, lambda: self._run_deploy(job, name, code))
        return self.current() or job

    def start_bridge_install(self) -> dict[str, Any]:
        self._guard_idle()
        port = self._hardware_port()
        job = self._new_job(
            "bridge",
            [
                Step("prepare", "Preparing the bridge"),
                Step("check", "Checking hardware"),
                Step("bridge", "Installing on the Arduino"),
                Step("finish", "Ready"),
            ],
            name="ArduDeck Bridge",
            port=port,
        )
        self._start_thread(job, lambda: self._run_bridge_install(job))
        return self.current() or job

    def current(self) -> dict[str, Any] | None:
        with self._lock:
            if self._job is None:
                return None
            return self._serialize(self._job)

    def cancel(self) -> dict[str, Any]:
        with self._lock:
            job = self._job
        if job is not None and job["status"] == "running":
            self._cancel.set()
        return self.current() or {"status": "idle"}

    def logs(self, lines: int = 200) -> list[str]:
        return list(self._logs)[-lines:]

    def cli(self) -> ArduinoCli:
        return self._cli

    # -------------------------------------------------------------- internals

    def _append_log(self, line: str) -> None:
        self._logs.append(line)
        self._bus.publish({"type": "compile-log", "line": line})

    def _guard_idle(self) -> None:
        with self._lock:
            job = self._job
        if job is not None and job["status"] == "running":
            raise ApiError(
                "An upload is already running.",
                code="deploy-busy",
                status_code=409,
                hint="Wait for it to finish.",
            )

    def _new_job(
        self, kind: str, steps: list[Step], name: str, port: str | None = None
    ) -> dict[str, Any]:
        job: dict[str, Any] = {
            "id": uuid.uuid4().hex[:12],
            "kind": kind,
            "name": name,
            "port": port,
            "status": "running",
            "steps": steps,
            "startedAt": time.time(),
            "finishedAt": None,
            "error": None,
            "result": None,
        }
        with self._lock:
            self._job = job
        self._cancel.clear()
        self._publish()
        return job

    def _start_thread(self, job: dict[str, Any], target: Any) -> None:
        def runner() -> None:
            try:
                target()
            except DeployCancelled:
                job["status"] = "cancelled"
                job["finishedAt"] = time.time()
            except ApiError as exc:
                job["status"] = "error"
                job["error"] = {
                    "message": exc.message,
                    "hints": [exc.hint] if exc.hint else [],
                    "details": exc.details or "",
                }
                job["finishedAt"] = time.time()
            except Exception:  # pragma: no cover - defensive
                log.exception("deploy job crashed")
                job["status"] = "error"
                job["error"] = {
                    "message": "Something went wrong.",
                    "hints": ["Try again.", "If it keeps failing, open Teacher Mode for details."],
                    "details": "",
                }
                job["finishedAt"] = time.time()
            finally:
                self._cancel.clear()
                self._publish()

        self._thread = threading.Thread(target=runner, name=f"deploy-{job['id']}", daemon=True)
        self._thread.start()

    def _step(self, job: dict[str, Any], step_id: str) -> Step:
        for step in job["steps"]:
            if step.id == step_id:
                return step
        raise KeyError(step_id)

    def _set(
        self,
        job: dict[str, Any],
        step_id: str,
        status: str,
        message: str | None = None,
        hints: list[str] | None = None,
        details: str | None = None,
    ) -> None:
        step = self._step(job, step_id)
        step.status = status
        step.message = message
        step.hints = hints or []
        step.details = details
        self._publish()

    def _fail(
        self,
        job: dict[str, Any],
        step_id: str,
        result: CommandResult | None,
        stage: str,
        message: str | None = None,
        hints: list[str] | None = None,
        details: str | None = None,
    ) -> None:
        if result is not None and message is None:
            friendly = friendly_error(result.output, stage)
            message = friendly.message
            hints = friendly.hints
            details = friendly.details
        step = self._step(job, step_id)
        step.status = "error"
        step.message = message or "Something went wrong."
        step.hints = hints or []
        step.details = details
        job["status"] = "error"
        job["error"] = {"message": step.message, "hints": step.hints, "details": step.details}
        job["finishedAt"] = time.time()
        self._publish()

    def _check_cancelled(self) -> None:
        if self._cancel.is_set():
            raise DeployCancelled()

    def _serialize(self, job: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": job["id"],
            "kind": job["kind"],
            "name": job["name"],
            "status": job["status"],
            "steps": [step.to_dict() for step in job["steps"]],
            "startedAt": job["startedAt"],
            "finishedAt": job["finishedAt"],
            "error": job["error"],
            "result": job["result"],
        }

    def _publish(self) -> None:
        job = self.current()
        if job is not None:
            self._bus.publish({"type": "deploy", "job": job})

    def _write_sketch(self, job_id: str, name: str, code: str) -> Path:
        sketch_name = sanitize_sketch_name(name)
        sketch_dir = self._settings.work_dir / "deploy" / job_id / sketch_name
        sketch_dir.mkdir(parents=True, exist_ok=True)
        sketch_file = sketch_dir / f"{sketch_name}.ino"
        sketch_file.write_text(code, encoding="utf-8")
        return sketch_dir

    def _hardware_port(self) -> str:
        backend = self._manager.backend()
        if backend is None or backend.simulated:
            raise ApiError(
                "Connect your Arduino to start.",
                code="no-hardware",
                status_code=409,
                hint="Plug the Arduino in with the USB cable.",
            )
        port = backend.status().get("port")
        if not isinstance(port, str) or not port:
            raise ApiError(
                "The Arduino is not connected.",
                code="no-port",
                status_code=409,
                hint="Unplug the USB cable and plug it back in.",
            )
        return port

    # ------------------------------------------------------------- pipelines

    def _run_deploy(self, job: dict[str, Any], name: str, code: str) -> None:
        released = False
        port: str | None = job.get("port")
        try:
            self._set(job, "prepare", "running")
            sketch_dir = self._write_sketch(job["id"], name, code)
            self._set(job, "prepare", "ok", message="Project ready")

            self._runtime.stop()
            self._check_cancelled()

            self._set(job, "check", "running")
            if port is None:
                port = self._hardware_port()
            self._manager.release_for_upload()
            released = True
            self._set(job, "check", "ok", message="Arduino found")

            self._check_cancelled()
            self._set(job, "compile", "running")
            build_dir = sketch_dir.parent / "build"
            compile_result = self._cli.compile(sketch_dir, build_dir)
            if not compile_result.ok:
                self._fail(job, "compile", compile_result, "compile")
                self._restore(released, port, deployed=False)
                return
            self._set(job, "compile", "ok", message="Program built")

            self._check_cancelled()
            self._set(job, "upload", "running")
            upload_result = self._cli.upload(port, build_dir)
            if not upload_result.ok:
                self._fail(job, "upload", upload_result, "upload")
                self._restore(released, port, deployed=False)
                return
            self._set(job, "upload", "ok", message="Program sent")

            job["result"] = {"port": port, "board": self._manager.board_label()}
            self._set(job, "finish", "ok", message="READY")
            job["status"] = "ok"
            job["finishedAt"] = time.time()
            self._restore(released, port, deployed=True)
        except DeployCancelled:
            self._set(job, "prepare", "error", message="Upload cancelled")
            self._restore(released, port, deployed=False)
            raise
        finally:
            if job["finishedAt"] is None and job["status"] == "running":
                job["status"] = "error"
                job["finishedAt"] = time.time()
            self._publish()

    def _run_bridge_install(self, job: dict[str, Any]) -> None:
        released = False
        port: str | None = job.get("port")
        try:
            self._set(job, "prepare", "running")
            sketch_dir = self._settings.bridge_sketch
            if not (sketch_dir / "ardudeck-bridge.ino").exists():
                self._fail(
                    job,
                    "prepare",
                    None,
                    "check",
                    message="The ArduDeck Bridge program is missing.",
                    hints=["Reinstall ArduDeck or copy firmware/ardudeck-bridge."],
                )
                return
            if not self._cli.available():
                self._fail(
                    job,
                    "prepare",
                    None,
                    "check",
                    message="ArduDeck could not find the Arduino tools.",
                    hints=["Run scripts/setup-arduino-cli.sh on the Raspberry Pi.", "Then try again."],
                )
                return
            self._set(job, "prepare", "ok", message="Bridge ready")

            self._runtime.stop()
            self._check_cancelled()

            self._set(job, "check", "running")
            if port is None:
                port = self._hardware_port()
            if not self._cli.has_avr_core():
                self._fail(
                    job,
                    "check",
                    None,
                    "check",
                    message="The Arduino Uno support is not installed.",
                    hints=["Run scripts/setup-arduino-cli.sh - it installs everything needed."],
                )
                return
            self._manager.release_for_upload()
            released = True
            self._set(job, "check", "ok", message="Arduino found")

            self._check_cancelled()
            self._set(job, "bridge", "running")
            result = self._cli.compile_and_upload(sketch_dir, port)
            if not result.ok:
                self._fail(job, "bridge", result, "upload")
                self._restore(released, port, deployed=False)
                return
            self._set(job, "bridge", "ok", message="Bridge installed")

            job["result"] = {"port": port, "board": self._manager.board_label()}
            self._set(job, "finish", "ok", message="READY")
            job["status"] = "ok"
            job["finishedAt"] = time.time()
            self._restore(released, port, deployed=False)
        except DeployCancelled:
            self._set(job, "bridge", "error", message="Cancelled")
            self._restore(released, port, deployed=False)
            raise
        finally:
            if job["finishedAt"] is None and job["status"] == "running":
                job["status"] = "error"
                job["finishedAt"] = time.time()
            self._publish()

    def _restore(self, released: bool, port: str | None, deployed: bool) -> None:
        if released:
            self._manager.finish_upload(port, deployed=deployed)
