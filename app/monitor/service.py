from urllib.parse import urlparse

from app import config

from app.monitor.scraper import fetch_changelog
from app.monitor.diff import compute_diff
from app.storage.snapshots import load_snapshot, save_snapshot
from app.notifications.summarizer import summarize_all
from app.notifications.discord import send_discord


class MonitorService:

    def __init__(self):
        self.competitors = config.COMPETITORS

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
        valid = []

        for competitor in self.competitors:
            url = competitor.get("changelog", "")

            if self.is_nsfw_url(url):
                continue

            valid.append(competitor)

        return valid

    def check_competitor(self, competitor):
        name = competitor["name"]
        url = competitor["changelog"]

        print(f"[INFO] Checking {name}: {url}")

        raw = fetch_changelog(url)

        if raw is None:
            print(f"[WARN] Could not fetch {name}")
            return None

        old = load_snapshot(competitor["id"])
        new = raw.splitlines()

        diff = compute_diff(old, new)

        save_snapshot(competitor["id"], new)

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

        if all_changes or config.ALWAYS_NOTIFY:
            summary = summarize_all(all_changes)

            if config.DISCORD_WEBHOOK:
                send_discord(
                    summary,
                    config.DISCORD_WEBHOOK
                )
            else:
                print(
                    "[WARN] No Discord webhook configured"
                )

        return all_changes