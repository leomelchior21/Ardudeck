from __future__ import annotations

from app.hardware import protocol
from app.hardware.protocol import parse_line


def test_parses_boot_banner() -> None:
    message = parse_line("ARDUDECK READY 1")
    assert message is not None
    assert message.kind == "boot"
    assert message.version == "1"


def test_parses_handshake() -> None:
    message = parse_line("OK ARDUDECK 1")
    assert message is not None
    assert message.kind == "ok"
    assert message.version == "1"


def test_parses_values() -> None:
    analog = parse_line("A A0 742")
    assert analog is not None and analog.kind == "analog"
    assert analog.pin == "A0" and analog.value == 742

    digital = parse_line("D D9 1\r\n")
    assert digital is not None and digital.kind == "digital"
    assert digital.pin == "D9" and digital.value == 1

    distance = parse_line("C -1")
    assert distance is not None and distance.kind == "distance"
    assert distance.value == -1


def test_parses_errors_and_noise() -> None:
    error = parse_line("ERR unknown command")
    assert error is not None and error.kind == "error"
    assert error.text == "unknown command"
    assert parse_line("   ") is None
    garbage = parse_line("hello there")
    assert garbage is not None and garbage.kind == "unknown"


def test_watch_tokens() -> None:
    assert protocol.watch_token("A0") == "A0"
    assert protocol.watch_token("D2") == "D2"
    assert protocol.watch_token("D2", pullup=True) == "U2"
    assert protocol.pin_from_token("U2") == ("D2", True)
    assert protocol.pin_from_token("A3") == ("A3", False)
    assert protocol.pin_from_token("Z9") is None


def test_command_encoding() -> None:
    assert protocol.cmd_hello() == "?\n"
    assert protocol.cmd_set_watch(["A0", "U2"]) == "E A0,U2\n"
    assert protocol.cmd_set_watch([]) == "E\n"
    assert protocol.cmd_echo_interval(25) == "e 25\n"
    assert protocol.cmd_digital_write("D9", 1) == "W D9 1\n"
    assert protocol.cmd_digital_write("D9", 0) == "W D9 0\n"
    assert protocol.cmd_pwm_write("D9", 300) == "P D9 255\n"
    assert protocol.cmd_servo_write("D5", 400) == "S D5 180\n"
    assert protocol.cmd_tone("D6", 440, 200) == "T D6 440 200\n"
    assert protocol.cmd_tone_stop("D6") == "N D6\n"
    assert protocol.cmd_measure("D7", "D8") == "M D7 D8\n"
    assert protocol.cmd_all_safe() == "X\n"


def test_pin_helpers() -> None:
    assert protocol.is_analog_pin("A5")
    assert not protocol.is_analog_pin("D5")
    assert protocol.is_digital_pin("D13")
    assert protocol.is_pwm_pin("D11")
    assert not protocol.is_pwm_pin("D4")
    assert "D1" not in protocol.ALL_PINS
