from app import config
from app.notifications.summarizer import summarize_all
from app.notifications.discord import send_discord


class NotificationService:

    def notify(self, changes):
        if not changes:
            print("[INFO] No changes detected. Skipping notification.")
            return False

        summary = summarize_all(changes)

        if not config.DISCORD_WEBHOOK:
            print("[WARN] No Discord webhook configured")
            return False

        return send_discord(
            summary,
            config.DISCORD_WEBHOOK
        )