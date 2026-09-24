"""Live evaluation of a flow.

The engine runs in its own thread at roughly the sketch loop rate. It reads the
sensor cache the backend keeps up to date, evaluates every rule, and only sends
a command to the board when an output actually changes - so a real LED reacts
within tens of milliseconds and the serial link stays quiet.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from ..bus import EventBus
from ..hardware import BackendBase
from .ir import IrAction, IrCondition, IrProgram, IrRead, watches_for

log = logging.getLogger(__name__)

MIN_INTERVAL = 0.025
MAX_INTERVAL = 0.08
HEARTBEAT = 0.2
DISTANCE_EVERY_TICKS = 8


def evaluate(value: int | float | None, condition: IrCondition, read: IrRead | None) -> bool:
    if value is None:
        return False
    if read is not None and read.kind == "distance" and value < 0:
        return False
    if condition.op == "lt":
        return value < condition.value
    if condition.op == "gt":
        return value > condition.value
    if condition.op == "lte":
        return value <= condition.value
    if condition.op == "gte":
        return value >= condition.value
    if condition.op == "neq":
        return value != condition.value
    return value == condition.value


class RuntimeEngine:
    def __init__(self, backend: BackendBase, bus: EventBus, program: IrProgram) -> None:
        self._backend = backend
        self._bus = bus
        self._program = program
        self._reads_by_var = {read.var: read for read in program.reads}
        self._values: dict[str, dict[str, Any]] = {}
        self._truth: dict[str, bool] = {}
        self._outputs: dict[str, dict[str, Any]] = {}
        self._applied: dict[str, str] = {}
        self._tick = 0
        self._last_publish = 0.0
        self._thread: threading.Thread | None = None
        self._stopping = threading.Event()

    # -------------------------------------------------------------- lifecycle

    def start(self) -> None:
        self._backend.set_watches(watches_for(self._program))
        self._stopping.clear()
        self._thread = threading.Thread(target=self._run, name="runtime", daemon=True)
        self._thread.start()
        log.info(
            "runtime started: %r on %s (%s reads, %s rules)",
            self._program.title,
            self._backend.source,
            len(self._program.reads),
            len(self._program.rules),
        )

    def stop(self) -> None:
        self._stopping.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=1.5)
        self._thread = None
        try:
            self._backend.all_safe()
        except Exception:  # pragma: no cover - stopping must never raise
            log.debug("failed to make outputs safe", exc_info=True)
        self._outputs = {}
        self._applied = {}
        self._publish(running=False, force=True)

    @property
    def running(self) -> bool:
        thread = self._thread
        return thread is not None and thread.is_alive()

    # ------------------------------------------------------------------ state

    def status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "title": self._program.title,
            "mode": "simulated" if self._backend.simulated else "hardware",
            "source": self._backend.source,
            "tick": self._tick,
            "values": self._values,
            "rules": self._truth,
            "outputs": self._outputs,
            "loopDelayMs": self._program.loopDelayMs,
        }

    # ------------------------------------------------------------------- loop

    def _run(self) -> None:
        interval = max(MIN_INTERVAL, min(self._program.loopDelayMs / 1000.0, MAX_INTERVAL))
        deadline = time.monotonic()
        while not self._stopping.is_set():
            if not self._backend.ready:
                if self._stopping.wait(0.1):
                    break
                deadline = time.monotonic()
                continue
            changed = self._step()
            now = time.monotonic()
            if changed or now - self._last_publish >= HEARTBEAT:
                self._publish(running=True)
            deadline += interval
            remaining = deadline - time.monotonic()
            if remaining > 0:
                self._stopping.wait(remaining)
            else:
                deadline = time.monotonic()

    def _step(self) -> bool:
        self._tick += 1
        changed = False

        for read in self._program.reads:
            value = self._read_value(read)
            entry = self._values.get(read.id)
            if entry is None:
                entry = {"id": read.id, "name": read.name, "unit": self._unit(read), "ok": False}
                self._values[read.id] = entry
            if entry.get("value") != value:
                entry["value"] = value
                changed = True
            entry["ok"] = value is not None and not (read.kind == "distance" and value < 0)

        for rule in self._program.rules:
            read = self._reads_by_var.get(rule.var)
            entry = self._values.get(read.id) if read is not None else None
            raw = entry.get("value") if entry is not None else None
            truth = evaluate(raw, rule.condition, read)
            if self._truth.get(rule.id) != truth:
                self._truth[rule.id] = truth
                changed = True
            actions = rule.then if truth else rule.else_
            if self._apply(actions):
                changed = True

        return changed

    def _read_value(self, read: IrRead) -> int | None:
        if read.kind == "analog":
            return self._backend.analog(read.pin or "")
        if read.kind == "digital":
            return self._backend.digital(read.pin or "")
        if self._tick % DISTANCE_EVERY_TICKS == 0:
            measured = self._backend.distance_cm(read.trigPin or "", read.echoPin or "")
            if measured is not None:
                return measured
        return self._backend.distance(read.trigPin or "", read.echoPin or "")

    @staticmethod
    def _unit(read: IrRead) -> str:
        return "cm" if read.kind == "distance" else ""

    def _apply(self, actions: list[IrAction]) -> bool:
        changed = False
        # A branch that contains a wait is a sequence: it repeats while the
        # condition stays true, exactly like the generated sketch. Plain
        # outputs keep the quiet change-only behaviour.
        looping = any(action.op == "delay" for action in actions)
        for action in actions:
            key = f"{action.nodeId}:{action.op}"
            signature = json.dumps(
                action.model_dump(exclude={"nodeId", "name", "var"}),
                sort_keys=True,
            )
            if not looping and self._applied.get(key) == signature:
                continue
            self._applied[key] = signature
            self._dispatch(action)
            changed = True
        return changed

    def _dispatch(self, action: IrAction) -> None:
        backend = self._backend
        state = "?"
        if action.op == "digitalWrite":
            value = 1 if action.value else 0
            backend.write_digital(action.pin or "", value)
            state = "ON" if value else "OFF"
        elif action.op == "pwmWrite":
            value = int(action.value or 0)
            backend.write_pwm(action.pin or "", value)
            state = f"{value}"
        elif action.op == "servoWrite":
            angle = int(action.angle or 0)
            backend.write_servo(action.pin or "", angle)
            state = f"{angle} deg"
        elif action.op == "tone":
            frequency = int(action.frequency or 440)
            duration = int(action.durationMs or 200)
            backend.tone(action.pin or "", frequency, duration)
            state = f"{frequency} Hz"
        elif action.op == "stopTone":
            backend.stop_tone(action.pin or "")
            state = "silent"
        elif action.op == "rgbWrite":
            red = int(action.red or 0)
            green = int(action.green or 0)
            blue = int(action.blue or 0)
            backend.write_rgb(
                action.redPin or "",
                action.greenPin or "",
                action.bluePin or "",
                red,
                green,
                blue,
            )
            state = "OFF" if red == 0 and green == 0 and blue == 0 else f"RGB {red},{green},{blue}"
        elif action.op == "motorWrite":
            direction = action.direction or "stop"
            speed = int(action.speed or 0)
            backend.write_motor(
                action.pin or "",
                action.in2Pin or "",
                action.enablePin or "",
                direction,
                speed,
            )
            state = "OFF" if direction in {"stop", "brake"} else f"{direction.upper()} {speed}"
        elif action.op == "delay":
            wait_ms = max(0, min(int(action.ms or 0), 5000))
            state = f"{wait_ms} ms"
            if wait_ms:
                self._stopping.wait(wait_ms / 1000.0)

        self._outputs[action.nodeId] = {
            "nodeId": action.nodeId,
            "name": action.name,
            "pin": action.pin,
            "op": action.op,
            "state": state,
        }

    def _publish(self, running: bool, force: bool = False) -> None:
        now = time.monotonic()
        if not force and now - self._last_publish < HEARTBEAT and self._stopping.is_set():
            return
        self._last_publish = now
        payload = self.status()
        payload["running"] = running
        payload["type"] = "runtime"
        self._bus.publish(payload)
