from app.storage import snapshots


def test_save_and_load_snapshot(tmp_path):
    snapshots.DATA_DIR = tmp_path

    data = ["A", "B", "C"]
    url = "https://example.com/changelog"

    snapshots.save_snapshot("test", url, data)

    result = snapshots.load_snapshot("test")

    assert result["url"] == url
    assert result["data"] == data


def test_missing_snapshot_returns_none(tmp_path):
    snapshots.DATA_DIR = tmp_path

    result = snapshots.load_snapshot("does-not-exist")

    assert result is None
def test_delete_snapshot(tmp_path):
    snapshots.DATA_DIR = tmp_path

    snapshots.save_snapshot(
        "test",
        "https://example.com/changelog",
        ["A", "B"]
    )

    assert snapshots.load_snapshot("test") is not None

    result = snapshots.delete_snapshot("test")

    assert result is True
    assert snapshots.load_snapshot("test") is None