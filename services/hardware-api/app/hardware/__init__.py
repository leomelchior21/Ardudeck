"""Hardware backends and the manager that chooses between them."""

from .backend import BackendBase, HardwareError, WatchSpec
from .bridge import BridgeBackend
from .discovery import DeviceInfo, list_devices, pick_device
from .manager import HardwareManager, NO_HARDWARE_STATUS
from .mock import MockBackend

__all__ = [
    "BackendBase",
    "BridgeBackend",
    "DeviceInfo",
    "HardwareError",
    "HardwareManager",
    "MockBackend",
    "NO_HARDWARE_STATUS",
    "WatchSpec",
    "list_devices",
    "pick_device",
]
