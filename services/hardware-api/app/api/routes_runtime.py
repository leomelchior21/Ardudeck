from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..container import Container, get_container
from ..errors import ApiError
from ..hardware.protocol import ALL_PINS

router = APIRouter()


class StartRequest(BaseModel):
    program: dict[str, Any]
    simulate: bool = False


class MockValueRequest(BaseModel):
    pin: str
    value: int


@router.post("/api/runtime/start")
def start(
    payload: StartRequest, container: Container = Depends(get_container)
) -> dict:
    status = container.runtime.start(payload.program, simulate=payload.simulate)
    return {"ok": True, "runtime": status}


@router.post("/api/runtime/stop")
def stop(container: Container = Depends(get_container)) -> dict:
    return {"ok": True, "runtime": container.runtime.stop()}


@router.get("/api/runtime/status")
def status(container: Container = Depends(get_container)) -> dict:
    return {"ok": True, "runtime": container.runtime.status()}


@router.post("/api/runtime/mock-value")
def mock_value(
    payload: MockValueRequest, container: Container = Depends(get_container)
) -> dict:
    pin = payload.pin.upper()
    if pin not in ALL_PINS:
        raise ApiError(f"{pin} is not a pin on the Arduino Uno.", code="bad-pin")
    result = container.runtime.set_mock_value(pin, payload.value)
    return {"ok": True, **result}
