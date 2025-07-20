import requests

def fetch_changelog(url):
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (Competitor Monitor)"})
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.exceptions.SSLError:
        print(f"SSL error with {url}. Trying with less strict verification...")
        return session.get(url, verify=False).text  # Not recommended for production
