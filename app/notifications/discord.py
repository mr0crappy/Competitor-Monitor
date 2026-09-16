import requests


TIMEOUT = 10


def send_discord(message, webhook_url):
    if not webhook_url:
        print("[WARN] No Discord webhook configured")
        return False

    payload = {
        "content": message
    }

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=TIMEOUT,
        )

        response.raise_for_status()

        print("[INFO] Discord notification sent")
        return True

    except requests.RequestException as error:
        print(f"[ERROR] Failed to send Discord notification: {error}")
        return False