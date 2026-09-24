from __future__ import annotations

from typing import Any

import pytest

from app.runtime import IrError, parse_program, watches_for


def test_parses_the_golden_program(golden_program: dict[str, Any]) -> None:
    program = parse_program(golden_program)
    assert program.version == 1
    assert program.loopDelayMs == 50
    assert program.reads[0].pin == "A0"
    rule = program.rules[0]
    assert rule.condition.op == "lt"
    assert rule.condition.value == 300
    assert rule.then[0].op == "digitalWrite"
    assert rule.then[0].pin == "D9"
    assert rule.else_[0].value == 0


def test_builds_watch_list(golden_program: dict[str, Any]) -> None:
    program = parse_program(golden_program)
    watches = watches_for(program)
    assert [(watch.pin, watch.kind) for watch in watches] == [("A0", "analog")]


def test_button_pullup_is_kept() -> None:
    data: dict[str, Any] = {
        "version": 1,
        "title": "Button",
        "reads": [
            {"id": "s", "var": "button", "kind": "digital", "pin": "D2", "pullup": True}
        ],
        "rules": [
            {
                "id": "c",
                "var": "button",
                "condition": {"op": "eq", "value": 1},
                "then": [{"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 1}],
                "else": [{"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 0}],
            }
        ],
    }
    program = parse_program(data)
    assert watches_for(program)[0].pullup is True


def test_parses_an_actuator_only_program() -> None:
    data: dict[str, Any] = {
        "version": 1,
        "title": "Blink",
        "reads": [],
        "rules": [
            {
                "id": "a",
                "var": "",
                "condition": {"op": "always", "value": 0},
                "then": [{"nodeId": "a", "op": "digitalWrite", "pin": "D13", "value": 1}],
            }
        ],
    }
    program = parse_program(data)
    assert program.reads == []
    assert program.rules[0].condition.op == "always"
    assert watches_for(program) == []


def test_distance_reads_are_not_watched() -> None:
    data: dict[str, Any] = {
        "version": 1,
        "reads": [
            {
                "id": "s",
                "var": "distance",
                "kind": "distance",
                "trigPin": "D7",
                "echoPin": "D8",
            }
        ],
        "rules": [
            {
                "id": "c",
                "var": "distance",
                "condition": {"op": "lt", "value": 30},
                "then": [{"nodeId": "a", "op": "digitalWrite", "pin": "D9", "value": 1}],
            }
        ],
    }
    assert watches_for(parse_program(data)) == []


@pytest.mark.parametrize(
    "data, message",
    [
        ({"version": 2, "reads": [], "rules": []}, "different version"),
        ({"version": 1, "reads": [], "rules": []}, "Add a condition"),
        (
            {
                "version": 1,
                "reads": [{"id": "s", "var": "light", "kind": "analog"}],
                "rules": [
                    {
                        "id": "c",
                        "var": "light",
                        "condition": {"op": "lt", "value": 1},
                        "then": [],
                    }
                ],
            },
            "Choose a pin",
        ),
        (
            {
                "version": 1,
                "reads": [{"id": "s", "var": "light", "kind": "analog", "pin": "A0"}],
                "rules": [
                    {
                        "id": "c",
                        "var": "ghost",
                        "condition": {"op": "lt", "value": 1},
                        "then": [],
                    }
                ],
            },
            "needs a sensor input",
        ),
        (None, "could not be read"),
        ("nonsense", "could not be read"),
    ],
)
def test_rejects_bad_programs(data: object, message: str) -> None:
    with pytest.raises(IrError) as error:
        parse_program(data)  # type: ignore[arg-type]
    assert message in str(error.value)
