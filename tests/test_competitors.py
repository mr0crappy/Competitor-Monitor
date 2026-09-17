from app.storage.competitors import CompetitorStore


def test_store_seeds_from_config(tmp_path):
    data_file = tmp_path / "competitors.json"

    store = CompetitorStore(data_file)

    assert len(store.get_all()) > 0
    assert data_file.exists()


def test_add_persists(tmp_path):
    data_file = tmp_path / "competitors.json"

    store = CompetitorStore(data_file)

    competitor = store.add(
        "Test Competitor",
        "https://example.com/changelog",
    )

    new_store = CompetitorStore(data_file)

    assert new_store.get_by_id(competitor["id"]) is not None


def test_update_persists(tmp_path):
    data_file = tmp_path / "competitors.json"

    store = CompetitorStore(data_file)

    competitor = store.add(
        "Test Competitor",
        "https://example.com/changelog",
    )

    store.update(
        competitor["id"],
        "Updated Competitor",
        "https://example.com/new-changelog",
    )

    new_store = CompetitorStore(data_file)

    updated = new_store.get_by_id(competitor["id"])

    assert updated["name"] == "Updated Competitor"
    assert updated["changelog"] == "https://example.com/new-changelog"


def test_delete_persists(tmp_path):
    data_file = tmp_path / "competitors.json"

    store = CompetitorStore(data_file)

    competitor = store.add(
        "Test Competitor",
        "https://example.com/changelog",
    )

    store.delete(competitor["id"])

    new_store = CompetitorStore(data_file)

    assert new_store.get_by_id(competitor["id"]) is None