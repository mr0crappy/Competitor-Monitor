from pathlib import Path
import json


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"


def load_snapshot(key):
    path = DATA_DIR / f"{key}.json"

    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_snapshot(key, url, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    path = DATA_DIR / f"{key}.json"

    snapshot = {
        "url": url,
        "data": data,
    }

    with path.open("w", encoding="utf-8") as file:
        json.dump(snapshot, file, indent=2)

def delete_snapshot(key):
    path = DATA_DIR / f"{key}.json"

    if path.exists():
        path.unlink()
        return True

    return False