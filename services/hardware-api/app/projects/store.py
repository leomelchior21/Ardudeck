"""Local project storage on SQLite.

No accounts, no cloud, no network. WAL mode plus a single transaction per save
means a power cut cannot corrupt the file, and a row that somehow ends up
unreadable is reported as "could not be opened" instead of crashing the app.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deployed_at TEXT,
  flow_json TEXT NOT NULL,
  code TEXT
);
CREATE INDEX IF NOT EXISTS projects_updated_at ON projects (updated_at DESC);
"""


def _components(nodes: list[Any]) -> list[dict[str, Any]]:
    """Compact list of blocks in a flow, for the project cards.

    Only the component id, first chosen pin and any comparison value are kept:
    the UI resolves names and icons from the shared component registry.
    """
    seen: set[str] = set()
    components: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        component_id = node.get("componentId")
        if not isinstance(component_id, str) or component_id in seen:
            continue
        seen.add(component_id)
        config = node.get("config")
        config = config if isinstance(config, dict) else {}
        pins = config.get("pins")
        pins = pins if isinstance(pins, dict) else {}
        pin = next((value for value in pins.values() if isinstance(value, str)), None)
        fields = config.get("fields")
        fields = fields if isinstance(fields, dict) else {}
        value = fields.get("value")
        entry: dict[str, Any] = {"id": component_id}
        if pin:
            entry["pin"] = pin
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            entry["value"] = value
        components.append(entry)
    return components


class ProjectStore:
    def __init__(self, data_dir: Path) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        self._path = data_dir / "ardudeck.db"
        self._lock = threading.Lock()
        self._init()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=5.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _init(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(SCHEMA)

    # ------------------------------------------------------------------ reads

    def list(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                "SELECT id, name, updated_at, deployed_at, flow_json FROM projects "
                "ORDER BY updated_at DESC"
            ).fetchall()
        summaries: list[dict[str, Any]] = []
        for row in rows:
            node_count = 0
            version = 1
            components: list[dict[str, Any]] = []
            try:
                flow = json.loads(row["flow_json"])
                if isinstance(flow, dict):
                    nodes = flow.get("nodes")
                    if isinstance(nodes, list):
                        node_count = len(nodes)
                        components = _components(nodes)
                    flow_version = flow.get("version")
                    if isinstance(flow_version, int):
                        version = flow_version
            except (json.JSONDecodeError, TypeError):
                node_count = 0
            summary: dict[str, Any] = {
                "id": row["id"],
                "name": row["name"],
                "updatedAt": row["updated_at"],
                "nodeCount": node_count,
                "version": version,
                "components": components,
            }
            if row["deployed_at"]:
                summary["deployedAt"] = row["deployed_at"]
            summaries.append(summary)
        return summaries

    def get(self, project_id: str) -> dict[str, Any] | None:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM projects WHERE id = ?", (project_id,)
            ).fetchone()
        if row is None:
            return None
        return self._row_to_project(row)

    def _row_to_project(self, row: sqlite3.Row) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": row["id"],
            "name": row["name"],
            "updatedAt": row["updated_at"],
            "deployedAt": row["deployed_at"],
            "code": row["code"],
        }
        try:
            payload["flow"] = json.loads(row["flow_json"])
            payload["malformed"] = False
        except (json.JSONDecodeError, TypeError):
            payload["flow"] = None
            payload["malformed"] = True
        return payload

    # ----------------------------------------------------------------- writes

    def save(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = payload.get("id")
        if not isinstance(project_id, str) or not project_id.strip():
            raise ValueError("A project needs an id.")
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            name = "Untitled project"
        flow = payload.get("flow")
        if isinstance(flow, str):
            try:
                json.loads(flow)
            except json.JSONDecodeError as exc:
                raise ValueError("This project could not be saved.") from exc
            flow_json = flow
        elif isinstance(flow, dict):
            flow_json = json.dumps(flow)
        else:
            raise ValueError("This project could not be saved.")

        code = payload.get("code")
        code_value = code if isinstance(code, str) else None
        deployed_at = payload.get("deployedAt")
        deployed_value = deployed_at if isinstance(deployed_at, str) else None
        updated_at = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + "Z"

        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO projects (id, name, updated_at, deployed_at, flow_json, code)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  updated_at = excluded.updated_at,
                  deployed_at = COALESCE(excluded.deployed_at, projects.deployed_at),
                  flow_json = excluded.flow_json,
                  code = COALESCE(excluded.code, projects.code)
                """,
                (project_id, name.strip(), updated_at, deployed_value, flow_json, code_value),
            )

        saved = self.get(project_id)
        if saved is None:  # pragma: no cover - the row was just written
            raise ValueError("This project could not be saved.")
        return saved

    def delete(self, project_id: str) -> bool:
        with self._lock, self._connect() as connection:
            cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            return cursor.rowcount > 0
