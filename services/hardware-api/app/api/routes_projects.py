from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..container import Container, get_container
from ..errors import ApiError

router = APIRouter()


class SaveRequest(BaseModel):
    name: str = "Untitled project"
    flow: dict[str, Any] | str | None = None
    code: str | None = None
    deployedAt: str | None = None


@router.get("/api/projects")
def list_projects(container: Container = Depends(get_container)) -> dict:
    return {"ok": True, "projects": container.projects.list()}


@router.get("/api/projects/{project_id}")
def get_project(project_id: str, container: Container = Depends(get_container)) -> dict:
    project = container.projects.get(project_id)
    if project is None:
        raise ApiError("This project could not be found.", code="not-found", status_code=404)
    return {"ok": True, "project": project}


@router.put("/api/projects/{project_id}")
def save_project(
    project_id: str, payload: SaveRequest, container: Container = Depends(get_container)
) -> dict:
    try:
        project = container.projects.save(
            {
                "id": project_id,
                "name": payload.name,
                "flow": payload.flow,
                "code": payload.code,
                "deployedAt": payload.deployedAt,
            }
        )
    except ValueError as exc:
        raise ApiError(str(exc), code="invalid-project") from exc
    return {"ok": True, "project": project}


@router.delete("/api/projects/{project_id}")
def delete_project(project_id: str, container: Container = Depends(get_container)) -> dict:
    removed = container.projects.delete(project_id)
    if not removed:
        raise ApiError("This project could not be found.", code="not-found", status_code=404)
    return {"ok": True}
