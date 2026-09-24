from __future__ import annotations

from app.bus import EventBus
from app.hardware import MockBackend, WatchSpec


def test_simulates_watched_analog_values(bus: EventBus, wait) -> None:
    backend = MockBackend(bus, seed=3)
    backend.start()
    try:
        backend.set_watches([WatchSpec(pin="A0", kind="analog")])
        assert wait(lambda: backend.analog("A0") is not None)
        value = backend.analog("A0")
        assert value is not None and 0 <= value <= 1023
    finally:
        backend.stop()


def test_slider_value_wins_over_drift(bus: EventBus) -> None:
    backend = MockBackend(bus, seed=1)
    backend.start()
    try:
        backend.set_mock_value("A0", 120)
        assert backend.analog("A0") == 120
    finally:
        backend.stop()


def test_records_output_commands(bus: EventBus) -> None:
    backend = MockBackend(bus, seed=1)
    backend.start()
    try:
        backend.write_digital("D9", 1)
        backend.write_servo("D5", 45)
        outputs = backend.outputs()
        assert outputs["D9"]["value"] == 1
        assert outputs["D5"]["value"] == 45
        backend.all_safe()
        assert backend.outputs() == {}
    finally:
        backend.stop()


def test_simulates_distance(bus: EventBus) -> None:
    backend = MockBackend(bus, seed=2)
    backend.start()
    try:
        first = backend.distance_cm("D7", "D8")
        assert first is not None and 40 <= first <= 50
        backend.set_mock_value("D7", 15)
        assert abs((backend.distance_cm("D7", "D8") or 0) - 15) <= 3
    finally:
        backend.stop()


def test_publishes_values_at_a_readable_rate(bus: EventBus, wait) -> None:
    events: list[dict] = []
    bus.subscribe(events.append)
    backend = MockBackend(bus, seed=4)
    backend.start()
    try:
        backend.set_watches([WatchSpec(pin="A0", kind="analog")])
        assert wait(lambda: any(event.get("type") == "values" for event in events))
        value_events = [event for event in events if event.get("type") == "values"]
        assert "A0" in value_events[-1]["values"]
    finally:
        backend.stop()


def test_status_is_labelled_as_simulation(bus: EventBus) -> None:
    backend = MockBackend(bus, seed=1)
    backend.start()
    try:
        status = backend.status()
        assert status["state"] == "ready"
        assert status["source"] == "mock"
        assert backend.simulated is True
    finally:
        backend.stop()
