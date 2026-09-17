# config.py
"""
Central config for Competitor Monitor.

Keep this file *import-safe*: do not import app modules here (scraper, main, etc.)
to avoid circular imports. Only import stdlib + os.
"""


from dotenv import load_dotenv
import os

load_dotenv()



# --- Competitors ------------------------------------------------------------
# Small-scale OSS & indie apps (safe defaults; edit freely)
COMPETITORS = []

# --- NSFW filtering ---------------------------------------------------------
# Simple substring match against domain. Extend as needed.
NSFW_KEYWORDS = ["porn", "adult", "xxx", "sex", "nsfw"]

# Optional allowlist: exact domains you want to permit even if substring match
NSFW_ALLOWLIST = []  # e.g., ["example.com"]

# --- Behavior flags ---------------------------------------------------------
ALWAYS_NOTIFY = True               # send Discord even if no changes (good for testing)
MAX_LINES_PER_COMPETITOR = 50      # safety trim before diffing

# --- Secrets via env --------------------------------------------------------
DISCORD_WEBHOOK = os.getenv("DISCORD_WEBHOOK")
GROQ_API_KEY  = os.getenv("GROQ_API_KEY")

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b",
)