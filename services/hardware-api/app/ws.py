"""WebSocket fan-out.

Hardware events arrive from background threads; the hub hands them to the
asyncio side and every connected browser gets the same event. The UI never
polls the hardware.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from .bus import EventBus

log = logging.getLogger(__name__)


class WsHub:
    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        self._loop: asyncio.AbstractEventLoop | None = None
        self._queues: set[asyncio.Queue[dict[str, Any]]] = set()
        self._lock = threading.Lock()

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        self._bus.subscribe(self._forward)

    def _forward(self, event: dict[str, Any]) -> None:
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            queues = list(self._queues)
        for queue in queues:
            try:
                loop.call_soon_threadsafe(queue.put_nowait, event)
            except RuntimeError:  # pragma: no cover - loop is shutting down
                pass
            except asyncio.QueueFull:  # pragma: no cover - slow client
                log.warning("websocket client is too slow, dropping event")

    def register(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        with self._lock:
            self._queues.add(queue)
        return queue

    def unregister(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        with self._lock:
            self._queues.discard(queue)

    @property
    def client_count(self) -> int:
        with self._lock:
            return len(self._queues)
