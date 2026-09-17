from app.notifications.discord import send_discord


def test_discord_message_is_split(monkeypatch):
    sent_messages = []

    def fake_post(url, json, timeout):
        sent_messages.append(json["content"])

        class Response:
            def raise_for_status(self):
                pass

        return Response()

    monkeypatch.setattr(
        "app.notifications.discord.requests.post",
        fake_post,
    )

    message = "A" * 4500

    result = send_discord(
        message,
        "https://discord.test/webhook"
    )

    assert result is True
    assert len(sent_messages) == 3
    assert all(len(chunk) <= 2000 for chunk in sent_messages)