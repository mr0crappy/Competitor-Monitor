import requests

def send_slack(message, webhook_url):
    if not webhook_url:
        print("[WARN] No Slack webhook URL configured; skipping Slack send.")
        return
    try:
        resp = requests.post(webhook_url, json={"text": message})
        if resp.status_code != 200:
            print(f"[ERROR] Slack webhook failed: {resp.status_code} - {resp.text}")
        else:
            print("[INFO] Message sent to Slack.")
    except Exception as e:
        print(f"[ERROR] Failed to send Slack message: {e}")
