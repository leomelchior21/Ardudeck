from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..container import Container, get_container
from ..errors import ApiError
from ..hardware import HardwareError, WatchSpec
from ..hardware.protocol import ALL_PINS

router = APIRouter()


class ModeRequest(BaseModel):
    mode: str = "auto"
    port: str | None = None


class WatchRequest(BaseModel):
    pin: str
    kind: str = "analog"
    pullup: bool = False


class WatchListRequest(BaseModel):
    watches: list[WatchRequest] = Field(default_factory=list)


class ReadRequest(BaseModel):
    kind: str = "distance"
    pin: str | None = None
    trig: str | None = None
    echo: str | None = None


@router.get("/api/hardware")
def hardware_status(container: Container = Depends(get_container)) -> dict:
    status = container.manager.status()
    status["arduinoCli"] = {
        "available": container.cli.available(),
        "version": container.cli.version() if container.cli.available() else None,
    }
    return {"ok": True, **status}


@router.post("/api/hardware/mode")
def set_mode(
    payload: ModeRequest, container: Container = Depends(get_container)
) -> dict:
    try:
        status = container.manager.set_mode(payload.mode, payload.port)
    except HardwareError as exc:
        raise ApiError(str(exc), code="hardware", status_code=409) from exc
    return {"ok": True, **status}


@router.post("/api/hardware/reconnect")
def reconnect(container: Container = Depends(get_container)) -> dict:
    status = container.manager.reconnect()
    return {"ok": True, **status}


class UseRequest(BaseModel):
    port: str


@router.post("/api/hardware/use")
def use_device(payload: UseRequest, container: Container = Depends(get_container)) -> dict:
    """Choose one specific serial device (Teacher Mode, more than one board)."""
    try:
        status = container.manager.use_hardware(payload.port)
    except HardwareError as exc:
        raise ApiError(str(exc), code="hardware", status_code=409) from exc
    return {"ok": True, **status}


@router.post("/api/hardware/watch")
def set_watches(
    payload: WatchListRequest, container: Container = Depends(get_container)
) -> dict:
    watches: list[WatchSpec] = []
    for item in payload.watches:
        pin = item.pin.upper()
        if pin not in ALL_PINS:
            raise ApiError(f"{pin} is not a pin on the Arduino Uno.", code="bad-pin")
        if item.kind not in {"analog", "digital"}:
            raise ApiError("This sensor cannot be read live.", code="bad-kind")
        watches.append(WatchSpec(pin=pin, kind=item.kind, pullup=item.pullup))
    container.manager.set_watches(watches)
    return {"ok": True, "watching": len(watches)}


@router.post("/api/hardware/install-bridge")
def install_bridge(container: Container = Depends(get_container)) -> dict:
    job = container.deploy.start_bridge_install()
    return {"ok": True, "job": job}


@router.post("/api/hardware/read")
def read_once(payload: ReadRequest, container: Container = Depends(get_container)) -> dict:
    """One-shot reading used by the Live Sensor screen (distance needs it)."""
    backend = container.manager.backend()
    if backend is None:
        raise ApiError(
            "Connect your Arduino to start.",
            code="no-hardware",
            status_code=409,
            hint="Or try the sensor in simulation.",
        )
    if payload.kind == "distance":
        if not payload.trig or not payload.echo:
            raise ApiError("Choose pins for the distance sensor.", code="bad-pin")
        trig = payload.trig.upper()
        echo = payload.echo.upper()
        if trig not in ALL_PINS or echo not in ALL_PINS:
            raise ApiError("That is not a pin on the Arduino Uno.", code="bad-pin")
        return {"ok": True, "value": backend.distance_cm(trig, echo)}
    if payload.kind in {"analog", "digital"} and payload.pin:
        pin = payload.pin.upper()
        if pin not in ALL_PINS:
            raise ApiError(f"{pin} is not a pin on the Arduino Uno.", code="bad-pin")
        value = backend.analog(pin) if payload.kind == "analog" else backend.digital(pin)
        return {"ok": True, "value": value}
    raise ApiError("This reading is not supported.", code="bad-kind")
