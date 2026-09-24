"""The JSON shapes arduino-cli returns differ between versions; pin both."""

from __future__ import annotations

from app.deploy.arduino_cli import ArduinoCli, CommandResult

CORE_LIST_OBJECT = """
{
  "platforms": [
    {
      "metadata": {"id": "arduino:avr", "maintainer": "Arduino"},
      "installed_version": "1.8.8"
    },
    {
      "metadata": {"id": "esp32:esp32", "maintainer": "Espressif"},
      "installed_version": "3.3.11"
    }
  ]
}
"""

CORE_LIST_ARRAY = """
[
  {"id": "arduino:avr", "version": "1.8.8"}
]
"""

BOARD_LIST_OBJECT = """
{
  "detected_ports": [
    {
      "port": {"address": "COM49", "label": "COM49", "protocol": "serial"},
      "matching_boards": [{"name": "Arduino Uno", "fqbn": "arduino:avr:uno"}]
    }
  ]
}
"""

BOARD_LIST_ARRAY = """
[
  {"port": {"address": "COM9", "label": "COM9", "protocol": "serial"}}
]
"""


def cli_with(output: str) -> ArduinoCli:
    cli = ArduinoCli(executable="fake")
    cli._run = lambda args, timeout=300.0: CommandResult(  # type: ignore[method-assign]
        ok=True, returncode=0, output=output
    )
    return cli


def test_cores_from_object_payload() -> None:
    cli = cli_with(CORE_LIST_OBJECT)
    assert cli.cores() == ["arduino:avr", "esp32:esp32"]
    assert cli.has_avr_core() is True


def test_cores_from_array_payload() -> None:
    cli = cli_with(CORE_LIST_ARRAY)
    assert cli.cores() == ["arduino:avr"]


def test_cores_missing_avr() -> None:
    cli = cli_with('{"platforms": [{"metadata": {"id": "esp32:esp32"}}]}')
    assert cli.has_avr_core() is False


def test_board_list_from_object_payload() -> None:
    cli = cli_with(BOARD_LIST_OBJECT)
    entries = cli.board_list()
    assert entries[0]["port"]["address"] == "COM49"
    assert entries[0]["matching_boards"][0]["name"] == "Arduino Uno"


def test_board_list_from_array_payload() -> None:
    cli = cli_with(BOARD_LIST_ARRAY)
    assert cli.board_list()[0]["port"]["address"] == "COM9"
