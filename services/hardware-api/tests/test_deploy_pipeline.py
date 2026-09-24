from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import pytest

from app.bus import EventBus
from app.config import Settings
from app.deploy import ArduinoCli, DeployService
from app.deploy.arduino_cli import CommandResult
from app.deploy.pipeline import DeployCancelled, sanitize_sketch_name
from app.errors import ApiError
from app.hardware import BackendBase

UPLOAD_FAILURE = """
avrdude: stk500_recv(): programmer is not responding
Failed uploading: uploading error: exit status 1
"""


class FakeHardware(BackendBase):
    source = "hardware"

    def __init__(self, bus: EventBus, port: str = "COM_TEST") -> None:
        super().__init__(bus)
        self.port = port
        self._status.update(
            {"state": "ready", "source": "hardware", "port": port, "board": "Arduino Uno"}
        )

    def start(self) -> None:  # pragma: no cover - nothing to start
        pass

    def stop(self) -> None:  # pragma: no cover - nothing to stop
        pass

    def set_watches(self, watches: list[Any]) -> None:  # pragma: no cover
        pass


class FakeManager:
    def __init__(self, backend: BackendBase) -> None:
        self._backend = backend
        self.released = 0
        self.finished: list[tuple[str | None, bool]] = []

    def backend(self) -> BackendBase:
        return self._backend

    def release_for_upload(self) -> dict[str, Any]:
        self.released += 1
        return {"state": "uploading"}

    def finish_upload(self, port: str | None, deployed: bool) -> dict[str, Any]:
        self.finished.append((port, deployed))
        return {"state": "deployed" if deployed else "ready"}

    def board_label(self) -> str:
        return "Arduino Uno"


class FakeRuntime:
    def __init__(self) -> None:
        self.stops = 0

    def stop(self) -> dict[str, Any]:
        self.stops += 1
        return {"running": False}


class FakeCli(ArduinoCli):
    def __init__(
        self,
        compile_ok: bool = True,
        upload_ok: bool = True,
        upload_output: str = "",
        delay: float = 0.0,
        avr_core: bool = True,
        available: bool = True,
    ) -> None:
        super().__init__(executable="fake")
        self.compile_ok = compile_ok
        self.upload_ok = upload_ok
        self.upload_output = upload_output
        self.delay = delay
        self.avr_core = avr_core
        self.available_flag = available
        self.calls: list[str] = []

    def available(self) -> bool:
        return self.available_flag

    def version(self) -> str | None:
        return "arduino-cli fake" if self.available_flag else None

    def has_avr_core(self) -> bool:
        return self.avr_core

    def compile(self, sketch_dir: Path, build_dir: Path, timeout: float = 300.0) -> CommandResult:
        time.sleep(self.delay)
        self.calls.append("compile")
        build_dir.mkdir(parents=True, exist_ok=True)
        return CommandResult(ok=self.compile_ok, returncode=0 if self.compile_ok else 1, output="" if self.compile_ok else "compilation error: expected ';'")

    def upload(self, port: str, build_dir: Path, timeout: float = 180.0) -> CommandResult:
        self.calls.append(f"upload:{port}")
        return CommandResult(
            ok=self.upload_ok,
            returncode=0 if self.upload_ok else 1,
            output="" if self.upload_ok else self.upload_output,
        )

    def compile_and_upload(self, sketch_dir: Path, port: str, timeout: float = 300.0) -> CommandResult:
        self.calls.append(f"bridge:{port}")
        return CommandResult(ok=True, returncode=0, output="")


def make_service(
    settings: Settings,
    bus: EventBus,
    cli: FakeCli,
) -> tuple[DeployService, FakeManager, FakeRuntime]:
    backend = FakeHardware(bus)
    manager = FakeManager(backend)
    runtime = FakeRuntime()
    service = DeployService(settings, bus, manager, runtime, cli)  # type: ignore[arg-type]
    return service, manager, runtime


def test_sanitize_sketch_name() -> None:
    assert sanitize_sketch_name("Light controls LED") == "Light_controls_LED"
    assert sanitize_sketch_name("9 lives") == "P_9_lives"
    assert sanitize_sketch_name("!!!") == "ArduDeckProject"
    assert sanitize_sketch_name("a" * 80).__len__() == 40


def test_successful_deploy(
    settings: Settings, bus: EventBus, wait, golden_sketch: str
) -> None:
    cli = FakeCli()
    service, manager, runtime = make_service(settings, bus, cli)

    service.start_deploy("Light project", golden_sketch)
    assert wait(lambda: (service.current() or {}).get("status") != "running")

    job = service.current()
    assert job is not None
    assert job["status"] == "ok"
    assert [step["status"] for step in job["steps"]] == ["ok", "ok", "ok", "ok", "ok"]
    assert manager.released == 1
    assert manager.finished == [("COM_TEST", True)]
    assert runtime.stops == 1
    assert cli.calls == ["compile", "upload:COM_TEST"]

    sketches = list(settings.work_dir.rglob("*.ino"))
    assert sketches and "void loop()" in sketches[0].read_text(encoding="utf-8")


def test_upload_failure_is_explained(
    settings: Settings, bus: EventBus, wait, golden_sketch: str
) -> None:
    cli = FakeCli(upload_ok=False, upload_output=UPLOAD_FAILURE)
    service, manager, _ = make_service(settings, bus, cli)

    service.start_deploy("Light project", golden_sketch)
    assert wait(lambda: (service.current() or {}).get("status") != "running")

    job = service.current()
    assert job is not None
    assert job["status"] == "error"
    assert job["error"]["message"] == "We can't talk to your Arduino."
    assert job["error"]["hints"]
    assert "stk500_recv" in job["error"]["details"]
    assert manager.finished == [("COM_TEST", False)]


def test_compile_failure_is_explained(
    settings: Settings, bus: EventBus, wait, golden_sketch: str
) -> None:
    cli = FakeCli(compile_ok=False)
    service, manager, _ = make_service(settings, bus, cli)

    service.start_deploy("Light project", golden_sketch)
    assert wait(lambda: (service.current() or {}).get("status") != "running")

    job = service.current()
    assert job is not None
    assert job["status"] == "error"
    assert "problem in the code" in job["error"]["message"]
    assert manager.released == 1


def test_second_upload_is_refused_while_busy(
    settings: Settings, bus: EventBus, golden_sketch: str
) -> None:
    cli = FakeCli(delay=0.4)
    service, _, _ = make_service(settings, bus, cli)
    service.start_deploy("Light project", golden_sketch)
    with pytest.raises(ApiError) as error:
        service.start_deploy("Light project", golden_sketch)
    assert error.value.code == "deploy-busy"


def test_rejects_code_that_is_not_a_sketch(
    settings: Settings, bus: EventBus
) -> None:
    cli = FakeCli()
    service, _, _ = make_service(settings, bus, cli)
    with pytest.raises(ApiError) as error:
        service.start_deploy("Broken", "int main() { return 0; }")
    assert error.value.code == "invalid-code"


def test_cancel_is_reported(
    settings: Settings, bus: EventBus, wait, golden_sketch: str
) -> None:
    cli = FakeCli(delay=0.5)
    service, _, _ = make_service(settings, bus, cli)
    service.start_deploy("Light project", golden_sketch)
    service.cancel()
    assert wait(lambda: (service.current() or {}).get("status") != "running")
    job = service.current()
    assert job is not None
    assert job["status"] == "cancelled"


def test_bridge_install_requires_the_sketch(
    settings: Settings, bus: EventBus, wait
) -> None:
    cli = FakeCli()
    service, _, _ = make_service(settings, bus, cli)
    service.start_bridge_install()
    assert wait(lambda: (service.current() or {}).get("status") != "running")
    job = service.current()
    assert job is not None
    assert job["status"] == "error"
    assert "missing" in job["error"]["message"].lower()


def test_bridge_install_success(settings: Settings, bus: EventBus, wait) -> None:
    bridge_dir = settings.bridge_sketch
    bridge_dir.mkdir(parents=True, exist_ok=True)
    (bridge_dir / "ardudeck-bridge.ino").write_text(
        "void setup() {}\nvoid loop() {}\n", encoding="utf-8"
    )
    cli = FakeCli()
    service, manager, _ = make_service(settings, bus, cli)
    service.start_bridge_install()
    assert wait(lambda: (service.current() or {}).get("status") != "running")
    job = service.current()
    assert job is not None
    assert job["status"] == "ok"
    assert manager.finished == [("COM_TEST", False)]
    assert cli.calls == ["bridge:COM_TEST"]


def test_cancel_without_a_job_is_harmless(
    settings: Settings, bus: EventBus
) -> None:
    cli = FakeCli()
    service, manager, _ = make_service(settings, bus, cli)
    result = service.cancel()
    assert result["status"] == "idle"
    assert service.current() is None
    assert manager.released == 0
