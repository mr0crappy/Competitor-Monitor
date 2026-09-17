from pathlib import Path
import json
from urllib.parse import urlparse

from app import config


class CompetitorStore:
    def __init__(self, data_file=None):
        self.data_file = (
            Path(data_file)
            if data_file
            else Path("data") / "competitors.json"
        )

        self.competitors = []
        self._load()

    def _load(self):
        if self.data_file.exists():
            with self.data_file.open("r", encoding="utf-8") as file:
                self.competitors = json.load(file)
            return

        self._seed_from_config()
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

    def _seed_from_config(self):
        self.competitors = []

        competitor_id = 1

        for competitor in config.COMPETITORS:
            name = competitor.get("name")
            changelog = competitor.get("changelog", "")

            if not name:
                continue

            if self._is_nsfw_url(changelog):
                continue

            self.competitors.append({
                "id": competitor_id,
                "name": name,
                "changelog": changelog,
                "description": competitor.get("description", ""),
                "status": "active",
                "lastUpdate": None,
                "changesDetected": 0,
            })

            competitor_id += 1

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

    def add(self, name, changelog, description=""):
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
        status=None,
    ):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        competitor["name"] = name
        competitor["changelog"] = changelog

        if description is not None:
            competitor["description"] = description

        if status is not None:
            competitor["status"] = status

        self._save()

        return competitor

    def delete(self, competitor_id):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        self.competitors.remove(competitor)
        self._save()

        return competitor