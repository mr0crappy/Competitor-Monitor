from scraper import *
from diff_detector import *
from summarizer import *
from reporter import *
import config
from urllib.parse import urlparse
from config import NSFW_KEYWORDS

def is_nsfw_url(url: str) -> bool:
    """Check if a URL is flagged as NSFW based on keywords."""
    domain = urlparse(url).netloc.lower()
    for keyword in NSFW_KEYWORDS:
        if keyword in domain:
            return True
    return False


def run(return_changes=False):
    all_changes = {}
    for comp in config.COMPETITORS:
        raw = fetch_changelog(comp["changelog"])
        if raw is None:
            print(f"[Skipped] Could not fetch changelog for {comp['name']}.")
            continue
        old = load_snapshot(comp["name"])
        new = raw.splitlines()
        diff = compute_diff(old, new)
        if diff:
            all_changes[comp["name"]] = diff
        save_snapshot(comp["name"], new)
    if return_changes:
        return all_changes
    if all_changes:
        summary = summarize_all(all_changes)
        if config.SLACK_WEBHOOK:
            send_slack(summary, config.SLACK_WEBHOOK)


if __name__ == "__main__":
    print("[DEBUG] Starting Competitor Monitor...")
    try:
        run()
    except Exception as e:
        import traceback
        print("[ERROR] Uncaught exception:")
        traceback.print_exc()
        exit(0)  # Prevents GitHub Actions failure
