"""ArduDeck Bridge serial protocol (line-based ASCII at 115200 baud).

The firmware is intentionally tiny and human-readable: every message is a
single line, so Teacher Mode can show the raw traffic verbatim and a student
can never be blocked by a parser edge case.

Pi -> Arduino
    ?                 identify            -> "OK ARDUDECK 1"
    E A0,D2,U3        set the pins to stream
    E                 stop streaming
    e 25              streaming interval in ms
    R D2              read once            -> "V D2 1"
    W D9 1            digital write
    P D3 128          PWM write
    S D5 90           servo angle
    T D6 440 200      tone (frequency, duration)
    N D6              stop tone
    M D7 D8           measure distance     -> "C 42"
    X                 all outputs safe

Arduino -> Pi
    ARDUDECK READY 1  printed once after boot/reset
    A A0 742          analog value
    D D2 1            digital value
    C 42              distance in cm (-1 when no echo)
    V D2 1            single read answer
    PONG 12345        liveness reply
    ERR <message>     something was not understood
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

BAUD_RATE = 115200
PROTOCOL_VERSION = "1"
BOOT_BANNER = "ARDUDECK READY"
OK_PREFIX = "OK ARDUDECK"

ANALOG_PINS: tuple[str, ...] = tuple(f"A{index}" for index in range(6))
DIGITAL_PINS: tuple[str, ...] = tuple(f"D{index}" for index in range(2, 14))
ALL_PINS: tuple[str, ...] = ANALOG_PINS + DIGITAL_PINS
PWM_PINS: tuple[str, ...] = ("D3", "D5", "D6", "D9", "D10", "D11")


def is_analog_pin(pin: str) -> bool:
    return pin in ANALOG_PINS


def is_digital_pin(pin: str) -> bool:
    return pin in DIGITAL_PINS


def is_pin(pin: str) -> bool:
    return pin in ALL_PINS


def is_pwm_pin(pin: str) -> bool:
    return pin in PWM_PINS


def watch_token(pin: str, pullup: bool = False) -> str:
    """Encodes one streaming pin. "U3" means digital pin 3 with a pull-up."""
    if is_analog_pin(pin):
        return pin
    if pullup:
        return f"U{pin[1:]}"
    return pin


def pin_from_token(token: str) -> tuple[str, bool] | None:
    token = token.strip()
    if token in ANALOG_PINS:
        return token, False
    if token in DIGITAL_PINS:
        return token, False
    if len(token) >= 2 and token[0] == "U" and f"D{token[1:]}" in DIGITAL_PINS:
        return f"D{token[1:]}", True
    return None


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, int(value)))


def cmd_hello() -> str:
    return "?\n"


def cmd_set_watch(tokens: Iterable[str]) -> str:
    joined = ",".join(tokens)
    return f"E {joined}\n" if joined else "E\n"


def cmd_echo_interval(milliseconds: int) -> str:
    return f"e {_clamp(milliseconds, 5, 5000)}\n"


def cmd_read(pin: str) -> str:
    return f"R {pin}\n"


def cmd_digital_write(pin: str, value: int) -> str:
    return f"W {pin} {1 if value else 0}\n"


def cmd_pwm_write(pin: str, value: int) -> str:
    return f"P {pin} {_clamp(value, 0, 255)}\n"


def cmd_servo_write(pin: str, angle: int) -> str:
    return f"S {pin} {_clamp(angle, 0, 180)}\n"


def cmd_tone(pin: str, frequency: int, duration_ms: int) -> str:
    return f"T {pin} {_clamp(frequency, 31, 8000)} {_clamp(duration_ms, 1, 10000)}\n"


def cmd_tone_stop(pin: str) -> str:
    return f"N {pin}\n"


def cmd_measure(trig_pin: str, echo_pin: str) -> str:
    return f"M {trig_pin} {echo_pin}\n"


def cmd_all_safe() -> str:
    return "X\n"


@dataclass(frozen=True)
class Message:
    kind: str
    pin: str | None = None
    value: int | None = None
    version: str | None = None
    text: str = ""


def _to_int(text: str) -> int | None:
    try:
        return int(text)
    except (TypeError, ValueError):
        return None


def parse_line(raw: str) -> Message | None:
    """Turns one line of serial traffic into a Message (None for noise)."""
    line = raw.strip()
    if not line:
        return None

    if line.startswith(BOOT_BANNER):
        parts = line.split()
        version = parts[2] if len(parts) > 2 else None
        return Message("boot", version=version)

    if line.startswith(OK_PREFIX):
        parts = line.split()
        version = parts[2] if len(parts) > 2 else None
        return Message("ok", version=version)

    parts = line.split()
    tag = parts[0]

    if tag in {"A", "D", "V"} and len(parts) >= 3:
        value = _to_int(parts[2])
        if value is None:
            return Message("unknown", text=line)
        kind = {"A": "analog", "D": "digital", "V": "value"}[tag]
        return Message(kind, pin=parts[1], value=value)

    if tag == "C" and len(parts) >= 2:
        value = _to_int(parts[1])
        if value is None:
            return Message("unknown", text=line)
        return Message("distance", value=value)

    if tag == "PONG":
        return Message("pong", value=_to_int(parts[1]) if len(parts) > 1 else None)

    if tag == "ERR":
        return Message("error", text=" ".join(parts[1:]))

    return Message("unknown", text=line)


def encode_lines(messages: Sequence[str]) -> bytes:
    return "".join(messages).encode("ascii", errors="ignore")
