from slack_sdk.webhook import WebhookClient

def send_slack(text, url):
    client = WebhookClient(url)
    resp = client.send(text=text)
    resp.raise_for_status()
