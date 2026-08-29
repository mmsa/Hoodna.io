"""Localized notification copy keyed by user locale."""

from __future__ import annotations

from typing import Any

SUPPORTED = frozenset({"en", "ar"})

_MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "verification_approved_title": "Verification Approved",
        "verification_approved_body": "Your account has been verified. You can now post, comment, and create listings in your community.",
        "verification_rejected_title": "Verification Rejected",
        "verification_rejected_body": "Your verification documents were rejected.",
        "verification_more_title": "More Information Needed",
        "verification_more_body": "We need more information to verify your account.",
        "new_message_title": "New message from {name}",
        "new_message_body": "You received a new message from {name}.",
        "new_message_preview": ' "{preview}"',
        "listing_inquiry_title": "New inquiry for {title}",
        "listing_inquiry_body": "{name} is interested in your listing.",
        "listing_saved_title": "Someone saved your listing",
        "listing_saved_body": "{name} saved “{title}”.",
        "comment_title": "New comment on your post",
        "comment_body": "{name} commented: “{preview}”",
        "post_like_title": "{name} reacted to your post",
        "post_like_body": "{name} reacted to your post.",
        "new_post_title": "New post in your compound",
        "new_post_body": "{name} shared: “{preview}”",
        "new_listing_title": "New marketplace listing",
        "new_listing_body": "{name} listed “{title}”.",
        "rejection_reason": " Reason: {reason}",
        "more_details": " {details}",
    },
    "ar": {
        "verification_approved_title": "تمت الموافقة على التحقق",
        "verification_approved_body": "تم التحقق من حسابك. يمكنك الآن النشر والتعليق وإنشاء الإعلانات في مجتمعك.",
        "verification_rejected_title": "تم رفض التحقق",
        "verification_rejected_body": "تم رفض مستندات التحقق الخاصة بك.",
        "verification_more_title": "مطلوب مزيد من المعلومات",
        "verification_more_body": "نحتاج مزيدًا من المعلومات للتحقق من حسابك.",
        "new_message_title": "رسالة جديدة من {name}",
        "new_message_body": "تلقيت رسالة جديدة من {name}.",
        "new_message_preview": ' "{preview}"',
        "listing_inquiry_title": "استفسار جديد عن {title}",
        "listing_inquiry_body": "{name} مهتم بإعلانك.",
        "listing_saved_title": "شخص حفظ إعلانك",
        "listing_saved_body": "حفظ {name} «{title}».",
        "comment_title": "تعليق جديد على منشورك",
        "comment_body": "علّق {name}: «{preview}»",
        "post_like_title": "تفاعل {name} مع منشورك",
        "post_like_body": "تفاعل {name} مع منشورك.",
        "new_post_title": "منشور جديد في مجمعك",
        "new_post_body": "شارك {name}: «{preview}»",
        "new_listing_title": "إعلان جديد في السوق",
        "new_listing_body": "أضاف {name} «{title}».",
        "rejection_reason": " السبب: {reason}",
        "more_details": " {details}",
    },
}


def normalize_locale(locale: str | None) -> str:
    if not locale:
        return "en"
    base = locale.lower().split("-")[0]
    return base if base in SUPPORTED else "en"


def notification_text(locale: str | None, key: str, **kwargs: Any) -> str:
    lang = normalize_locale(locale)
    template = _MESSAGES[lang].get(key) or _MESSAGES["en"][key]
    return template.format(**kwargs)
