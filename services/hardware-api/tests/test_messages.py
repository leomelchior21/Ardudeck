from __future__ import annotations

from app.deploy.messages import friendly_error

AVRDUDE_NO_SYNC = """
avrdude: stk500_recv(): programmer is not responding
avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00
Failed uploading: uploading error: exit status 1
"""

PORT_BUSY = "avrdude: ser_open(): can't open device \"COM4\": Access is denied."


def test_maps_programmer_errors() -> None:
    friendly = friendly_error(AVRDUDE_NO_SYNC, "upload")
    assert friendly.message == "We can't talk to your Arduino."
    assert any("USB cable" in hint for hint in friendly.hints)
    assert "stk500_recv" in friendly.details


def test_maps_busy_port() -> None:
    friendly = friendly_error(PORT_BUSY, "upload")
    assert friendly.message == "The Arduino connection is busy."
    assert len(friendly.hints) <= 3


def test_maps_missing_tools() -> None:
    friendly = friendly_error("arduino-cli: command not found", "check")
    assert friendly.message == "ArduDeck could not find the Arduino tools."


def test_falls_back_to_stage_message() -> None:
    friendly = friendly_error("some unexpected output", "compile")
    assert friendly.message == "The program could not be built."
    assert friendly.hints


def test_never_returns_raw_stack_like_text_as_message() -> None:
    friendly = friendly_error("Traceback (most recent call last): ...", "upload")
    assert "Traceback" not in friendly.message
