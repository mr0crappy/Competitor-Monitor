from app.storage import snapshots


def test_save_and_load_snapshot(tmp_path):
    snapshots.DATA_DIR = tmp_path

    data = ["A", "B", "C"]

    snapshots.save_snapshot("test", data)

    result = snapshots.load_snapshot("test")

    assert result == data


def test_missing_snapshot_returns_empty_list(tmp_path):
    snapshots.DATA_DIR = tmp_path

    result = snapshots.load_snapshot("does-not-exist")

    assert result == []