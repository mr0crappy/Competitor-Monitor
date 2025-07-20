import os
from scraper import is_nsfw_url

COMPETITORS = [
    {"name": "GitHub", "changelog": "https://github.blog/changelog/"},
    {"name": "Notion", "changelog": "https://www.notion.so/releases"},
]

VALID_COMPETITORS = [
    c for c in COMPETITORS if not is_nsfw_url(c["changelog"])
]

if len(VALID_COMPETITORS) < len(COMPETITORS):
    print(f"[WARNING] {len(COMPETITORS) - len(VALID_COMPETITORS)} NSFW competitor(s) removed.")


# ------------------------------------------------------------------
# Competitors to monitor
# Add more dicts to this list. Each needs a name + changelog URL.
# ------------------------------------------------------------------
COMPETITORS = [
    {
        "name": "GitHub",
        "changelog": "https://github.blog/changelog/",
        # optional fields you can use later:
        # "parser": "html",   # or "rss", "json", etc.
        # "allow_insecure": False,
    },
    # Example to add later:
    # {
    #     "name": "YourApp",
    #     "changelog": "https://yourapp.com/updates",
    #     "parser": "html",
    # }
]

NSFW_KEYWORDS = [
    "porn", "adult", "xxx", "sex", "nsfw"
]

# ------------------------------------------------------------------
# Integration settings (read from environment)
# Set these in GitHub Secrets or your local shell before running.
# ------------------------------------------------------------------
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")      # required
GROQ_API_KEY  = os.getenv("GROQ_API_KEY")       # optional but needed for Groq summaries

# ------------------------------------------------------------------
# Behavior flags
# ------------------------------------------------------------------
ALWAYS_NOTIFY = True               # send Slack message even when no changes (good for testing)
MAX_LINES_PER_COMPETITOR = 50      # trim noisy pages before diffing (prevents huge Slack posts)
