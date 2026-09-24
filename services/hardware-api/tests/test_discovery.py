from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.hardware.discovery import DeviceInfo, list_devices, pick_device, score_port


def fake_port(
    device: str,
    description: str,
    vid: int | None = None,
    pid: int | None = None,
    manufacturer: str | None = None,
) -> Any:
    return SimpleNamespace(
        device=device, description=description, vid=vid, pid=pid, manufacturer=manufacturer
    )


def test_real_uno_scores_highest() -> None:
    label, score, is_uno, vid_pid = score_port(
        fake_port("COM4", "Arduino Uno", vid=0x2341, pid=0x0043)
    )
    assert label == "Arduino Uno"
    assert score == 100
    assert is_uno is True
    assert vid_pid == "2341:0043"


def test_ch340_clone_is_a_candidate_but_not_an_uno() -> None:
    _, score, is_uno, _ = score_port(fake_port("COM5", "USB-SERIAL CH340", vid=0x1A86, pid=0x7523))
    assert score == 60
    assert is_uno is False


def test_bluetooth_ports_are_not_candidates() -> None:
    label, score, is_uno, _ = score_port(
        fake_port("COM3", "Standard Serial over Bluetooth link", manufacturer="Microsoft")
    )
    assert label.startswith("Standard Serial")
    assert score == 0
    assert is_uno is False


def test_port_named_arduino_wins_by_description() -> None:
    _, score, is_uno, _ = score_port(fake_port("COM9", "Arduino Uno (generic)"))
    assert score == 90
    assert is_uno is True


def test_pick_device_skips_phantom_ports() -> None:
    devices = [
        DeviceInfo(port="COM3", label="Bluetooth", score=0),
        DeviceInfo(port="COM40", label="Bluetooth", score=0),
    ]
    assert pick_device(devices) is None
    assert pick_device(devices, candidates_only=False) is not None


def test_pick_device_prefers_the_uno() -> None:
    devices = [
        DeviceInfo(port="COM5", label="USB Serial (CH340)", score=60),
        DeviceInfo(port="COM4", label="Arduino Uno", score=100, board="Arduino Uno", is_uno=True),
    ]
    picked = pick_device(devices)
    assert picked is not None and picked.port == "COM4"


def test_pick_device_honours_an_explicit_port() -> None:
    devices = [
        DeviceInfo(port="COM5", label="USB Serial (CH340)", score=60),
        DeviceInfo(port="COM3", label="Bluetooth", score=0),
    ]
    picked = pick_device(devices, preferred_port="COM3")
    assert picked is not None and picked.port == "COM3"


def test_board_list_entries_enrich_devices() -> None:
    devices = list_devices(
        [
            {
                "port": {"address": "COM7"},
                "matching_boards": [{"name": "Arduino Uno"}],
            }
        ]
    )
    from_board_list = [device for device in devices if device.port == "COM7"]
    assert len(from_board_list) == 1
    entry = from_board_list[0]
    assert entry.is_uno is True
    assert entry.is_candidate is True
    assert entry.to_dict()["is_candidate"] is True
