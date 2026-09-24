"""Deployment: arduino-cli wrapper, friendly errors and the upload pipeline."""

from .arduino_cli import ArduinoCli, CommandResult
from .messages import FriendlyError, friendly_error
from .pipeline import DeployService, Step, sanitize_sketch_name

__all__ = [
    "ArduinoCli",
    "CommandResult",
    "DeployService",
    "FriendlyError",
    "Step",
    "friendly_error",
    "sanitize_sketch_name",
]
