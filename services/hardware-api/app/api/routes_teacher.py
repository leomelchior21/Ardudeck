from __future__ import annotations

import logging
import shutil
import subprocess
import threading
import time

from fastapi import APIRouter, Depends, Query

from ..container import Container, get_container
from ..logging_setup import tail
from ..system_info import system_info

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/teacher/system")
def teacher_system(container: Container = Depends(get_container)) -> dict:
    settings = container.settings
    info = system_info(settings.log_dir, settings.data_dir)
    info["app"] = {"version": settings.app_version, "fqbn": settings.fqbn}
    info["arduinoCli"] = {
        "executable": settings.arduino_cli,
        "available": container.cli.available(),
        "version": container.cli.version(),
        "avrCore": container.cli.has_avr_core() if container.cli.available() else False,
    }
    info["bridge"] = {
        "sketch": str(settings.bridge_sketch),
        "present": (settings.bridge_sketch / "ardudeck-bridge.ino").exists(),
    }
    info["hardware"] = container.manager.status()
    info["deploy"] = container.deploy.current()
    info["webClients"] = container.hub.client_count
    return {"ok": True, "system": info}


@router.get("/api/teacher/logs")
def teacher_logs(
    kind: str = Query("app"),
    lines: int = Query(200, ge=1, le=1000),
    container: Container = Depends(get_container),
) -> dict:
    if kind == "serial":
        entries = container.bus.recent("serial", lines)
        rendered = [
            f"{entry.get('direction', '--')} {entry.get('text', '')}" for entry in entries
        ]
    elif kind == "compile":
        rendered = container.deploy.logs(lines)
    elif kind == "events":
        entries = container.bus.recent(None, lines)
        rendered = [
            f"{entry.get('type', '?')}: "
            + ", ".join(
                f"{key}={value}"
                for key, value in entry.items()
                if key not in {"type", "ts"} and not isinstance(value, (dict, list))
            )
            for entry in entries
        ]
    else:
        rendered = tail(container.log_file, lines)
    return {"ok": True, "kind": kind, "lines": rendered}


@router.post("/api/teacher/restart")
def teacher_restart(container: Container = Depends(get_container)) -> dict:
    if shutil.which("systemctl") is None:
        return {
            "ok": False,
            "message": "Restarting is only available on the Raspberry Pi.",
        }
    threading.Thread(target=_restart_service, daemon=True).start()
    return {"ok": True, "message": "ArduDeck is restarting. The screen will come back in a moment."}


def _restart_service() -> None:
    time.sleep(0.8)
    try:
        subprocess.Popen(
            ["sudo", "-n", "systemctl", "restart", "ardudeck-api"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:  # pragma: no cover - only on a misconfigured Pi
        log.warning("could not restart ardudeck-api", exc_info=True)
