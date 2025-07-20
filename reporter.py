import requests

def send_slack(message, webhook_url):
    try:
        resp = requests.post(webhook_url, json={"text": message})
        resp.raise_for_status()
        print("[INFO] Message sent to Slack.")
    except Exception as e:
        print(f"[ERROR] Failed to send Slack message: {e}")
