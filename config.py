# Add your competitors and APIs here
COMPETITORS = [
    {
        "name": "GitHub",
        "changelog": "https://github.blog/changelog/"
    }
]


# These will come from environment variables set in GitHub Secrets
import os
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DB_ID = os.getenv("NOTION_DB_ID")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
