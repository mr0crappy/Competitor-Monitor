from pathlib import Path
import json
from urllib.parse import urlparse
import hashlib

from app import config
from app.storage.snapshots import delete_snapshot

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"


class CompetitorStore:
    def __init__(self, data_file=None):
        self.data_file = (
            Path(data_file)
            if data_file
            else DATA_DIR / "competitors.json"
        )

        self.competitors = []
        self._load()

    def _load(self):
        if self.data_file.exists():
            with self.data_file.open("r", encoding="utf-8") as file:
                self.competitors = json.load(file)
        return

        self.competitors = []
        self._save()

    def _save(self):
        self.data_file.parent.mkdir(parents=True, exist_ok=True)

        with self.data_file.open("w", encoding="utf-8") as file:
            json.dump(self.competitors, file, indent=2)

    def _is_nsfw_url(self, url):
        try:
            host = urlparse(url).netloc.lower()
            return any(keyword in host for keyword in config.NSFW_KEYWORDS)
        except Exception:
            return False

    

    def get_all(self):
        return self.competitors

    def get_by_id(self, competitor_id):
        return next(
            (
                competitor
                for competitor in self.competitors
                if competitor["id"] == competitor_id
            ),
            None,
        )

    def add(self, name, changelog, description="", source_type = "generic"):
        new_id = max(
            (competitor["id"] for competitor in self.competitors),
            default=0,
        ) + 1

        competitor = {
            "id": new_id,
            "name": name,
            "changelog": changelog,
            "description": description,
            "status": "active",
            "lastUpdate": None,
            "changesDetected": 0,
            "source_type": source_type,
        }

        self.competitors.append(competitor)
        self._save()

        return competitor

    def update(
    self,
    competitor_id,
    name,
    changelog,
    description=None,
    source_type=None,
    status=None,
):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        old_changelog = competitor["changelog"]

        competitor["name"] = name
        competitor["changelog"] = changelog

        if description is not None:
            competitor["description"] = description

        if source_type is not None:
            competitor["source_type"] = source_type

        if status is not None:
            competitor["status"] = status

        self._save()

        return competitor

    def delete(self, competitor_id):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        snapshot_key = self.get_snapshot_key(competitor_id)

        self.competitors.remove(competitor)
        self._save()

        if snapshot_key:
            delete_snapshot(snapshot_key)

        return competitor

    def get_snapshot_key(self, competitor_id):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        identity = f"{competitor['name']}|{competitor['changelog']}".lower()

        return hashlib.sha256(
            identity.encode("utf-8")
        ).hexdigest()[:16]