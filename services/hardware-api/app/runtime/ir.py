"""Parsing and validating the IR that the visual editor sends us.

The IR is the contract; this module is the Python side of it. Anything that
does not match produces a short, student-friendly error instead of a traceback.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..hardware import WatchSpec


class IrError(ValueError):
    """Raised with a message that can be shown to a student."""


class IrRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = "Sensor"
    var: str
    kind: Literal["analog", "digital", "distance"]
    pin: str | None = None
    trigPin: str | None = None
    echoPin: str | None = None
    pullup: bool = False


class IrCondition(BaseModel):
    model_config = ConfigDict(extra="ignore")

    op: Literal["lt", "gt", "eq", "lte", "gte", "neq", "always"]
    value: float = 0


class IrAction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nodeId: str
    name: str = "Action"
    var: str = "action"
    op: Literal[
        "digitalWrite",
        "pwmWrite",
        "servoWrite",
        "tone",
        "stopTone",
        "delay",
        "rgbWrite",
        "motorWrite",
    ]
    pin: str | None = None
    value: int | None = None
    angle: int | None = None
    frequency: int | None = None
    durationMs: int | None = None
    ms: int | None = None
    redPin: str | None = None
    greenPin: str | None = None
    bluePin: str | None = None
    red: int | None = None
    green: int | None = None
    blue: int | None = None
    in2Pin: str | None = None
    enablePin: str | None = None
    direction: Literal["forward", "reverse", "brake", "stop"] | None = None
    speed: int | None = None


class IrRule(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    var: str
    condition: IrCondition
    then: list[IrAction] = Field(default_factory=list)
    else_: list[IrAction] = Field(default_factory=list, alias="else")


class IrProgram(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: int
    title: str = "ArduDeck project"
    loopDelayMs: int = 50
    reads: list[IrRead] = Field(default_factory=list)
    rules: list[IrRule] = Field(default_factory=list)


def parse_program(data: dict[str, Any] | None) -> IrProgram:
    if not isinstance(data, dict):
        raise IrError("This flow could not be read.")
    try:
        program = IrProgram.model_validate(data)
    except ValidationError as exc:
        raise IrError("This flow could not be read.") from exc

    if program.version != 1:
        raise IrError("This project was made with a different version of ArduDeck.")

    var_names = {read.var for read in program.reads}
    for read in program.reads:
        if read.kind == "distance":
            if not read.trigPin or not read.echoPin:
                raise IrError(f"Choose pins for {read.name}.")
        elif not read.pin:
            raise IrError(f"Choose a pin for {read.name}.")

    if not program.rules:
        raise IrError("Add a condition and an action to your flow.")

    for rule in program.rules:
        if rule.condition.op != "always" and rule.var not in var_names:
            raise IrError("This condition needs a sensor input.")

    return program


def watches_for(program: IrProgram) -> list[WatchSpec]:
    """Pins the bridge should stream while this program runs."""
    watches: list[WatchSpec] = []
    seen: set[str] = set()
    for read in program.reads:
        if read.kind == "distance" or read.pin is None:
            continue
        if read.pin in seen:
            continue
        seen.add(read.pin)
        watches.append(WatchSpec(pin=read.pin, kind=read.kind, pullup=read.pullup))
    return watches
