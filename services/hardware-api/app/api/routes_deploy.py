from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..container import Container, get_container

router = APIRouter()


class DeployRequest(BaseModel):
    name: str = "ArduDeck project"
    code: str


@router.post("/api/deploy")
def deploy(payload: DeployRequest, container: Container = Depends(get_container)) -> dict:
    job = container.deploy.start_deploy(payload.name, payload.code)
    return {"ok": True, "job": job}


@router.get("/api/deploy/current")
def current(container: Container = Depends(get_container)) -> dict:
    return {"ok": True, "job": container.deploy.current()}


@router.post("/api/deploy/cancel")
def cancel(container: Container = Depends(get_container)) -> dict:
    return {"ok": True, "job": container.deploy.cancel()}
