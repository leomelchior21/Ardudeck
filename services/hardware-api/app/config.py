"""Runtime configuration.

Everything is overridable with environment variables so the same code runs on a
developer laptop, on the Raspberry Pi and inside tests.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path

APP_VERSION = "0.1.0"

# services/hardware-api/app/config.py -> repo root
REPO_ROOT = Path(__file__).resolve().parents[3]

MOCK_AUTO = "auto"
MOCK_ON = "on"
MOCK_OFF = "off"


@dataclass(frozen=True)
class Settings:
    app_version: str = APP_VERSION
    repo_root: Path = REPO_ROOT
    data_dir: Path = REPO_ROOT / "services" / "hardware-api" / "data"
    log_dir: Path = REPO_ROOT / "services" / "hardware-api" / "logs"
    work_dir: Path = REPO_ROOT / "services" / "hardware-api" / "data" / "work"
    ui_dist: Path = REPO_ROOT / "apps" / "ui" / "dist"
    bridge_sketch: Path = REPO_ROOT / "firmware" / "ardudeck-bridge"
    arduino_cli: str = "arduino-cli"
    fqbn: str = "arduino:avr:uno"
    baud_rate: int = 115200
    host: str = "127.0.0.1"
    port: int = 8080
    # auto: use mock only when no Arduino is present (developer default)
    # on:   always simulate (developer / classroom without hardware)
    # off:  never start in simulation (Raspberry Pi default)
    mock_mode: str = MOCK_AUTO
    echo_interval_ms: int = 25

    def ensure_directories(self) -> None:
        for directory in (self.data_dir, self.log_dir, self.work_dir):
            directory.mkdir(parents=True, exist_ok=True)

    def with_overrides(self, **kwargs: object) -> "Settings":
        return replace(self, **kwargs)  # type: ignore[arg-type]


def _env_path(name: str, default: Path) -> Path:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return Path(value).expanduser().resolve()


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_str(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def load_settings() -> Settings:
    settings = Settings(
        data_dir=_env_path("ARDUDECK_DATA_DIR", Settings.data_dir),
        log_dir=_env_path("ARDUDECK_LOG_DIR", Settings.log_dir),
        work_dir=_env_path("ARDUDECK_WORK_DIR", Settings.work_dir),
        ui_dist=_env_path("ARDUDECK_UI_DIST", Settings.ui_dist),
        bridge_sketch=_env_path("ARDUDECK_BRIDGE_SKETCH", Settings.bridge_sketch),
        arduino_cli=_env_str("ARDUDECK_ARDUINO_CLI", Settings.arduino_cli),
        fqbn=_env_str("ARDUDECK_FQBN", Settings.fqbn),
        baud_rate=_env_int("ARDUDECK_BAUD", Settings.baud_rate),
        host=_env_str("ARDUDECK_HOST", Settings.host),
        port=_env_int("ARDUDECK_PORT", Settings.port),
        mock_mode=_env_str("ARDUDECK_MOCK", Settings.mock_mode).lower(),
        echo_interval_ms=_env_int("ARDUDECK_ECHO_MS", Settings.echo_interval_ms),
    )
    if settings.mock_mode not in {MOCK_AUTO, MOCK_ON, MOCK_OFF}:
        settings = settings.with_overrides(mock_mode=MOCK_AUTO)
    settings.ensure_directories()
    return settings
