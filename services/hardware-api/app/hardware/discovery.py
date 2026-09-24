"""Finding Arduinos: USB serial enumeration, scored so that a real Uno wins."""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any

try:
    from serial.tools import list_ports
except ImportError:  # pragma: no cover - pyserial is a hard dependency
    list_ports = None

log = logging.getLogger(__name__)

KNOWN_USB: dict[tuple[int, int], str] = {
    (0x2341, 0x0043): "Arduino Uno",
    (0x2341, 0x0001): "Arduino Uno",
    (0x2A03, 0x0043): "Arduino Uno (compatible)",
    (0x2341, 0x0243): "Arduino Uno WiFi",
    (0x1A86, 0x7523): "USB Serial (CH340)",
    (0x1A86, 0x55D4): "USB Serial (CH9102)",
    (0x10C4, 0xEA60): "USB Serial (CP2102)",
    (0x0403, 0x6001): "USB Serial (FTDI)",
}

UNO_VID_PIDS = {(0x2341, 0x0043), (0x2341, 0x0001), (0x2A03, 0x0043), (0x2341, 0x0243)}


@dataclass(frozen=True)
class DeviceInfo:
    port: str
    label: str
    board: str | None = None
    vid_pid: str | None = None
    score: int = 0
    is_uno: bool = False

    @property
    def is_candidate(self) -> bool:
        """True for ports that plausibly carry an Arduino.

        Bluetooth modems, debug ports and other phantom serial devices score 0
        and are never chosen automatically, but they stay visible in Teacher
        Mode so a teacher can pick one by hand.
        """
        return self.score > 0

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["is_candidate"] = self.is_candidate
        return payload


def score_port(port_info: Any) -> tuple[str, int, bool, str | None]:
    key = (port_info.vid, port_info.pid)
    if key in KNOWN_USB:
        name = KNOWN_USB[key]
        is_uno = key in UNO_VID_PIDS
        vid_pid = f"{port_info.vid:04x}:{port_info.pid:04x}"
        return name, 100 if is_uno else 60, is_uno, vid_pid

    description = (port_info.description or "").strip()
    haystack = f"{description} {port_info.manufacturer or ''}".lower()
    if "arduino" in haystack or "uno" in haystack:
        return description or "Arduino board", 90, True, None
    if any(token in haystack for token in ("ch340", "cp210", "ftdi", "usb serial", "usb-serial")):
        return description or "USB serial adapter", 50, False, None
    return description or "Serial port", 0, False, None


def list_devices(board_list: list[dict[str, Any]] | None = None) -> list[DeviceInfo]:
    """Merge pyserial enumeration with `arduino-cli board list` when available."""
    devices: dict[str, DeviceInfo] = {}

    if list_ports is not None:
        for port_info in list_ports.comports():
            label, score, is_uno, vid_pid = score_port(port_info)
            devices[port_info.device] = DeviceInfo(
                port=port_info.device,
                label=label,
                board=label if is_uno else None,
                vid_pid=vid_pid,
                score=score,
                is_uno=is_uno,
            )

    for entry in board_list or []:
        port = entry.get("port") if isinstance(entry, dict) else None
        if not isinstance(port, dict):
            continue
        address = port.get("address")
        if not isinstance(address, str) or not address:
            continue
        matching = entry.get("matching_boards") or []
        board_name = None
        if isinstance(matching, list) and matching and isinstance(matching[0], dict):
            board_name = matching[0].get("name")
        existing = devices.get(address)
        is_uno = bool(board_name and "uno" in str(board_name).lower())
        if existing is not None:
            devices[address] = DeviceInfo(
                port=address,
                label=str(board_name) if board_name else existing.label,
                board=str(board_name) if board_name else existing.board,
                vid_pid=existing.vid_pid,
                score=max(existing.score, 95) if board_name else existing.score,
                is_uno=existing.is_uno or is_uno,
            )
        else:
            devices[address] = DeviceInfo(
                port=address,
                label=str(board_name) if board_name else "Arduino board",
                board=str(board_name) if board_name else None,
                score=95 if board_name else 30,
                is_uno=is_uno,
            )

    return sorted(devices.values(), key=lambda device: (-device.score, device.port))


def pick_device(
    devices: list[DeviceInfo],
    preferred_port: str | None = None,
    candidates_only: bool = True,
) -> DeviceInfo | None:
    if preferred_port:
        for device in devices:
            if device.port == preferred_port:
                return device
    best: DeviceInfo | None = None
    for device in devices:
        if candidates_only and not device.is_candidate:
            continue
        if best is None or device.score > best.score:
            best = device
    return best
