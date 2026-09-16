# config.py
"""
Central config for Competitor Monitor.

Keep this file *import-safe*: do not import app modules here (scraper, main, etc.)
to avoid circular imports. Only import stdlib + os.
"""

import os

# --- Competitors ------------------------------------------------------------
# Small-scale OSS & indie apps (safe defaults; edit freely)
COMPETITORS = [
    # Small / indie OSS
    {"name": "Plausible Analytics", "changelog": "https://plausible.io/changelog"},
    {"name": "Ackee",               "changelog": "https://github.com/electerious/Ackee/releases"},
    {"name": "Cal.com",             "changelog": "https://cal.com/changelog"},
    {"name": "Umami Analytics",     "changelog": "https://umami.is/changelog"},
    {"name": "Directus",            "changelog": "https://directus.io/releases"},

    # Indie SaaS / productivity
    {"name": "Height",              "changelog": "https://height.app/changelog"},
    {"name": "Tability",            "changelog": "https://tability.io/changelog"},
    {"name": "Cron",                "changelog": "https://cron.com/changelog"},
    {"name": "Reflect Notes",       "changelog": "https://reflect.app/changelog"},
    {"name": "Superlist",           "changelog": "https://superlist.com/changelog"},
]

# --- NSFW filtering ---------------------------------------------------------
# Simple substring match against domain. Extend as needed.
NSFW_KEYWORDS = ["porn", "adult", "xxx", "sex", "nsfw"]

# Optional allowlist: exact domains you want to permit even if substring match
NSFW_ALLOWLIST = []  # e.g., ["example.com"]

# --- Behavior flags ---------------------------------------------------------
ALWAYS_NOTIFY = True               # send Slack even if no changes (good for testing)
MAX_LINES_PER_COMPETITOR = 50      # safety trim before diffing

# --- Secrets via env --------------------------------------------------------
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY")
