"""Turns technical failures into classroom language.

Students see one short sentence and at most three things to try. The raw
compiler/uploader output is kept as `details` and is only visible behind the
DETAILS button in Teacher Mode.
"""

from __future__ import annotations

from dataclasses import dataclass, field

STAGE_LABEL: dict[str, str] = {
    "prepare": "Preparing project...",
    "check": "Checking hardware...",
    "compile": "Building the program...",
    "upload": "Sending to Arduino...",
    "finish": "Finishing up...",
    "bridge": "Preparing your Arduino...",
    "done": "Ready!",
}

DEFAULT_HINTS = [
    "Check the USB cable is connected.",
    "Make sure the Arduino has power.",
    "Try unplugging it and plugging it back in.",
]

PATTERNS: list[tuple[tuple[str, ...], str, list[str]]] = [
    (
        ("programmer is not responding", "not in sync", "stk500", "avrdude: stk500"),
        "We can't talk to your Arduino.",
        [
            "Check the USB cable.",
            "Make sure the Arduino has power.",
            "Try reconnecting it.",
        ],
    ),
    (
        ("ser_open", "can't open device", "access is denied", "resource busy", "could not open port", "busy"),
        "The Arduino connection is busy.",
        [
            "Close any other program using the Arduino.",
            "Unplug the USB cable and plug it back in.",
            "Try a different USB port.",
        ],
    ),
    (
        ("no upload port", "no board", "port not found", "could not find the port"),
        "The Arduino is not connected.",
        ["Connect the Arduino with the USB cable.", "Wait a moment and try again."],
    ),
    (
        ("arduino-cli not found", "command not found", "no such file or directory"),
        "ArduDeck could not find the Arduino tools.",
        ["Run scripts/setup-arduino-cli.sh on the Raspberry Pi.", "Then try again."],
    ),
    (
        ("platform not installed", "unknown fqbn", "core arduino:avr"),
        "The Arduino Uno support is not installed.",
        ["Run scripts/setup-arduino-cli.sh on the Raspberry Pi.", "Then try again."],
    ),
    (
        ("expected ';'", "expected '}'", "was not declared", "compilation error", "exit status 1"),
        "There is a problem in the code.",
        ["Open the code view and check the last change.", "Or rebuild the flow from the blocks."],
    ),
]


@dataclass(frozen=True)
class FriendlyError:
    message: str
    hints: list[str] = field(default_factory=list)
    details: str = ""

    def to_dict(self) -> dict[str, object]:
        return {"message": self.message, "hints": list(self.hints), "details": self.details}


def friendly_error(raw: str, stage: str) -> FriendlyError:
    lowered = (raw or "").lower()
    for needles, message, hints in PATTERNS:
        if any(needle in lowered for needle in needles):
            return FriendlyError(message=message, hints=hints, details=raw.strip())

    stage_hints = {
        "compile": ["Try uploading again.", "If it keeps failing, open the code view."],
        "upload": DEFAULT_HINTS,
        "check": ["Connect the Arduino with the USB cable.", "Then try again."],
    }
    message = {
        "compile": "The program could not be built.",
        "upload": "We couldn't finish sending the program.",
        "check": "The Arduino is not ready.",
    }.get(stage, "Something went wrong.")
    return FriendlyError(message=message, hints=stage_hints.get(stage, DEFAULT_HINTS), details=raw.strip())
