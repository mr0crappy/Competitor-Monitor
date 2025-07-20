# main.py
"""
Run a competitor monitoring pass.
- fetch changelogs
- compute diffs vs snapshot
- summarize (Groq or fallback)
- send Slack
"""

import os
from urllib.parse import urlparse

import config
from scraper import fetch_changelog
from diff_detector import load_snapshot, save_snapshot, compute_diff
from summarizer import summarize_all
from reporter import send_slack


# --- NSFW guard -------------------------------------------------------------
def is_nsfw_url(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    # Allowlist wins
    if any(allow.lower() in host for allow in config.NSFW_ALLOWLIST):
        return False
    for kw in config.NSFW_KEYWORDS:
        if kw in host:
            return True
    return False


def get_valid_competitors():
    """Return competitor list with NSFW domains removed."""
    valid = []
    removed = []
    for comp in config.COMPETITORS:
        url = comp.get("changelog") or ""
        if is_nsfw_url(url):
            removed.append(comp)
            continue
        valid.append(comp)
    if removed:
        print(f"[NSFW] Skipped {len(removed)} competitor(s): "
              + ", ".join(c["name"] for c in removed))
    return valid


# --- Core runner ------------------------------------------------------------
def run(return_changes: bool = False):
    """
    Execute one monitoring pass.
    return_changes=True -> return dict {name: [diff lines]}
    """
    comps = get_valid_competitors()
    if not comps:
        print("[WARN] No valid competitors to check.")
        if return_changes:
            return {}
        return

    all_changes = {}

    for comp in comps:
        name = comp["name"]
        url = comp["changelog"]
        print(f"[INFO] Checking {name}: {url}")

        raw = fetch_changelog(url)
        if raw is None:
            print(f"[Skipped] Could not fetch changelog for {name}.")
            continue

        # snapshot + diff
        old = load_snapshot(name)
        new = raw.splitlines()
        diff = compute_diff(old, new)

        if diff:
            print(f"[INFO] {len(diff)} new line(s) for {name}.")
            all_changes[name] = diff
        else:
            print(f"[INFO] No new lines for {name}.")

        save_snapshot(name, new)

    # Summarize + notify
    if all_changes or config.ALWAYS_NOTIFY:
        summary = summarize_all(all_changes)
        if config.SLACK_WEBHOOK:
            send_slack(summary, config.SLACK_WEBHOOK)
        else:
            print("[WARN] No SLACK_WEBHOOK configured; skipping Slack send.")
    else:
        print("[INFO] No changes detected; Slack suppressed (ALWAYS_NOTIFY=False).")

    if return_changes:
        return all_changes
