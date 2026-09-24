"""HTTP and WebSocket API."""

from fastapi import APIRouter

from . import (
    routes_deploy,
    routes_hardware,
    routes_health,
    routes_projects,
    routes_runtime,
    routes_teacher,
    routes_ws,
)

api_router = APIRouter()
api_router.include_router(routes_health.router)
api_router.include_router(routes_hardware.router)
api_router.include_router(routes_runtime.router)
api_router.include_router(routes_deploy.router)
api_router.include_router(routes_projects.router)
api_router.include_router(routes_teacher.router)
api_router.include_router(routes_ws.router)

__all__ = ["api_router"]
