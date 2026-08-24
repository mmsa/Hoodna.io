"""Tests for WhatsApp/Telegram chat import parsers."""
import json

from app.models.enums import ChatImportItemKind, ChatImportSource
from app.services.chat_import_parser import (
    _sender_display,
    classify_message,
    detect_and_parse_bytes,
    normalize_phone,
    parse_telegram_json,
    parse_whatsapp_text,
    redact_phones,
    summarize_parsed,
)


WHATSAPP_SAMPLE = """\
[1/15/26, 10:01:22 AM] +20 100 123 4567: Anyone know a good plumber?
[1/15/26, 10:05:11 AM] Sara Ali: Try Ahmed near gate 2
[1/15/26, 10:05:40 AM] Sara Ali: Selling kids bike, 1500 EGP, barely used
[1/15/26, 10:06:00 AM] Sara Ali: <Media omitted>
[1/15/26, 10:07:33 AM] +201112223344: For rent: studio in building B, 12k monthly
[1/15/26, 11:00:00 AM] Omar Hassan: شقة للبيع في المرحلة الثالثة سعر كويس
"""

WHATSAPP_THREAD = """\
[1/15/26, 10:01:22 AM] Sara Ali: Anyone know a good plumber?
[1/15/26, 10:02:11 AM] +20 100 123 4567: Try Ahmed near gate 2
[1/15/26, 10:03:00 AM] Omar Hassan: I used Karim last week, good prices
"""


TELEGRAM_SAMPLE = {
    "messages": [
        {
            "id": 1,
            "type": "message",
            "date": "2026-01-15T10:01:22",
            "from": "Omar",
            "from_id": "user123",
            "text": "Lost keys near gate 3",
        },
        {
            "id": 2,
            "type": "message",
            "date": "2026-01-15T10:02:00",
            "from": "Nour",
            "reply_to_message_id": 1,
            "text": "I think I saw them at security",
        },
        {
            "id": 3,
            "type": "message",
            "date": "2026-01-15T10:05:11",
            "from": "Nour",
            "text": [
                "Selling ",
                {"type": "bold", "text": "iPhone 13"},
                " for 18000 EGP",
            ],
        },
        {
            "id": 4,
            "type": "service",
            "actor": "System",
            "text": "created group",
        },
    ]
}


def test_normalize_egyptian_phone():
    assert normalize_phone("+20 100 123 4567") == "201001234567"
    assert normalize_phone("01001234567") == "201001234567"
    assert normalize_phone("1001234567") == "201001234567"


def test_classify_message():
    assert classify_message("Selling sofa 5000 EGP") == ChatImportItemKind.LISTING
    assert classify_message("Anyone seen my cat?") == ChatImportItemKind.POST
    assert classify_message("<Media omitted>") == ChatImportItemKind.SKIP
    assert classify_message("شقة للبيع في المرحلة الثالثة") == ChatImportItemKind.LISTING


def test_sender_display_never_phone():
    assert _sender_display("+20 100 123 4567", "201001234567") == "Neighbour"
    assert _sender_display("Sara Ali", "201001234567") == "Sara Ali"
    assert "100" not in _sender_display("+201001234567", "201001234567")


def test_redact_phones():
    text = redact_phones("Call me on 01001234567 please")
    assert "01001234567" not in text
    assert "hidden" in text.lower()


def test_parse_whatsapp_text():
    messages = parse_whatsapp_text(WHATSAPP_SAMPLE)
    assert len(messages) == 6
    assert messages[0].phone == "201001234567"
    assert "plumber" in messages[0].text.lower()
    parsed = detect_and_parse_bytes(WHATSAPP_SAMPLE.encode("utf-8"), "chat.txt")
    assert parsed.source == ChatImportSource.WHATSAPP
    # Phone-only senders must not become public names
    for user in parsed.users:
        assert user["normalized"]["name"] != user["normalized"]["phone"]
        assert not str(user["normalized"]["name"]).replace(" ", "").isdigit()
    stats = summarize_parsed(parsed)
    assert stats["users"] >= 2
    assert stats["posts"] >= 1
    assert stats["listings"] >= 2
    assert stats["skipped"] >= 1


def test_whatsapp_threads_parent_then_comments():
    parsed = detect_and_parse_bytes(WHATSAPP_THREAD.encode("utf-8"), "chat.txt")
    kinds = [item["kind"] for item in parsed.items]
    assert ChatImportItemKind.POST.value in kinds
    assert ChatImportItemKind.COMMENT.value in kinds
    posts = [i for i in parsed.items if i["kind"] == ChatImportItemKind.POST.value]
    comments = [i for i in parsed.items if i["kind"] == ChatImportItemKind.COMMENT.value]
    assert len(posts) == 1
    assert len(comments) >= 1
    parent_idx = posts[0]["normalized"]["message_index"]
    for comment in comments:
        assert comment["normalized"]["parent_message_index"] == parent_idx
        # Public author name is never the raw phone
        assert comment["normalized"]["name"] == "Neighbour" or not str(
            comment["normalized"]["name"]
        ).startswith("+")


def test_parse_telegram_json():
    messages = parse_telegram_json(TELEGRAM_SAMPLE)
    assert len(messages) == 3
    assert "Lost keys" in messages[0].text
    assert messages[1].reply_to_id == 1
    parsed = detect_and_parse_bytes(
        json.dumps(TELEGRAM_SAMPLE).encode("utf-8"),
        "result.json",
        ChatImportSource.TELEGRAM,
    )
    assert parsed.source == ChatImportSource.TELEGRAM
    stats = summarize_parsed(parsed)
    assert stats["posts"] >= 1
    assert stats["comments"] >= 1
    assert stats["listings"] >= 1
    comment = next(
        i for i in parsed.items if i["kind"] == ChatImportItemKind.COMMENT.value
    )
    assert comment["normalized"]["parent_message_index"] == 0
