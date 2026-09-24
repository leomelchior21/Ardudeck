"""Everything the API routes need, built once at startup."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from fastapi import Request

from .bus import EventBus
from .config import Settings
from .deploy import ArduinoCli, DeployService
from .hardware import HardwareManager
from .projects import ProjectStore
from .runtime import RuntimeService
from .ws import WsHub


@dataclass
class Container:
    settings: Settings
    bus: EventBus
    cli: ArduinoCli
    manager: HardwareManager
    runtime: RuntimeService
    deploy: DeployService
    projects: ProjectStore
    hub: WsHub
    log_file: Path


def build_container(settings: Settings, log_file: Path) -> Container:
    bus = EventBus()
    cli = ArduinoCli(executable=settings.arduino_cli, fqbn=settings.fqbn)
    manager = HardwareManager(settings, bus, cli)
    runtime = RuntimeService(bus, manager)
    deploy = DeployService(settings, bus, manager, runtime, cli)
    projects = ProjectStore(settings.data_dir)
    hub = WsHub(bus)
    return Container(
        settings=settings,
        bus=bus,
        cli=cli,
        manager=manager,
        runtime=runtime,
        deploy=deploy,
        projects=projects,
        hub=hub,
        log_file=log_file,
    )


def get_container(request: Request) -> Container:
    container: Container = request.app.state.container
    return container
