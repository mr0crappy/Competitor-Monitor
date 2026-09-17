import requests


USER_AGENT = (
    "Mozilla/5.0 "
    "(Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 "
    "(KHTML, like Gecko) "
    "Chrome/120.0 Safari/537.36"
)

TIMEOUT = 15


def fetch_changelog(url):
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
        )

        response.raise_for_status()
        response.encoding = response.apparent_encoding

        return response.text

    except requests.RequestException as error:
        print(f"[ERROR] Request failed for {url}: {error}")
        return None