"""Hardware backend interface.

A backend is the only thing that knows how to talk to a board. Two
implementations exist:

* ``MockBackend``   - simulates sensors and actuators on any computer.
* ``BridgeBackend`` - talks to a real Arduino running ArduDeck Bridge.

Everything above this layer (runtime engine, API, UI) is identical in both
cases, which is what keeps simulation honest: the same rules run, only the
values come from somewhere else.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

from ..bus import EventBus

log = logging.getLogger(__name__)

VALUE_FLUSH_INTERVAL = 0.1


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, int(value)))


class HardwareError(RuntimeError):
    """Raised with a student-friendly message."""


@dataclass(frozen=True)
class WatchSpec:
    pin: str
    kind: str  # "analog" | "digital"
    pullup: bool = False


class BackendBase:
    source = "unknown"
    board_name = "Arduino"

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        self._lock = threading.Lock()
        self._analog: dict[str, int] = {}
        self._digital: dict[str, int] = {}
        self._distance: dict[tuple[str, str], int] = {}
        self._outputs: dict[str, dict[str, Any]] = {}
        self._pending_values: dict[str, dict[str, Any]] = {}
        self._last_flush = 0.0
        self._status: dict[str, Any] = {
            "state": "starting",
            "source": self.source,
            "board": None,
            "port": None,
            "detail": None,
        }

    # ------------------------------------------------------------------ status

    def status(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._status)

    def _set_status(self, state: str, **fields: Any) -> None:
        with self._lock:
            self._status["state"] = state
            self._status.update(fields)
            snapshot = dict(self._status)
        self._bus.publish({"type": "hardware", **snapshot})

    @property
    def ready(self) -> bool:
        return self.status()["state"] == "ready"

    @property
    def simulated(self) -> bool:
        return self.source == "mock"

    # ---------------------------------------------------------------- readings

    def analog(self, pin: str) -> int | None:
        with self._lock:
            return self._analog.get(pin)

    def digital(self, pin: str) -> int | None:
        with self._lock:
            return self._digital.get(pin)

    def distance(self, trig_pin: str, echo_pin: str) -> int | None:
        with self._lock:
            return self._distance.get((trig_pin, echo_pin))

    def outputs(self) -> dict[str, dict[str, Any]]:
        with self._lock:
            return {pin: dict(value) for pin, value in self._outputs.items()}

    # Values are pushed from the reader thread and flushed to the UI at 10 Hz:
    # low enough that a Raspberry Pi 3 browser stays smooth, high enough that
    # a student sees the sensor react immediately.

    def _push_value(self, pin: str, kind: str, value: int) -> None:
        entry = {"pin": pin, "kind": kind, "value": value}
        with self._lock:
            if kind == "analog":
                self._analog[pin] = value
            elif kind == "digital":
                self._digital[pin] = value
            self._pending_values[pin] = entry
            now = time.monotonic()
            if now - self._last_flush < VALUE_FLUSH_INTERVAL:
                return
            self._last_flush = now
            pending = self._pending_values
            self._pending_values = {}
        self._bus.publish({"type": "values", "source": self.source, "values": pending})

    def _push_distance(self, trig_pin: str, echo_pin: str, value: int) -> None:
        with self._lock:
            self._distance[(trig_pin, echo_pin)] = value

    def _record_output(self, pin: str, kind: str, value: Any) -> None:
        with self._lock:
            self._outputs[pin] = {"pin": pin, "kind": kind, "value": value}

    def _clear_outputs(self) -> None:
        with self._lock:
            self._outputs = {}

    # -------------------------------------------------------------- lifecycle

    def start(self) -> None:
        raise NotImplementedError

    def stop(self) -> None:
        raise NotImplementedError

    # ---------------------------------------------------------------- commands

    def set_watches(self, watches: list[WatchSpec]) -> None:
        raise NotImplementedError

    def distance_cm(self, trig_pin: str, echo_pin: str) -> int | None:
        return None

    def write_digital(self, pin: str, value: int) -> None:
        self._record_output(pin, "digital", 1 if value else 0)

    def write_pwm(self, pin: str, value: int) -> None:
        self._record_output(pin, "pwm", int(value))

    def write_servo(self, pin: str, angle: int) -> None:
        self._record_output(pin, "servo", int(angle))

    def write_rgb(self, red_pin: str, green_pin: str, blue_pin: str, red: int, green: int, blue: int) -> None:
        """One colour on an RGB LED, sent as three PWM writes."""
        self.write_pwm(red_pin, _clamp(red, 0, 255))
        self.write_pwm(green_pin, _clamp(green, 0, 255))
        self.write_pwm(blue_pin, _clamp(blue, 0, 255))

    def write_motor(
        self,
        in1_pin: str,
        in2_pin: str,
        enable_pin: str,
        direction: str,
        speed: int,
    ) -> None:
        """L298N-style driver: two direction pins plus one PWM enable pin."""
        speed = _clamp(speed, 0, 255)
        if direction == "forward":
            self.write_digital(in1_pin, 1)
            self.write_digital(in2_pin, 0)
            self.write_pwm(enable_pin, speed)
        elif direction == "reverse":
            self.write_digital(in1_pin, 0)
            self.write_digital(in2_pin, 1)
            self.write_pwm(enable_pin, speed)
        elif direction == "brake":
            self.write_digital(in1_pin, 1)
            self.write_digital(in2_pin, 1)
            self.write_pwm(enable_pin, 255)
        else:
            self.write_digital(in1_pin, 0)
            self.write_digital(in2_pin, 0)
            self.write_pwm(enable_pin, 0)

    def tone(self, pin: str, frequency: int, duration_ms: int) -> None:
        self._record_output(pin, "tone", {"frequency": int(frequency), "durationMs": int(duration_ms)})

    def stop_tone(self, pin: str) -> None:
        self._record_output(pin, "tone", None)

    def all_safe(self) -> None:
        self._clear_outputs()

    def set_mock_value(self, pin: str, value: int) -> None:
        """Only meaningful in simulation; real hardware ignores it."""
