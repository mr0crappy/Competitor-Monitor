from urllib.parse import urlparse

from app import config

from app.monitor.scraper import fetch_changelog
from app.monitor.diff import compute_diff
from app.storage.snapshots import load_snapshot, save_snapshot
from app.notifications.service import NotificationService
from app.storage.competitors import CompetitorStore
from app.monitor.normalizer import normalize_changelog


class MonitorService:

    def __init__(self):
        self.competitor_store = CompetitorStore()
        self.notification_service = NotificationService()

    def is_nsfw_url(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()

        # Allowlist wins
        if any(
            allow.lower() in host
            for allow in config.NSFW_ALLOWLIST
        ):
            return False

        return any(
            keyword in host
            for keyword in config.NSFW_KEYWORDS
        )

    def get_valid_competitors(self):
        competitors = self.competitor_store.get_all()

        return [
            competitor
            for competitor in competitors
            if competitor.get("status") == "active"
            and not self.is_nsfw_url(competitor.get("changelog", ""))
        ]

    def check_competitor(self, competitor):
        name = competitor["name"]
        competitor_id = competitor["id"]
        url = competitor["changelog"]

        print(f"[INFO] Checking {name}: {url}")

        raw = fetch_changelog(url)

        if raw is None:
            print(f"[WARN] Could not fetch {name}")
            return None

        snapshot_key = self.competitor_store.get_snapshot_key(competitor_id)

        if snapshot_key is None:
            return []

        snapshot = load_snapshot(snapshot_key)

        if snapshot is None:
            print(
                f"[INFO] No snapshot found for {name}. "
                "Creating baseline."
            )

            new = normalize_changelog(
                raw,
                url,
                competitor.get("source_type", "generic")
            )

            save_snapshot(
                snapshot_key,
                url,
                new
            )

            return []

        elif snapshot["url"] != url:
            print(
            f"[INFO] URL changed for {name}. "
            "Creating a new baseline."
            )

            new = normalize_changelog(
                raw,
                url,
                competitor.get("source_type", "generic")
            )

            save_snapshot(
                snapshot_key,
                url,
                new
            )

            return []

        else:
            old = snapshot["data"]

        new = normalize_changelog(
            raw,
            url,
            competitor.get("source_type", "generic")
        )

        diff = compute_diff(old, new)

        save_snapshot(
            snapshot_key,
            url,
            new
        )

        return diff

    def run(self):
        all_changes = {}

        competitors = self.get_valid_competitors()

        for competitor in competitors:
            name = competitor["name"]

            try:
                changes = self.check_competitor(competitor)

                if changes:
                    all_changes[name] = changes
                    print(
                        f"[INFO] {len(changes)} new line(s) "
                        f"for {name}"
                    )
                else:
                    print(
                        f"[INFO] No new lines for {name}"
                    )

            except Exception as error:
                print(
                    f"[ERROR] Failed to check "
                    f"{name}: {error}"
                )

        self.notification_service.notify(all_changes)

        return all_changes