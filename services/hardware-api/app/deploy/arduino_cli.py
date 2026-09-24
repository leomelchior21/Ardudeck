"""Thin, well-behaved wrapper around the arduino-cli executable.

Nothing here knows about ArduDeck flows; it only compiles and uploads sketches
and reports what happened, including the raw log lines for Teacher Mode.
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger(__name__)

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


@dataclass
class CommandResult:
    ok: bool
    returncode: int
    output: str
    timed_out: bool = False
    lines: list[str] = field(default_factory=list)


class ArduinoCli:
    def __init__(
        self,
        executable: str = "arduino-cli",
        fqbn: str = "arduino:avr:uno",
        on_log: Callable[[str], None] | None = None,
    ) -> None:
        self.executable = executable
        self.fqbn = fqbn
        self._on_log = on_log
        self._version: str | None = None
        self._version_checked = False
        self._cache: dict[str, tuple[float, Any]] = {}

    def _cached(self, key: str, ttl: float, factory: Callable[[], Any]) -> Any:
        now = time.monotonic()
        cached = self._cache.get(key)
        if cached is not None and now - cached[0] < ttl:
            return cached[1]
        value = factory()
        self._cache[key] = (now, value)
        return value

    # ---------------------------------------------------------------- helpers

    def _run(self, args: list[str], timeout: float = 300.0) -> CommandResult:
        command = [self.executable, *args]
        lines: list[str] = []

        def sink(line: str) -> None:
            clean = line.rstrip("\r\n")
            lines.append(clean)
            handler = self._on_log
            if handler is not None:
                try:
                    handler(clean)
                except Exception:  # pragma: no cover - logging must never break
                    log.debug("log handler failed", exc_info=True)

        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=CREATE_NO_WINDOW,
            )
        except FileNotFoundError:
            return CommandResult(
                ok=False,
                returncode=127,
                output="arduino-cli not found",
                lines=["arduino-cli not found"],
            )

        def pump() -> None:
            stream = process.stdout
            if stream is None:  # pragma: no cover - cannot happen with PIPE
                return
            for line in stream:
                sink(line)

        reader = threading.Thread(target=pump, name="arduino-cli-log", daemon=True)
        reader.start()

        timed_out = False
        try:
            returncode = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            process.kill()
            returncode = process.wait()
        reader.join(timeout=2.0)

        output = "\n".join(lines)
        return CommandResult(
            ok=returncode == 0 and not timed_out,
            returncode=returncode,
            output=output,
            timed_out=timed_out,
            lines=lines,
        )

    # ------------------------------------------------------------ information

    def available(self) -> bool:
        return self.version() is not None

    def version(self) -> str | None:
        if self._version_checked:
            return self._version
        self._version_checked = True
        result = self._run(["version"], timeout=20.0)
        if result.ok:
            first = result.lines[0] if result.lines else None
            self._version = first
        else:
            self._version = None
        return self._version

    def cores(self) -> list[str]:
        return self._cached("cores", 60.0, self._cores_uncached)

    def _cores_uncached(self) -> list[str]:
        result = self._run(["core", "list", "--format", "json"], timeout=60.0)
        if not result.ok:
            return []
        try:
            payload = json.loads(result.output)
        except json.JSONDecodeError:
            return []
        entries: list[Any]
        if isinstance(payload, list):
            entries = payload
        elif isinstance(payload, dict) and isinstance(payload.get("platforms"), list):
            entries = payload["platforms"]
        else:
            return []
        names: list[str] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            metadata = entry.get("metadata") or {}
            identifier = entry.get("id") or metadata.get("id")
            if isinstance(identifier, str):
                names.append(identifier)
        return names

    def has_avr_core(self) -> bool:
        return "arduino:avr" in self.cores()

    def board_list(self) -> list[dict]:
        return self._cached("board_list", 10.0, self._board_list_uncached)

    def _board_list_uncached(self) -> list[dict]:
        result = self._run(["board", "list", "--format", "json"], timeout=60.0)
        if not result.ok:
            return []
        payload: Any = None
        try:
            payload = json.loads(result.output)
        except json.JSONDecodeError:
            start = result.output.find("[")
            if start >= 0:
                try:
                    payload = json.loads(result.output[start:])
                except json.JSONDecodeError:
                    return []
        if isinstance(payload, dict) and isinstance(payload.get("detected_ports"), list):
            return [entry for entry in payload["detected_ports"] if isinstance(entry, dict)]
        if isinstance(payload, list):
            return [entry for entry in payload if isinstance(entry, dict)]
        return []

    # ---------------------------------------------------------------- actions

    def compile(self, sketch_dir: Path, build_dir: Path, timeout: float = 300.0) -> CommandResult:
        return self._run(
            [
                "compile",
                "--fqbn",
                self.fqbn,
                "--output-dir",
                str(build_dir),
                str(sketch_dir),
            ],
            timeout=timeout,
        )

    def upload(self, port: str, build_dir: Path, timeout: float = 180.0) -> CommandResult:
        return self._run(
            [
                "upload",
                "-p",
                port,
                "--fqbn",
                self.fqbn,
                "--input-dir",
                str(build_dir),
            ],
            timeout=timeout,
        )

    def compile_and_upload(
        self, sketch_dir: Path, port: str, timeout: float = 300.0
    ) -> CommandResult:
        return self._run(
            [
                "compile",
                "--upload",
                "-p",
                port,
                "--fqbn",
                self.fqbn,
                str(sketch_dir),
            ],
            timeout=timeout,
        )
