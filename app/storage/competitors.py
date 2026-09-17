from app import config


class CompetitorStore:

    def __init__(self):
        self.competitors = []

        self._load_initial_competitors()

    def _load_initial_competitors(self):
        self.competitors = []

        for index, competitor in enumerate(config.COMPETITORS, start=1):
            self.competitors.append({
                "id": index,
                "name": competitor["name"],
                "changelog": competitor["changelog"],
            })

    def get_all(self):
        return self.competitors

    def get_by_id(self, competitor_id):
        for competitor in self.competitors:
            if competitor["id"] == competitor_id:
                return competitor

        return None

    def add(self, name, changelog):
        next_id = max(
            [c["id"] for c in self.competitors],
            default=0
        ) + 1

        competitor = {
            "id": next_id,
            "name": name,
            "changelog": changelog,
        }

        self.competitors.append(competitor)

        return competitor

    def update(self, competitor_id, name, changelog):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        competitor["name"] = name
        competitor["changelog"] = changelog

        return competitor

    def delete(self, competitor_id):
        competitor = self.get_by_id(competitor_id)

        if competitor is None:
            return None

        self.competitors.remove(competitor)

        return competitor