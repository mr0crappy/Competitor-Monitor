import requests


TIMEOUT = 10
MAX_MESSAGE_LENGTH = 2000


def send_discord(message, webhook_url):
    if not webhook_url:
        print("[WARN] No Discord webhook configured")
        return False

    chunks = [
        message[i:i + MAX_MESSAGE_LENGTH]
        for i in range(0, len(message), MAX_MESSAGE_LENGTH)
    ]

    try:
        for chunk in chunks:
            response = requests.post(
                webhook_url,
                json={"content": chunk},
                timeout=TIMEOUT,
            )

            response.raise_for_status()

        print("[INFO] Discord notification sent")
        return True

    except requests.RequestException as error:
        print(
            f"[ERROR] Failed to send Discord notification: "
            f"{error}"
        )
        return False