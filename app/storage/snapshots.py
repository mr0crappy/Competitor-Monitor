import json
import os

from pathlib import Path


DATA_DIR = Path("data")


def load_snapshot(key):
    path = DATA_DIR / f"{key}.json"

    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_snapshot(key, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    path = DATA_DIR / f"{key}.json"

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)