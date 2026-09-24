from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings


def test_health_reports_mock_simulation(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "ArduDeck"
    assert body["hardware"]["state"] == "ready"
    assert body["simulated"] is True
    assert body["arduinoCli"]["available"] is False
    assert body["platform"]["python"]


def test_hardware_endpoint_lists_devices(client: TestClient) -> None:
    body = client.get("/api/hardware").json()
    assert body["ok"] is True
    assert body["simulated"] is True
    assert isinstance(body["devices"], list)


def test_watch_rejects_unknown_pins(client: TestClient) -> None:
    response = client.post("/api/hardware/watch", json={"watches": [{"pin": "D0"}]})
    assert response.status_code == 400
    assert "D0" in response.json()["error"]["message"]


def test_runtime_start_and_stop(
    client: TestClient, golden_program: dict[str, Any], wait
) -> None:
    start = client.post("/api/runtime/start", json={"program": golden_program})
    assert start.status_code == 200
    assert start.json()["runtime"]["running"] is True

    client.post("/api/runtime/mock-value", json={"pin": "A0", "value": 100})

    def rule_is_true() -> bool:
        status = client.get("/api/runtime/status").json()["runtime"]
        return status["rules"].get("cond_less") is True

    assert wait(rule_is_true)
    status = client.get("/api/runtime/status").json()["runtime"]
    assert status["mode"] == "simulated"
    assert abs(status["values"]["sensor_light"]["value"] - 100) <= 25

    stop = client.post("/api/runtime/stop")
    assert stop.status_code == 200
    assert stop.json()["runtime"]["running"] is False


def test_runtime_rejects_a_broken_flow(client: TestClient) -> None:
    response = client.post("/api/runtime/start", json={"program": {"version": 1}})
    assert response.status_code == 400
    assert "condition" in response.json()["error"]["message"]


def test_deploy_without_hardware_is_explained(
    client: TestClient, golden_sketch: str
) -> None:
    response = client.post(
        "/api/deploy", json={"name": "Light project", "code": golden_sketch}
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["message"] == "Connect your Arduino to start."


def test_bridge_install_without_hardware_is_explained(client: TestClient) -> None:
    response = client.post("/api/hardware/install-bridge")
    assert response.status_code == 409


def test_project_crud(client: TestClient) -> None:
    flow = {"version": 1, "id": "flow_1", "name": "Light", "nodes": [], "edges": []}
    saved = client.put(
        "/api/projects/flow_1", json={"name": "Light project", "flow": flow}
    )
    assert saved.status_code == 200
    assert saved.json()["project"]["name"] == "Light project"

    listed = client.get("/api/projects").json()["projects"]
    assert [project["id"] for project in listed] == ["flow_1"]

    fetched = client.get("/api/projects/flow_1").json()["project"]
    assert fetched["flow"]["name"] == "Light"

    deleted = client.delete("/api/projects/flow_1")
    assert deleted.status_code == 200
    assert client.get("/api/projects/flow_1").status_code == 404


def test_project_with_unreadable_flow_is_reported(client: TestClient, settings: Settings) -> None:
    import sqlite3

    connection = sqlite3.connect(settings.data_dir / "ardudeck.db")
    connection.execute(
        "INSERT INTO projects (id, name, updated_at, flow_json) VALUES (?, ?, ?, ?)",
        ("broken", "Broken", "2024-01-01T00:00:00Z", "{oops"),
    )
    connection.commit()
    connection.close()

    project = client.get("/api/projects/broken").json()["project"]
    assert project["malformed"] is True
    assert project["flow"] is None


def test_teacher_logs_and_system(client: TestClient) -> None:
    system = client.get("/api/teacher/system").json()["system"]
    assert system["app"]["version"]
    assert "hardware" in system
    assert system["bridge"]["sketch"]

    logs = client.get("/api/teacher/logs", params={"kind": "events", "lines": 10})
    assert logs.status_code == 200
    assert isinstance(logs.json()["lines"], list)


def test_unknown_endpoint_is_a_clean_404(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404


def test_websocket_greets_with_hardware_state(client: TestClient) -> None:
    with client.websocket_connect("/ws") as websocket:
        hello = websocket.receive_json()
        assert hello["type"] == "hello"
        assert hello["hardware"]["state"] == "ready"
        assert hello["simulated"] is True
