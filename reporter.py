import requests
import json

# ----------------------
# Send message to Slack
# ----------------------
def send_slack(message, webhook_url):
    try:
        if not webhook_url:
            print("[WARN] No Slack webhook URL configured.")
            return
        resp = requests.post(webhook_url, json={"text": message})
        if resp.status_code != 200:
            print(f"[ERROR] Slack webhook failed: {resp.status_code} - {resp.text}")
        else:
            print("[INFO] Message sent to Slack.")
    except Exception as e:
        print(f"[ERROR] Failed to send Slack message: {e}")

# ----------------------
# Send message to Notion
# ----------------------
def send_notion(message, notion_token, notion_db_id):
    try:
        if not notion_token or not notion_db_id:
            print("[WARN] Notion token or database ID not configured.")
            return

        url = "https://api.notion.com/v1/pages"
        headers = {
            "Authorization": f"Bearer {notion_token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }

        data = {
            "parent": {"database_id": notion_db_id},
            "properties": {
                "Title": {
                    "title": [
                        {"text": {"content": "Competitor Update"}}
                    ]
                }
            },
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"text": {"content": message}}]
                    }
                }
            ]
        }

        resp = requests.post(url, headers=headers, data=json.dumps(data))
        if resp.status_code != 200:
            print(f"[ERROR] Notion API failed: {resp.status_code} - {resp.text}")
        else:
            print("[INFO] Message sent to Notion.")

    except Exception as e:
        print(f"[ERROR] Failed to send Notion message: {e}")
