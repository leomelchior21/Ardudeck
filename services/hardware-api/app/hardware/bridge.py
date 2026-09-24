"""Backend for a real Arduino running ArduDeck Bridge.

One supervisor thread owns the port: it opens it, performs the bridge
handshake, streams the pins the app asked for, answers distance requests,
watches for silence, and reconnects on its own. Nothing above this layer has to
know that USB cables get unplugged.
"""

from __future__ import annotations

import logging
import threading
import time

import serial

from ..bus import EventBus
from . import protocol
from .backend import BackendBase, WatchSpec
from .protocol import BAUD_RATE, cmd_hello, parse_line

log = logging.getLogger(__name__)

HANDSHAKE_TIMEOUT = 4.0
PING_AFTER_SILENCE = 3.0
RECONNECT_AFTER_SILENCE = 8.0
MEASURE_TIMEOUT = 0.15


class BridgeBackend(BackendBase):
    source = "hardware"

    def __init__(
        self,
        bus: EventBus,
        port: str,
        baud: int = BAUD_RATE,
        echo_interval_ms: int = 25,
        reconnect_delay: float = 2.0,
    ) -> None:
        super().__init__(bus)
        self.port = port
        self.baud = baud
        self.echo_interval_ms = echo_interval_ms
        self.reconnect_delay = reconnect_delay
        self.board_name = "Arduino Uno"

        self._serial: serial.Serial | None = None
        self._watches: list[WatchSpec] = []
        self._watch_tokens: list[str] = []
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._write_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._measure_lock = threading.Lock()
        self._measure_event = threading.Event()
        self._measure_value: int | None = None
        self._last_rx = 0.0
        self._last_hello = 0.0
        self._handshake_started = 0.0
        self._bridge_version: str | None = None

        self._status["simulated"] = False

    # -------------------------------------------------------------- lifecycle

    def start(self) -> None:
        self._stopping.clear()
        self._set_status("connecting", port=self.port, board=self.board_name)
        self._thread = threading.Thread(target=self._supervise, name="bridge", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopping.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=2.0)
        self._thread = None
        self._close_serial()

    @property
    def firmware_version(self) -> str | None:
        return self._bridge_version

    # ------------------------------------------------------------------- watch

    def set_watches(self, watches: list[WatchSpec]) -> None:
        self._watches = list(watches)
        self._watch_tokens = [protocol.watch_token(w.pin, w.pullup) for w in watches]
        if self.ready:
            self._apply_watches()

    def _apply_watches(self) -> None:
        self._send_raw(protocol.cmd_set_watch(self._watch_tokens))
        self._send_raw(protocol.cmd_echo_interval(self.echo_interval_ms))

    # ---------------------------------------------------------------- commands

    def distance_cm(self, trig_pin: str, echo_pin: str) -> int | None:
        if not self.ready:
            return None
        with self._measure_lock:
            self._measure_event.clear()
            self._measure_value = None
            if not self._send_raw(protocol.cmd_measure(trig_pin, echo_pin)):
                return None
            got = self._measure_event.wait(MEASURE_TIMEOUT)
            value = self._measure_value if got else None
        if value is not None:
            self._push_distance(trig_pin, echo_pin, value)
        return value

    def write_digital(self, pin: str, value: int) -> None:
        if self._send_raw(protocol.cmd_digital_write(pin, value)):
            self._record_output(pin, "digital", 1 if value else 0)

    def write_pwm(self, pin: str, value: int) -> None:
        if self._send_raw(protocol.cmd_pwm_write(pin, value)):
            self._record_output(pin, "pwm", int(value))

    def write_servo(self, pin: str, angle: int) -> None:
        if self._send_raw(protocol.cmd_servo_write(pin, angle)):
            self._record_output(pin, "servo", int(angle))

    def tone(self, pin: str, frequency: int, duration_ms: int) -> None:
        if self._send_raw(protocol.cmd_tone(pin, frequency, duration_ms)):
            self._record_output(pin, "tone", {"frequency": int(frequency), "durationMs": int(duration_ms)})

    def stop_tone(self, pin: str) -> None:
        if self._send_raw(protocol.cmd_tone_stop(pin)):
            self._record_output(pin, "tone", None)

    def all_safe(self) -> None:
        self._send_raw(protocol.cmd_all_safe())
        self._clear_outputs()

    # -------------------------------------------------------------- supervisor

    def _supervise(self) -> None:
        while not self._stopping.is_set():
            if self._serial is None:
                self._open_serial()
                continue
            try:
                self._pump()
            except (serial.SerialException, OSError) as exc:
                self._drop(f"Arduino disconnected ({exc})")
            self._stopping.wait(0.01)

    def _open_serial(self) -> bool:
        self._set_status("connecting", port=self.port, board=self.board_name)
        try:
            handle = serial.Serial()
            handle.port = self.port
            handle.baudrate = self.baud
            handle.timeout = 0.05
            handle.write_timeout = 1.0
            handle.open()
        except (serial.SerialException, OSError, ValueError) as exc:
            self._set_status("disconnected", port=self.port, board=self.board_name, detail=str(exc))
            self._publish_serial("!!", f"{self.port}: {exc}")
            self._stopping.wait(self.reconnect_delay)
            return False

        self._serial = handle
        self._bridge_version = None
        now = time.monotonic()
        self._last_rx = now
        self._last_hello = now - 1.0
        self._handshake_started = now
        self._publish_serial("->", f"opened {self.port}")
        return True

    def _close_serial(self) -> None:
        handle = self._serial
        self._serial = None
        if handle is None:
            return
        try:
            handle.close()
        except Exception:  # pragma: no cover - closing must never raise
            log.debug("failed to close %s", self.port, exc_info=True)

    def _drop(self, reason: str) -> None:
        with self._state_lock:
            if self._serial is None:
                return
            self._close_serial()
        log.info("%s: %s", self.port, reason)
        self._publish_serial("!!", reason)
        self._set_status("disconnected", port=self.port, board=self.board_name, detail=reason)

    def _pump(self) -> None:
        handle = self._serial
        if handle is None:
            return

        raw = handle.readline()
        now = time.monotonic()
        if raw:
            text = raw.decode("ascii", errors="replace").strip()
            if text:
                self._last_rx = now
                self._handle_text(text)

        if not self.ready:
            if now - self._last_hello > 0.5:
                self._last_hello = now
                self._send_raw(cmd_hello())
            if now - self._handshake_started > HANDSHAKE_TIMEOUT and self.status()["state"] != "needs-bridge":
                self._set_status(
                    "needs-bridge",
                    port=self.port,
                    board=self.board_name,
                    detail="Arduino found, but ArduDeck Bridge is not installed.",
                )
            return

        if now - self._last_rx > PING_AFTER_SILENCE and now - self._last_hello > 1.5:
            self._last_hello = now
            self._send_raw(cmd_hello())
        if now - self._last_rx > RECONNECT_AFTER_SILENCE:
            self._drop("Arduino stopped responding")

    def _handle_text(self, text: str) -> None:
        message = parse_line(text)
        if message is None:
            return

        if message.kind in {"unknown", "error", "pong"}:
            self._publish_serial("<-", text)
            if message.kind == "error":
                log.info("bridge error: %s", message.text)
            return

        if message.kind == "boot":
            self._publish_serial("<-", text)
            if message.version:
                self._bridge_version = message.version
            if not self.ready:
                self._send_raw(cmd_hello())
            return

        if message.kind == "ok":
            self._publish_serial("<-", text)
            if message.version:
                self._bridge_version = message.version
            if not self.ready:
                self._set_status(
                    "ready",
                    port=self.port,
                    board=self.board_name,
                    detail=f"Bridge {self._bridge_version or '?'}",
                )
                self._apply_watches()
            return

        if message.kind in {"analog", "digital"}:
            if message.pin is not None and message.value is not None:
                self._push_value(message.pin, message.kind, message.value)
            return

        if message.kind == "value":
            if message.pin is not None and message.value is not None:
                kind = "analog" if protocol.is_analog_pin(message.pin) else "digital"
                self._push_value(message.pin, kind, message.value)
            return

        if message.kind == "distance":
            self._measure_value = message.value
            self._measure_event.set()

    def _send_raw(self, line: str) -> bool:
        handle = self._serial
        if handle is None:
            return False
        with self._write_lock:
            try:
                handle.write(line.encode("ascii", errors="ignore"))
                handle.flush()
            except (serial.SerialException, OSError) as exc:
                self._drop(f"Arduino disconnected ({exc})")
                return False
        self._publish_serial("->", line.strip())
        return True

    def _publish_serial(self, direction: str, text: str) -> None:
        self._bus.publish(
            {"type": "serial", "direction": direction, "text": text, "port": self.port}
        )
