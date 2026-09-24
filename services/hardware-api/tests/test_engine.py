from __future__ import annotations

import json
from typing import Any

from app.bus import EventBus
from app.hardware import MockBackend, WatchSpec
from app.runtime import RuntimeEngine, evaluate, parse_program
from app.runtime.ir import IrCondition
from app.runtime.ir import IrRead

LIGHT_LED = "sensor_light"


def make_engine(bus: EventBus, program_data: dict[str, Any]) -> tuple[MockBackend, RuntimeEngine]:
    backend = MockBackend(bus, seed=7)
    backend.start()
    program = parse_program(program_data)
    engine = RuntimeEngine(backend, bus, program)
    engine.start()
    return backend, engine


def test_led_follows_the_threshold(bus: EventBus, golden_program: dict[str, Any], wait) -> None:
    backend, engine = make_engine(bus, golden_program)
    try:
        backend.set_mock_value("A0", 800)
        assert wait(lambda: backend.outputs().get("D9", {}).get("value") == 0)
        assert engine.status()["rules"]["cond_less"] is False

        backend.set_mock_value("A0", 100)
        assert wait(lambda: backend.outputs().get("D9", {}).get("value") == 1)
        status = engine.status()
        assert status["rules"]["cond_less"] is True
        # The simulation intentionally keeps a little noise and drift, like a real sensor.
        assert abs(status["values"][LIGHT_LED]["value"] - 100) <= 25
        assert status["outputs"]["act_led"]["state"] == "ON"
    finally:
        engine.stop()
        backend.stop()


def test_stop_makes_outputs_safe(bus: EventBus, golden_program: dict[str, Any], wait) -> None:
    backend, engine = make_engine(bus, golden_program)
    try:
        backend.set_mock_value("A0", 10)
        assert wait(lambda: backend.outputs().get("D9", {}).get("value") == 1)
        engine.stop()
        assert backend.outputs() == {}
    finally:
        backend.stop()


def test_publishes_runtime_telemetry(bus: EventBus, golden_program: dict[str, Any], wait) -> None:
    events: list[dict] = []
    bus.subscribe(events.append)
    backend, engine = make_engine(bus, golden_program)
    try:
        backend.set_mock_value("A0", 0)
        assert wait(lambda: any(event.get("type") == "runtime" for event in events))
        telemetry = [event for event in events if event.get("type") == "runtime"]
        payload = json.loads(json.dumps(telemetry[-1]))
        assert "values" in payload and "rules" in payload
    finally:
        engine.stop()
        backend.stop()


RGB_MOTOR_PROGRAM: dict[str, Any] = {
    "version": 1,
    "title": "RGB and motor",
    "reads": [{"id": "s", "var": "light", "kind": "analog", "pin": "A0"}],
    "rules": [
        {
            "id": "c_rgb",
            "var": "light",
            "condition": {"op": "lt", "value": 300},
            "then": [
                {
                    "nodeId": "rgb",
                    "name": "RGB LED",
                    "var": "rgbLed",
                    "op": "rgbWrite",
                    "redPin": "D9",
                    "greenPin": "D10",
                    "bluePin": "D11",
                    "red": 255,
                    "green": 0,
                    "blue": 128,
                }
            ],
            "else": [
                {
                    "nodeId": "rgb",
                    "name": "RGB LED",
                    "var": "rgbLed",
                    "op": "rgbWrite",
                    "redPin": "D9",
                    "greenPin": "D10",
                    "bluePin": "D11",
                    "red": 0,
                    "green": 0,
                    "blue": 0,
                }
            ],
        },
        {
            "id": "c_motor",
            "var": "light",
            "condition": {"op": "gt", "value": 300},
            "then": [
                {
                    "nodeId": "motor",
                    "name": "Motor Driver L298N",
                    "var": "motor",
                    "op": "motorWrite",
                    "pin": "D4",
                    "in2Pin": "D7",
                    "enablePin": "D5",
                    "direction": "forward",
                    "speed": 200,
                }
            ],
            "else": [
                {
                    "nodeId": "motor",
                    "name": "Motor Driver L298N",
                    "var": "motor",
                    "op": "motorWrite",
                    "pin": "D4",
                    "in2Pin": "D7",
                    "enablePin": "D5",
                    "direction": "stop",
                    "speed": 0,
                }
            ],
        },
    ],
}


def test_rgb_colour_reaches_all_three_channels(bus: EventBus, wait) -> None:
    backend, engine = make_engine(bus, RGB_MOTOR_PROGRAM)
    try:
        backend.set_mock_value("A0", 50)
        assert wait(lambda: backend.outputs().get("D9", {}).get("value") == 255)
        assert backend.outputs().get("D10", {}).get("value") == 0
        assert backend.outputs().get("D11", {}).get("value") == 128
        assert engine.status()["outputs"]["rgb"]["state"] == "RGB 255,0,128"
    finally:
        engine.stop()
        backend.stop()


def test_motor_direction_and_speed_reach_the_backend(bus: EventBus, wait) -> None:
    backend, engine = make_engine(bus, RGB_MOTOR_PROGRAM)
    try:
        backend.set_mock_value("A0", 900)
        assert wait(lambda: backend.outputs().get("D4", {}).get("value") == 1)
        assert backend.outputs().get("D7", {}).get("value") == 0
        assert backend.outputs().get("D5", {}).get("value") == 200
        assert engine.status()["outputs"]["motor"]["state"] == "FORWARD 200"
    finally:
        engine.stop()
        backend.stop()


def test_sequences_with_a_wait_repeat_while_active(bus: EventBus) -> None:
    program = parse_program(
        {
            "version": 1,
            "title": "Blink",
            "reads": [{"id": "s", "var": "light", "kind": "analog", "pin": "A0"}],
            "rules": [
                {
                    "id": "c",
                    "var": "light",
                    "condition": {"op": "lt", "value": 300},
                    "then": [
                        {"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 1},
                        {"nodeId": "a", "op": "delay", "ms": 0},
                        {"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 0},
                    ],
                }
            ],
        }
    )
    backend = MockBackend(bus, seed=1)
    engine = RuntimeEngine(backend, bus, program)
    actions = program.rules[0].then
    assert engine._apply(actions) is True  # noqa: SLF001 - direct call is deterministic
    assert engine._apply(actions) is True  # noqa: SLF001
    assert engine._apply(actions) is True  # noqa: SLF001


def test_plain_outputs_only_send_when_they_change(bus: EventBus) -> None:
    program = parse_program(
        {
            "version": 1,
            "title": "Steady",
            "reads": [{"id": "s", "var": "light", "kind": "analog", "pin": "A0"}],
            "rules": [
                {
                    "id": "c",
                    "var": "light",
                    "condition": {"op": "lt", "value": 300},
                    "then": [{"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 1}],
                }
            ],
        }
    )
    backend = MockBackend(bus, seed=1)
    engine = RuntimeEngine(backend, bus, program)
    actions = program.rules[0].then
    assert engine._apply(actions) is True  # noqa: SLF001
    assert engine._apply(actions) is False  # noqa: SLF001


def test_missing_readings_never_trigger_rules(bus: EventBus, golden_program: dict[str, Any]) -> None:
    backend = MockBackend(bus, seed=1)
    program = parse_program(golden_program)
    engine = RuntimeEngine(backend, bus, program)
    # The backend was never started, so no values exist yet.
    backend.all_safe()
    engine._step()  # noqa: SLF001 - direct step keeps the test deterministic
    assert engine.status()["rules"]["cond_less"] is False
    assert engine.status()["values"][LIGHT_LED]["ok"] is False


def test_evaluate_handles_distance_sentinels() -> None:
    read = IrRead(id="s", var="distance", kind="distance", trigPin="D7", echoPin="D8")
    condition = IrCondition(op="lt", value=30)
    assert evaluate(-1, condition, read) is False
    assert evaluate(10, condition, read) is True
    assert evaluate(None, condition, read) is False


def test_evaluate_supports_every_condition_operator() -> None:
    read = IrRead(id="s", var="light", kind="analog", pin="A0")
    assert evaluate(300, IrCondition(op="lt", value=300), read) is False
    assert evaluate(299, IrCondition(op="lt", value=300), read) is True
    assert evaluate(300, IrCondition(op="lte", value=300), read) is True
    assert evaluate(301, IrCondition(op="lte", value=300), read) is False
    assert evaluate(300, IrCondition(op="gt", value=300), read) is False
    assert evaluate(301, IrCondition(op="gt", value=300), read) is True
    assert evaluate(300, IrCondition(op="gte", value=300), read) is True
    assert evaluate(299, IrCondition(op="gte", value=300), read) is False
    assert evaluate(300, IrCondition(op="eq", value=300), read) is True
    assert evaluate(300, IrCondition(op="neq", value=300), read) is False
    assert evaluate(299, IrCondition(op="neq", value=300), read) is True

