"""Small thread-safe pub/sub used to move hardware events to the API layer.

The runtime, the serial bridge and the deploy pipeline all publish here; the
WebSocket hub is the only consumer that matters for the UI. A short history is
kept so Teacher Mode can show recent events after the fact.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from typing import Any, Callable

log = logging.getLogger(__name__)

EventHandler = Callable[[dict[str, Any]], None]


class EventBus:
    def __init__(self, history: int = 400) -> None:
        self._lock = threading.Lock()
        self._handlers: list[EventHandler] = []
        self._history: deque[dict[str, Any]] = deque(maxlen=history)

    def subscribe(self, handler: EventHandler) -> Callable[[], None]:
        with self._lock:
            self._handlers.append(handler)

        def unsubscribe() -> None:
            with self._lock:
                if handler in self._handlers:
                    self._handlers.remove(handler)

        return unsubscribe

    def publish(self, event: dict[str, Any]) -> None:
        event.setdefault("ts", time.time())
        with self._lock:
            self._history.append(event)
            handlers = list(self._handlers)
        for handler in handlers:
            try:
                handler(event)
            except Exception:  # pragma: no cover - defensive
                log.exception("event handler failed for %s", event.get("type"))

    def recent(self, kind: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            events = list(self._history)
        if kind is not None:
            events = [event for event in events if event.get("type") == kind]
        return events[-limit:]
