"""Simulated Arduino used when no board is connected.

The mock produces believable sensor values (slow drift plus a little noise) so
students can see a "sensor" move, and it records every output command so the UI
and the tests can verify what the flow did. It is clearly labelled as
SIMULATED everywhere it surfaces.
"""

from __future__ import annotations

import math
import random
import threading
import time

from ..bus import EventBus
from .backend import BackendBase, WatchSpec
from .protocol import ANALOG_PINS, DIGITAL_PINS, is_analog_pin, is_digital_pin

TICK_SECONDS = 0.05
DEFAULT_ANALOG_BASE = 550.0
DRIFT = 14.0
NOISE = 3.0
DEFAULT_DISTANCE_CM = 45.0


class MockBackend(BackendBase):
    source = "mock"
    board_name = "Simulated Arduino"

    def __init__(self, bus: EventBus, seed: int | None = None) -> None:
        super().__init__(bus)
        self._watches: dict[str, WatchSpec] = {}
        self._bases: dict[str, float] = {}
        self._phases: dict[str, float] = {}
        self._digital_values: dict[str, int] = {}
        self._distance_bases: dict[tuple[str, str], float] = {}
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()
        self._random = random.Random(seed)

    # -------------------------------------------------------------- lifecycle

    def start(self) -> None:
        self._set_status(
            "ready",
            board=self.board_name,
            port=None,
            detail="Simulation mode - values are generated, not measured.",
        )
        self._stopping.clear()
        self._thread = threading.Thread(target=self._loop, name="mock-hardware", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopping.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=1.0)
        self._thread = None

    # ----------------------------------------------------------------- values

    def set_watches(self, watches: list[WatchSpec]) -> None:
        self._watches = {watch.pin: watch for watch in watches}

    def set_mock_value(self, pin: str, value: int) -> None:
        pin = pin.upper()
        if is_analog_pin(pin):
            base = max(0.0, min(1023.0, float(value)))
            self._bases[pin] = base
            self._push_value(pin, "analog", int(base))
            return
        if is_digital_pin(pin):
            self._digital_values[pin] = 1 if value else 0
            self._push_value(pin, "digital", 1 if value else 0)
            for key in list(self._distance_bases):
                if key[0] == pin:
                    self._distance_bases[key] = float(max(0, min(200, value)))

    def distance_cm(self, trig_pin: str, echo_pin: str) -> int | None:
        key = (trig_pin, echo_pin)
        base = self._distance_bases.setdefault(key, DEFAULT_DISTANCE_CM)
        value = int(max(0, min(400, base + self._random.uniform(-2.0, 2.0))))
        self._push_distance(trig_pin, echo_pin, value)
        return value

    # ------------------------------------------------------------------ loop

    def _loop(self) -> None:
        while not self._stopping.is_set():
            for watch in list(self._watches.values()):
                if watch.kind == "analog":
                    self._push_value(watch.pin, "analog", self._analog_value(watch.pin))
                elif watch.kind == "digital":
                    self._push_value(
                        watch.pin, "digital", self._digital_values.get(watch.pin, 0)
                    )
            self._stopping.wait(TICK_SECONDS)

    def _analog_value(self, pin: str) -> int:
        base = self._bases.setdefault(pin, DEFAULT_ANALOG_BASE)
        phase = self._phases.setdefault(pin, self._random.uniform(0, math.tau)) + 0.04
        self._phases[pin] = phase
        value = base + DRIFT * math.sin(phase) + self._random.uniform(-NOISE, NOISE)
        return int(max(0.0, min(1023.0, value)))
