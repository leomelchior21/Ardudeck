from __future__ import annotations

import sqlite3

import pytest

from app.config import Settings
from app.projects import ProjectStore


def test_saves_and_reloads_a_project(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    flow = {"version": 1, "id": "flow_1", "name": "Light project", "nodes": [], "edges": []}
    saved = store.save({"id": "flow_1", "name": "Light project", "flow": flow})
    assert saved["name"] == "Light project"
    assert saved["malformed"] is False
    assert saved["flow"]["id"] == "flow_1"

    loaded = store.get("flow_1")
    assert loaded is not None
    assert loaded["flow"]["name"] == "Light project"


def test_overwrites_and_lists_newest_first(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    store.save({"id": "a", "name": "First", "flow": {"nodes": [{"id": "n1"}], "edges": []}})
    store.save({"id": "b", "name": "Second", "flow": {"nodes": [], "edges": []}})
    store.save({"id": "a", "name": "First renamed", "flow": {"nodes": [], "edges": []}})

    projects = store.list()
    assert [project["id"] for project in projects] == ["a", "b"]
    assert projects[0]["name"] == "First renamed"
    assert projects[0]["nodeCount"] == 0


def test_list_includes_blocks_and_version(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    flow = {
        "version": 1,
        "nodes": [
            {"id": "s", "componentId": "ldr", "config": {"pins": {"signal": "A0"}, "fields": {}}},
            {
                "id": "c",
                "componentId": "lessThan",
                "config": {"pins": {}, "fields": {"value": 300}},
            },
            {"id": "a", "componentId": "led", "config": {"pins": {"signal": "D9"}, "fields": {}}},
            {"id": "a2", "componentId": "led", "config": {"pins": {"signal": "D10"}, "fields": {}}},
        ],
        "edges": [],
    }
    store.save({"id": "flow_1", "name": "Light", "flow": flow})

    summary = store.list()[0]
    assert summary["version"] == 1
    assert summary["nodeCount"] == 4
    assert [component["id"] for component in summary["components"]] == [
        "ldr",
        "lessThan",
        "led",
    ]
    assert summary["components"][0]["pin"] == "A0"
    assert summary["components"][1]["value"] == 300


def test_reports_a_malformed_row_instead_of_crashing(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    connection = sqlite3.connect(settings.data_dir / "ardudeck.db")
    connection.execute(
        "INSERT INTO projects (id, name, updated_at, flow_json) VALUES (?, ?, ?, ?)",
        ("broken", "Broken", "2024-01-01T00:00:00Z", "{not json"),
    )
    connection.commit()
    connection.close()

    project = store.get("broken")
    assert project is not None
    assert project["malformed"] is True
    assert project["flow"] is None

    summaries = store.list()
    assert summaries[0]["id"] == "broken"
    assert summaries[0]["nodeCount"] == 0


def test_rejects_invalid_saves(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    with pytest.raises(ValueError):
        store.save({"id": "x", "name": "No flow", "flow": None})
    with pytest.raises(ValueError):
        store.save({"id": "", "name": "No id", "flow": {"nodes": [], "edges": []}})


def test_deletes(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    store.save({"id": "a", "name": "A", "flow": {"nodes": [], "edges": []}})
    assert store.delete("a") is True
    assert store.delete("a") is False
    assert store.get("a") is None


def test_deployment_status_is_kept(settings: Settings) -> None:
    store = ProjectStore(settings.data_dir)
    store.save(
        {
            "id": "a",
            "name": "A",
            "flow": {"nodes": [], "edges": []},
            "deployedAt": "2024-05-05T10:00:00Z",
        }
    )
    loaded = store.get("a")
    assert loaded is not None
    assert loaded["deployedAt"] == "2024-05-05T10:00:00Z"
    assert store.list()[0]["deployedAt"] == "2024-05-05T10:00:00Z"
