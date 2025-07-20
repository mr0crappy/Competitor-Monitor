import requests

def fetch_changelog(url):
    headers = {"User-Agent": "Mozilla/5.0 (Competitor Monitor)"}
    
    try:
        # First attempt (strict SSL)
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.text
    except requests.exceptions.SSLError:
        print(f"[Warning] SSL handshake failed for {url}, retrying with verify=False...")
        try:
            # Fallback attempt (ignore SSL verification)
            resp = requests.get(url, headers=headers, verify=False, timeout=15)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            print(f"[Error] SSL fallback also failed for {url}: {e}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"[Error] Failed to fetch {url}: {e}")
        return None
