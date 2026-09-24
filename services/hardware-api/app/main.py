"""ArduDeck hardware API application factory.

In production this process also serves the built UI, so the whole appliance
talks to exactly one origin: http://localhost:8080
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import api_router
from .config import Settings, load_settings
from .container import build_container
from .errors import ApiError
from .hardware import HardwareError
from .logging_setup import setup_logging
from .runtime import IrError

log = logging.getLogger(__name__)

NOT_BUILT_PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>ArduDeck</title>
<style>
  body { background:#f6f8fa; color:#0e2233; font-family: system-ui, sans-serif;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  main { max-width: 560px; padding: 24px; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  code { background:#e8eef4; padding: 2px 6px; border-radius: 6px; }
</style></head>
<body><main>
  <h1>ArduDeck API is running</h1>
  <p>The screen has not been built yet. Build it with:</p>
  <p><code>npm install &amp;&amp; npm run build</code></p>
  <p>Then reload this page. The API itself is fine: <a href="/api/health">/api/health</a></p>
</main></body></html>
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()
    log_file = setup_logging(resolved.log_dir)
    container = build_container(resolved, log_file)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        container.hub.bind(asyncio.get_running_loop())
        container.manager.start()
        log.info("ArduDeck API %s ready (mock mode: %s)", resolved.app_version, resolved.mock_mode)
        try:
            yield
        finally:
            log.info("ArduDeck API shutting down")
            container.runtime.stop()
            container.manager.stop()

    app = FastAPI(
        title="ArduDeck",
        version=resolved.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.container = container
    app.include_router(api_router)

    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(HardwareError)
    async def handle_hardware_error(_: Request, exc: HardwareError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"ok": False, "error": {"message": str(exc), "code": "hardware"}},
        )

    @app.exception_handler(IrError)
    async def handle_ir_error(_: Request, exc: IrError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": {"message": str(exc), "code": "invalid-flow"}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {
                    "message": "Something went wrong inside ArduDeck.",
                    "code": "internal",
                    "hint": "Try again. If it keeps happening, open Teacher Mode for details.",
                },
            },
        )

    index = resolved.ui_dist / "index.html"
    if index.exists():
        app.mount("/", StaticFiles(directory=str(resolved.ui_dist), html=True), name="ui")
    else:
        @app.get("/", response_class=HTMLResponse)
        def not_built() -> str:
            return NOT_BUILT_PAGE

    return app


app = create_app()


def main() -> None:  # pragma: no cover - convenience entry point
    import uvicorn

    settings = load_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level="info",
    )


if __name__ == "__main__":  # pragma: no cover
    main()
