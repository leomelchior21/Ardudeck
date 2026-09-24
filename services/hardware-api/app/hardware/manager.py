"""Decides which backend is in charge, keeps an eye on the USB ports, and
switches to a real Arduino as soon as one appears.

The UI only ever reads `status()`, which is always student-safe (states are
"ready" / "connecting" / "needs-bridge" / "no-arduino" / "disconnected").
"""

from __future__ import annotations

import logging
import threading
import time

from ..bus import EventBus
from ..config import MOCK_AUTO, MOCK_OFF, MOCK_ON, Settings
from .backend import BackendBase, HardwareError, WatchSpec
from .bridge import BridgeBackend
from .discovery import DeviceInfo, list_devices, pick_device
from .mock import MockBackend

log = logging.getLogger(__name__)

SCAN_INTERVAL = 2.5
RETRY_INTERVAL = 8.0

NO_HARDWARE_STATUS = {
    "state": "no-arduino",
    "source": "none",
    "board": None,
    "port": None,
    "detail": "Connect your Arduino to start.",
}


class HardwareManager:
    def __init__(self, settings: Settings, bus: EventBus, cli: object | None = None) -> None:
        self._settings = settings
        self._bus = bus
        self._cli = cli
        self._lock = threading.RLock()
        self._backend: BackendBase | None = None
        self._devices: list[DeviceInfo] = []
        self._mode = settings.mock_mode
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._paused = False
        self._last_retry = 0.0

    # -------------------------------------------------------------- lifecycle

    def start(self) -> None:
        self._devices = self._scan()
        with self._lock:
            device = pick_device(self._devices)
            if self._mode == MOCK_ON:
                self._switch(self._make_mock())
            elif device is not None:
                self._switch(self._make_bridge(device.port))
            elif self._mode == MOCK_AUTO:
                self._switch(self._make_mock())
            else:
                self._publish_no_hardware()
        self._stopping.clear()
        self._thread = threading.Thread(target=self._watch_ports, name="hardware-scan", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopping.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=2.0)
        self._thread = None
        with self._lock:
            backend = self._backend
            self._backend = None
        if backend is not None:
            backend.stop()

    # ----------------------------------------------------------------- queries

    def backend(self) -> BackendBase | None:
        with self._lock:
            return self._backend

    def require(self) -> BackendBase:
        backend = self.backend()
        if backend is None:
            raise HardwareError("Connect your Arduino to start.")
        return backend

    def devices(self) -> list[DeviceInfo]:
        with self._lock:
            return list(self._devices)

    def status(self) -> dict[str, object]:
        backend = self.backend()
        hardware = backend.status() if backend is not None else dict(NO_HARDWARE_STATUS)
        return {
            "hardware": hardware,
            "simulated": bool(backend is not None and backend.simulated),
            "mockMode": self._mode,
            "devices": [device.to_dict() for device in self.devices()],
        }

    def set_watches(self, watches: list[WatchSpec]) -> None:
        backend = self.backend()
        if backend is not None:
            backend.set_watches(watches)

    # ----------------------------------------------------------------- control

    def set_mode(self, mode: str, port: str | None = None) -> dict[str, object]:
        if mode not in {MOCK_AUTO, MOCK_ON, MOCK_OFF}:
            raise HardwareError("Unknown hardware mode.")
        self._mode = mode
        self.rescan()
        with self._lock:
            backend = self._backend
        if mode == MOCK_ON:
            if backend is None or not backend.simulated:
                self.use_mock()
        elif mode == MOCK_OFF:
            if backend is not None and backend.simulated:
                device = pick_device(self.devices(), port)
                if device is not None:
                    self.use_hardware(device.port)
                else:
                    with self._lock:
                        if self._backend is not None:
                            self._backend.stop()
                        self._backend = None
                    self._publish_no_hardware()
        else:
            self.use_auto(port)
        return self.status()

    def use_auto(self, port: str | None = None) -> dict[str, object]:
        device = pick_device(self.devices(), port)
        with self._lock:
            backend = self._backend
        if device is None:
            if self._mode == MOCK_AUTO and (backend is None or not backend.simulated):
                return self.use_mock()
            if backend is None:
                self._publish_no_hardware()
            return self.status()
        if backend is not None and backend.source == "hardware":
            status = backend.status()
            if status.get("port") == device.port:
                return self.status()
        return self.use_hardware(device.port)

    def use_mock(self) -> dict[str, object]:
        with self._lock:
            backend = self._backend
            if backend is not None and backend.simulated:
                return self.status()
            self._switch(self._make_mock())
        return self.status()

    def use_hardware(self, port: str | None = None) -> dict[str, object]:
        device = pick_device(self.devices(), port)
        if device is None:
            raise HardwareError("Connect your Arduino to start.")
        with self._lock:
            backend = self._backend
            if backend is not None and backend.source == "hardware":
                status = backend.status()
                if status.get("port") == device.port and status.get("state") in {
                    "ready",
                    "connecting",
                    "needs-bridge",
                }:
                    return self.status()
            self._switch(self._make_bridge(device.port))
        return self.status()

    def reconnect(self) -> dict[str, object]:
        with self._lock:
            backend = self._backend
            if backend is None:
                return self.set_mode(self._mode)
            port = backend.status().get("port")
            if backend.source == "hardware" and isinstance(port, str):
                self._switch(self._make_bridge(port))
        return self.status()

    def all_safe(self) -> None:
        backend = self.backend()
        if backend is not None:
            backend.all_safe()

    def release_for_upload(self) -> dict[str, object]:
        """Let go of the serial port so arduino-cli can use it for the upload."""
        with self._lock:
            self._paused = True
            backend = self._backend
            port: object = None
            if backend is not None:
                port = backend.status().get("port")
                try:
                    backend.stop()
                except Exception:  # pragma: no cover - stopping must never raise
                    log.debug("failed to stop backend for upload", exc_info=True)
                self._backend = None
        status = {
            "state": "uploading",
            "source": "hardware",
            "board": None,
            "port": port,
            "detail": "Sending your program to the Arduino.",
        }
        self._bus.publish({"type": "hardware", **status})
        return status

    def finish_upload(self, port: str | None, deployed: bool) -> dict[str, object]:
        with self._lock:
            self._paused = False
        if deployed:
            status = {
                "state": "deployed",
                "source": "hardware",
                "board": self.board_label(),
                "port": port,
                "detail": "Your program is running on the Arduino.",
            }
            self._bus.publish({"type": "hardware", **status})
            return status
        try:
            return self.use_hardware(port)
        except HardwareError:
            return self.set_mode(self._mode)

    def board_label(self) -> str:
        for device in self.devices():
            if device.is_uno:
                return device.label
        return "Arduino Uno"

    # --------------------------------------------------------------- internals

    def _scan(self) -> list[DeviceInfo]:
        board_list: list[dict] | None = None
        cli = self._cli
        if cli is not None and hasattr(cli, "board_list"):
            try:
                board_list = cli.board_list()  # type: ignore[attr-defined]
            except Exception:  # pragma: no cover - discovery must never fail
                log.debug("arduino-cli board list failed", exc_info=True)
        return list_devices(board_list)

    def rescan(self) -> list[DeviceInfo]:
        devices = self._scan()
        with self._lock:
            self._devices = devices
        return devices

    def _make_mock(self) -> MockBackend:
        return MockBackend(self._bus)

    def _make_bridge(self, port: str) -> BridgeBackend:
        return BridgeBackend(
            self._bus,
            port=port,
            baud=self._settings.baud_rate,
            echo_interval_ms=self._settings.echo_interval_ms,
        )

    def _switch(self, backend: BackendBase) -> None:
        old = self._backend
        self._backend = backend
        if old is not None:
            try:
                old.stop()
            except Exception:  # pragma: no cover - stopping must never raise
                log.debug("failed to stop previous backend", exc_info=True)
        backend.start()

    def _publish_no_hardware(self) -> None:
        self._bus.publish({"type": "hardware", **NO_HARDWARE_STATUS})

    def _watch_ports(self) -> None:
        while not self._stopping.wait(SCAN_INTERVAL):
            try:
                self._tick()
            except Exception:  # pragma: no cover - the watchdog must never die
                log.exception("hardware watchdog error")

    def _tick(self) -> None:
        devices = self._scan()
        with self._lock:
            self._devices = devices
            paused = self._paused
        if paused or self._mode == MOCK_ON:
            return

        backend = self.backend()
        device = pick_device(devices)

        if backend is None:
            if device is not None:
                self.use_hardware(device.port)
            return

        if backend.simulated:
            if device is not None:
                log.info("Arduino detected on %s, switching from simulation", device.port)
                self.use_hardware(device.port)
            return

        status = backend.status()
        state = status.get("state")
        port = status.get("port")
        port_present = isinstance(port, str) and any(
            candidate.port == port for candidate in devices
        )

        if state == "disconnected" and port_present:
            # Another program may have been holding the port (a serial monitor,
            # or a second copy of the app). Keep trying quietly so a board that
            # becomes available is picked up without any user action.
            now = time.monotonic()
            if now - self._last_retry >= RETRY_INTERVAL:
                self._last_retry = now
                log.info("retrying the Arduino on %s", port)
                self.use_hardware(port)
            return

        if state in {"disconnected", "no-arduino"} and not port_present:
            if device is not None:
                self.use_hardware(device.port)
            elif self._mode == MOCK_AUTO:
                self.use_mock()
            else:
                with self._lock:
                    if self._backend is backend:
                        self._backend = None
                        backend.stop()
                self._publish_no_hardware()
