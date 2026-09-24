"""Raspberry Pi / host information for Teacher Mode.

Uses only the standard library and /proc so there is nothing extra to install
on a 1 GB Raspberry Pi.
"""

from __future__ import annotations

import os
import platform
import shutil
import sys
import time
from pathlib import Path
from typing import Any


def _read_text(path: str) -> str | None:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return None


def read_pi_model() -> str | None:
    model = _read_text("/proc/device-tree/model")
    if model:
        return model.replace("\x00", "").strip()
    return None


def read_memory() -> dict[str, int] | None:
    content = _read_text("/proc/meminfo")
    if not content:
        return None
    values: dict[str, int] = {}
    for line in content.splitlines():
        parts = line.split(":")
        if len(parts) != 2:
            continue
        key = parts[0].strip()
        number = parts[1].strip().split()[0] if parts[1].strip() else ""
        if number.isdigit():
            values[key] = int(number)
    total = values.get("MemTotal")
    available = values.get("MemAvailable")
    if total is None:
        return None
    return {
        "totalMb": total // 1024,
        "availableMb": (available or 0) // 1024,
    }


def read_temperature_c() -> float | None:
    raw = _read_text("/sys/class/thermal/thermal_zone0/temp")
    if raw is None or not raw.strip().isdigit():
        return None
    return int(raw) / 1000.0


def read_uptime_seconds() -> float | None:
    raw = _read_text("/proc/uptime")
    if not raw:
        return None
    first = raw.split()[0]
    try:
        return float(first)
    except ValueError:
        return None


def disk_usage(path: Path) -> dict[str, int] | None:
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return None
    return {
        "totalMb": usage.total // (1024 * 1024),
        "freeMb": usage.free // (1024 * 1024),
    }


def system_info(log_dir: Path, data_dir: Path) -> dict[str, Any]:
    info: dict[str, Any] = {
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "python": sys.version.split()[0],
            "hostname": platform.node(),
            "pid": os.getpid(),
        },
        "piModel": read_pi_model(),
        "memory": read_memory(),
        "temperatureC": read_temperature_c(),
        "uptimeSeconds": read_uptime_seconds(),
        "disk": disk_usage(data_dir),
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "paths": {
            "logDir": str(log_dir),
            "dataDir": str(data_dir),
        },
    }
    return info
