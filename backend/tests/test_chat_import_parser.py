"""Tests for WhatsApp/Telegram chat import parsers."""
import json

from app.models.enums import ChatImportItemKind, ChatImportSource
from app.services.chat_import_parser import (
    classify_message,
    detect_and_parse_bytes,
    normalize_phone,
    parse_telegram_json,
    parse_whatsapp_text,
    summarize_parsed,
)


WHATSAPP_SAMPLE = """\
[1/15/26, 10:01:22 AM] +20 100 123 4567: Anyone know a good plumber?
[1/15/26, 10:05:11 AM] Sara Ali: Selling kids bike, 1500 EGP, barely used
[1/15/26, 10:06:00 AM] Sara Ali: <Media omitted>
[1/15/26, 10:07:33 AM] +201112223344: For rent: studio in building B, 12k monthly
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
            "date": "2026-01-15T10:05:11",
            "from": "Nour",
            "text": [
                "Selling ",
                {"type": "bold", "text": "iPhone 13"},
                " for 18000 EGP",
            ],
        },
        {
            "id": 3,
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


def test_parse_whatsapp_text():
    messages = parse_whatsapp_text(WHATSAPP_SAMPLE)
    assert len(messages) == 4
    assert messages[0].phone == "201001234567"
    assert "plumber" in messages[0].text.lower()
    parsed = detect_and_parse_bytes(WHATSAPP_SAMPLE.encode("utf-8"), "chat.txt")
    assert parsed.source == ChatImportSource.WHATSAPP
    stats = summarize_parsed(parsed)
    assert stats["users"] >= 2
    assert stats["posts"] >= 1
    assert stats["listings"] >= 2
    assert stats["skipped"] >= 1


def test_parse_telegram_json():
    messages = parse_telegram_json(TELEGRAM_SAMPLE)
    assert len(messages) == 2
    assert "Lost keys" in messages[0].text
    assert "iPhone 13" in messages[1].text
    parsed = detect_and_parse_bytes(
        json.dumps(TELEGRAM_SAMPLE).encode("utf-8"),
        "result.json",
        ChatImportSource.TELEGRAM,
    )
    assert parsed.source == ChatImportSource.TELEGRAM
    stats = summarize_parsed(parsed)
    assert stats["posts"] >= 1
    assert stats["listings"] >= 1
