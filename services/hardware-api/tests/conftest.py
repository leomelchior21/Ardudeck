"""Shared fixtures. The API test suite runs entirely on mock hardware."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable

import pytest
from fastapi.testclient import TestClient

from app.bus import EventBus
from app.config import MOCK_ON, Settings
from app.main import create_app

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES_DIR = REPO_ROOT / "core" / "fixtures"


@pytest.fixture
def golden_program() -> dict[str, Any]:
    """The IR produced by the TypeScript compiler for the acceptance flow."""
    return json.loads((FIXTURES_DIR / "light-led.ir.json").read_text(encoding="utf-8"))


@pytest.fixture
def golden_sketch() -> str:
    """The Arduino C++ produced by the TypeScript compiler for the acceptance flow."""
    return (FIXTURES_DIR / "light-led.ino").read_text(encoding="utf-8")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    resolved = Settings(
        data_dir=tmp_path / "data",
        log_dir=tmp_path / "logs",
        work_dir=tmp_path / "work",
        ui_dist=tmp_path / "ui",
        bridge_sketch=tmp_path / "bridge",
        mock_mode=MOCK_ON,
        arduino_cli="ardudeck-cli-not-installed",
    )
    resolved.ensure_directories()
    return resolved


@pytest.fixture
def bus() -> EventBus:
    return EventBus()


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def wait() -> Callable[..., bool]:
    def _wait(predicate: Callable[[], bool], timeout: float = 4.0, interval: float = 0.02) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return True
            time.sleep(interval)
        return False

    return _wait
