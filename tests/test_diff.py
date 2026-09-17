from app.monitor.diff import compute_diff


def test_no_changes():
    old = ["A", "B"]
    new = ["A", "B"]

    assert compute_diff(old, new) == []


def test_detects_new_items():
    old = ["A", "B"]
    new = ["A", "B", "C"]

    assert compute_diff(old, new) == ["C"]


def test_preserves_order():
    old = ["B"]
    new = ["C", "A", "B", "D"]

    assert compute_diff(old, new) == ["C", "A", "D"]


def test_empty_old_snapshot():
    old = []
    new = ["A", "B"]

    assert compute_diff(old, new) == ["A", "B"]


def test_empty_new_snapshot():
    old = ["A", "B"]
    new = []

    assert compute_diff(old, new) == []