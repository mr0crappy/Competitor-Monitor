from scraper import *
from diff_detector import *
from summarizer import *
from reporter import *
import config

def run():
    all_changes = {}
    for comp in config.COMPETITORS:
        raw = fetch_changelog(comp["changelog"])
        old = load_snapshot(comp["name"])
        new = raw.splitlines()
        diff = compute_diff(old, new)
        if diff:
            all_changes[comp["name"]] = diff
        save_snapshot(comp["name"], new)
    if all_changes:
        summary = summarize_all(all_changes)
        if config.SLACK_WEBHOOK:
            send_slack(summary, config.SLACK_WEBHOOK)
        if config.NOTION_TOKEN:
            send_notion(summary, config.NOTION_TOKEN, config.NOTION_DB_ID)

if __name__ =="__main__":
    run()
