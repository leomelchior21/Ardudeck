"""Owns the single live runtime instance."""

from __future__ import annotations

import logging
import threading
from typing import Any

from ..bus import EventBus
from ..errors import ApiError
from ..hardware import HardwareError, HardwareManager
from .engine import RuntimeEngine
from .ir import IrError, parse_program

log = logging.getLogger(__name__)


class RuntimeService:
    def __init__(self, bus: EventBus, manager: HardwareManager) -> None:
        self._bus = bus
        self._manager = manager
        self._lock = threading.RLock()
        self._engine: RuntimeEngine | None = None

    def start(self, program_data: dict[str, Any] | None, simulate: bool = False) -> dict[str, Any]:
        try:
            program = parse_program(program_data)
        except IrError as exc:
            raise ApiError(str(exc), code="invalid-flow", status_code=400) from exc

        with self._lock:
            if self._engine is not None:
                self._engine.stop()
                self._engine = None

            manager = self._manager
            if simulate:
                manager.use_mock()
            else:
                backend = manager.backend()
                if backend is None:
                    raise ApiError(
                        "Connect your Arduino to start.",
                        code="no-hardware",
                        status_code=409,
                        hint="Or try the flow in simulation.",
                    )
                state = backend.status().get("state")
                if state == "needs-bridge":
                    raise ApiError(
                        "Your Arduino needs to be prepared first.",
                        code="needs-bridge",
                        status_code=409,
                        hint="ArduDeck can install what it needs and try again.",
                    )
                if state != "ready":
                    raise ApiError(
                        "The Arduino is not ready yet.",
                        code="not-ready",
                        status_code=409,
                        hint="Check the USB cable and try again.",
                    )

            try:
                backend = manager.require()
            except HardwareError as exc:  # pragma: no cover - guarded above
                raise ApiError(str(exc), code="no-hardware", status_code=409) from exc

            engine = RuntimeEngine(backend, self._bus, program)
            engine.start()
            self._engine = engine
            log.info("runtime started in %s mode", "simulated" if backend.simulated else "hardware")
            return engine.status()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            engine = self._engine
            if engine is not None:
                engine.stop()
                self._engine = None
        status = self.status()
        status["running"] = False
        return status

    def status(self) -> dict[str, Any]:
        with self._lock:
            engine = self._engine
        if engine is None:
            return {
                "running": False,
                "title": None,
                "mode": None,
                "source": None,
                "tick": 0,
                "values": {},
                "rules": {},
                "outputs": {},
                "loopDelayMs": None,
            }
        return engine.status()

    def set_mock_value(self, pin: str, value: int) -> dict[str, Any]:
        backend = self._manager.backend()
        if backend is None:
            raise ApiError("Connect your Arduino to start.", code="no-hardware", status_code=409)
        if not backend.simulated:
            return {"ok": True, "applied": False, "reason": "hardware"}
        backend.set_mock_value(pin, value)
        return {"ok": True, "applied": True}
