from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..container import Container

log = logging.getLogger(__name__)

router = APIRouter()


async def _sender(websocket: WebSocket, queue: asyncio.Queue[dict[str, Any]]) -> None:
    while True:
        event = await queue.get()
        await websocket.send_json(event)


async def _receiver(websocket: WebSocket) -> None:
    async for text in websocket.iter_text():
        if text == "ping":
            await websocket.send_json({"type": "pong"})


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    container: Container = websocket.app.state.container
    await websocket.accept()
    queue = container.hub.register()
    sender = asyncio.create_task(_sender(websocket, queue))
    receiver = asyncio.create_task(_receiver(websocket))
    try:
        status = container.manager.status()
        await websocket.send_json(
            {
                "type": "hello",
                "hardware": status["hardware"],
                "simulated": status["simulated"],
                "mockMode": status["mockMode"],
                "devices": status["devices"],
                "runtime": container.runtime.status(),
            }
        )
        done, pending = await asyncio.wait(
            {sender, receiver}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        for task in done:
            error = task.exception()
            if error is not None and not isinstance(error, WebSocketDisconnect):
                log.debug("websocket task ended: %s", error)
    except WebSocketDisconnect:
        pass
    finally:
        container.hub.unregister(queue)
        sender.cancel()
        receiver.cancel()
