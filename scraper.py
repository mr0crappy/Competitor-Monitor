import requests, feedparser

COMPETITORS = [
    {"name": "Acme", "changelog": "https://acme.com/changelog"},
    # Add competitors here
]

def fetch_changelog(url):
    resp = requests.get(url); resp.raise_for_status()
    return resp.text  # Customize per site (HTML, RSS, etc.)

def fetch_rss_feed(url):
    return [e.title + "\n" + e.summary for e in feedparser.parse(url).entries]
