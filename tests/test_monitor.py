from app.monitor.service import MonitorService
from app.storage import snapshots


def test_url_change_creates_new_baseline(tmp_path, monkeypatch):
    snapshots.DATA_DIR = tmp_path

    service = MonitorService()

    competitor = {
        "id": 1,
        "name": "Test",
        "changelog": "https://new.example.com/changelog",
        "status": "active",
        "source_type": "generic",
    }

    old_url = "https://old.example.com/changelog"

    snapshot_key = service.competitor_store.get_snapshot_key(1)

    snapshots.save_snapshot(
        snapshot_key,
        old_url,
        ["Old change"]
    )

    monkeypatch.setattr(
        "app.monitor.service.fetch_changelog",
        lambda url: "<html><main><p>New change</p></main></html>"
    )

    changes = service.check_competitor(competitor)

    assert changes == []

    snapshot = snapshots.load_snapshot(snapshot_key)

    assert snapshot["url"] == competitor["changelog"]
    assert "New change" in snapshot["data"]