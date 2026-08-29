"""Tests for WhatsApp/Telegram chat import parsers."""
import json

from app.models.enums import ChatImportItemKind, ChatImportSource
from app.services.chat_import_parser import (
    _sender_display,
    classify_message,
    detect_and_parse_bytes,
    extract_phones_from_text,
    is_placeholder_import_phone,
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


def test_parse_import_timestamp_preserves_wall_clock():
    from app.services.chat_import_parser import parse_import_timestamp

    ts = parse_import_timestamp("1/15/26 10:01:22 AM")
    assert ts is not None
    assert ts.year == 2026
    assert ts.month == 1
    assert ts.day == 15
    assert ts.hour == 10
    assert ts.minute == 1
    assert ts.tzinfo is not None


def test_whatsapp_normalized_includes_created_at():
    parsed = detect_and_parse_bytes(WHATSAPP_SAMPLE.encode("utf-8"), "chat.txt")
    content_items = [i for i in parsed.items if i["kind"] != "USER"]
    assert any(i["normalized"].get("created_at") for i in content_items)


def test_classify_message():
    assert classify_message("Selling sofa 5000 EGP") == ChatImportItemKind.LISTING
    assert classify_message("Anyone seen my cat?") == ChatImportItemKind.POST
    assert classify_message("<Media omitted>") == ChatImportItemKind.SKIP
    assert classify_message("شقة للبيع في المرحلة الثالثة") == ChatImportItemKind.LISTING
    assert (
        classify_message(
            "255m Duplex with Garden 100m overlooking Landscape available for Sale"
        )
        == ChatImportItemKind.LISTING
    )
    # System noise
    assert (
        classify_message("You joined using a group link") == ChatImportItemKind.SKIP
    )
    assert (
        classify_message("~ رضا الديب created this group") == ChatImportItemKind.SKIP
    )
    assert (
        classify_message("I turned on admin approval to join this group")
        == ChatImportItemKind.SKIP
    )
    assert classify_message("السلام عليكم ورحمة الله وبركاته") == ChatImportItemKind.SKIP
    assert classify_message("مساء الخير") == ChatImportItemKind.SKIP
    # Community costs / service asks are posts, not listings
    assert (
        classify_message("تكلفة صرف المطر 3000 جنيه للواحدة")
        == ChatImportItemKind.POST
    )
    assert (
        classify_message("نعمل صندوق شارع كل عمارة تدفع 200 جنيه")
        == ChatImportItemKind.POST
    )
    assert (
        classify_message("Anyone know a good plumber?") == ChatImportItemKind.POST
    )
    # Buyer / wanted enquiries must NOT become listings
    assert (
        classify_message("Anyone has a fully finished penthouse in VGK for RENT?")
        == ChatImportItemKind.POST
    )
    assert (
        classify_message(
            "صباح الخير، في واحد صديقي عايز يشتري شقه ٣ نوم، لو حد عنده شقه للبيع ياريت يتواصل معايا"
        )
        == ChatImportItemKind.POST
    )
    assert (
        classify_message(
            "صباح الخير حد عنده شقة ارضي بجنينه للإيجار او حد يعرف حد ممكن يأجرها"
        )
        == ChatImportItemKind.POST
    )
    assert (
        classify_message(
            "حد يعرف شقة ارضي بجنينه للبيع او رقم سمسار كويس"
        )
        == ChatImportItemKind.POST
    )
    assert (
        classify_message("What if i already paid the money long time ago?")
        == ChatImportItemKind.POST
    )
    assert classify_message("looking to buy a 3 bedroom apartment") == ChatImportItemKind.POST
    assert classify_message("Yes I do plz send me ur email") == ChatImportItemKind.POST
    assert (
        classify_message(
            "im not using the bathroom, as soon as i do, the ducts leak all over the place"
        )
        == ChatImportItemKind.POST
    )
    assert (
        classify_message("كلمنا و دفعنا ١٠ آلاف جنيه ثمن العداد")
        == ChatImportItemKind.POST
    )


def test_infer_post_category():
    from app.services.chat_import_parser import infer_post_category

    assert infer_post_category("Anyone know a good plumber?") == "HELP"
    assert infer_post_category("Anyone has a penthouse for rent?") == "HELP"
    assert infer_post_category("Lost keys near gate 3") == "LOST_FOUND"
    assert infer_post_category("نعمل صندوق شارع") == "DISCUSSION"


def test_sender_display_never_phone():
    assert _sender_display("+20 100 123 4567", "201001234567") == "Neighbour"
    assert _sender_display("Sara Ali", "201001234567") == "Sara Ali"
    assert "100" not in _sender_display("+201001234567", "201001234567")


def test_redact_phones():
    text = redact_phones("Call me on 01001234567 please")
    assert "01001234567" not in text
    assert "hidden" in text.lower()


def test_extract_phones_from_membership_text():
    phones = extract_phones_from_text("+20 114 412 3448 added ~🌷")
    assert "201144123448" in phones
    phones = extract_phones_from_text("+20 111 450 5640 added +33 6 34 07 35 01")
    assert "201114505640" in phones
    assert "33634073501" in phones


def test_never_invent_placeholder_phones():
    assert is_placeholder_import_phone("900123456789")
    assert normalize_phone("900123456789") is None
    parsed = detect_and_parse_bytes(
        b"[1/15/26, 10:01:22 AM] Sara Ali: Hello neighbours\n",
        "chat.txt",
    )
    for user in parsed.users:
        phone = user["normalized"].get("phone")
        assert phone is None or not is_placeholder_import_phone(phone)


def test_membership_body_phones_become_users():
    """Phones listed only in join/add system lines must be imported (not invented)."""
    sample = """\
[22/07/2023, 13:30:15] +33 6 34 07 35 01: +20 111 450 5640 added +33 6 34 07 35 01
[18/12/2024, 02:54:40] ~🌷: +20 114 412 3448 added ~🌷
[1/15/26, 10:01:22 AM] Sara Ali: Anyone know a good plumber?
"""
    parsed = detect_and_parse_bytes(sample.encode("utf-8"), "chat.txt")
    phones = {
        u["normalized"]["phone"]
        for u in parsed.users
        if u["normalized"].get("phone")
    }
    assert "33634073501" in phones
    assert "201114505640" in phones
    assert "201144123448" in phones
    # Name-only sender stays without an invented phone
    sara = next(
        u
        for u in parsed.users
        if u["normalized"].get("name") == "Sara Ali"
    )
    assert sara["normalized"].get("phone") is None


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
