from __future__ import annotations

from fastapi import APIRouter, Depends

from ..container import Container, get_container
from ..system_info import system_info

router = APIRouter()

API_VERSION = 1


@router.get("/api/health")
def health(container: Container = Depends(get_container)) -> dict:
    settings = container.settings
    status = container.manager.status()
    hardware = status["hardware"]
    cli_available = container.cli.available()
    info = system_info(settings.log_dir, settings.data_dir)

    return {
        "status": "ok",
        "app": "ArduDeck",
        "version": settings.app_version,
        "apiVersion": API_VERSION,
        "mockMode": status["mockMode"],
        "hardware": hardware,
        "simulated": status["simulated"],
        "arduinoCli": {
            "available": cli_available,
            "version": container.cli.version() if cli_available else None,
            "avrCore": container.cli.has_avr_core() if cli_available else False,
        },
        "bridge": {
            "state": hardware.get("state"),
            "fqbn": settings.fqbn,
        },
        "runtime": {"running": container.runtime.status()["running"]},
        "platform": info["platform"],
        "piModel": info["piModel"],
    }
