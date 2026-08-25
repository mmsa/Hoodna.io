"""Fetch lightweight Open Graph metadata for feed link previews."""

from __future__ import annotations

import re
from html import unescape
from typing import Any
from urllib.parse import urlparse

import httpx

_META_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']([^"\']+)["\'][^>]+content=["\']([^"\']*)["\'][^>]*>|'
    r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']([^"\']+)["\'][^>]*>',
    re.IGNORECASE,
)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})"
)

# Simple in-process cache (per worker). Enough to avoid refetching on feed scroll.
_CACHE: dict[str, dict[str, Any]] = {}
_CACHE_MAX = 256


def _normalize_url(url: str) -> str | None:
    value = (url or "").strip()
    if not value:
        return None
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    # Block obvious local/metadata targets
    host = parsed.hostname or ""
    if host in ("localhost", "127.0.0.1", "0.0.0.0") or host.endswith(".local"):
        return None
    return value


def _classify(url: str) -> str:
    host = (urlparse(url).hostname or "").replace("www.", "").lower()
    if host == "youtu.be" or host.endswith("youtube.com"):
        return "youtube"
    if host.endswith("facebook.com") or host.endswith("fb.watch") or host == "fb.com":
        return "facebook"
    if host.endswith("tiktok.com") or host in ("vm.tiktok.com", "vt.tiktok.com"):
        return "tiktok"
    if host.endswith("instagram.com"):
        return "instagram"
    if host in ("x.com", "t.co") or host.endswith("twitter.com"):
        return "twitter"
    return "generic"


def _site_label(kind: str, host: str) -> str:
    return {
        "youtube": "YouTube",
        "facebook": "Facebook",
        "tiktok": "TikTok",
        "instagram": "Instagram",
        "twitter": "X",
    }.get(kind, host)


def _youtube_thumb(url: str) -> str | None:
    match = _YOUTUBE_ID_RE.search(url)
    if not match:
        return None
    return f"https://img.youtube.com/vi/{match.group(1)}/hqdefault.jpg"


def _parse_meta(html: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for match in _META_RE.finditer(html):
        if match.group(1) and match.group(2) is not None:
            key, value = match.group(1), match.group(2)
        else:
            value, key = match.group(3) or "", match.group(4) or ""
        key = key.strip().lower()
        value = unescape(value.strip())
        if key and value and key not in found:
            found[key] = value
    title_match = _TITLE_RE.search(html)
    if title_match and "title" not in found:
        found["title"] = unescape(re.sub(r"\s+", " ", title_match.group(1)).strip())
    return found


def _fallback(url: str, kind: str) -> dict[str, Any]:
    host = (urlparse(url).hostname or "").replace("www.", "")
    image = _youtube_thumb(url) if kind == "youtube" else None
    return {
        "url": url,
        "title": _site_label(kind, host),
        "description": "Open link",
        "image": image,
        "site_name": _site_label(kind, host),
        "kind": kind,
    }


async def fetch_link_preview(url: str) -> dict[str, Any]:
    normalized = _normalize_url(url)
    if not normalized:
        raise ValueError("Invalid URL")

    if normalized in _CACHE:
        return _CACHE[normalized]

    kind = _classify(normalized)
    host = (urlparse(normalized).hostname or "").replace("www.", "")
    preview = _fallback(normalized, kind)

    # Platforms that usually block server-side scrapers — keep branded fallback.
    # (Facebook/IG oEmbed require Meta app tokens; share links often can't embed.)
    if kind in ("facebook", "tiktok", "instagram"):
        label = _site_label(kind, host)
        preview["title"] = f"Watch on {label}" if kind in ("facebook", "tiktok") else f"Open on {label}"
        preview["description"] = "Opens in the app or browser"
        preview["site_name"] = label
        _CACHE[normalized] = preview
        return preview

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=4.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; eljiran-link-preview/1.0; +https://eljiran.io)"
                ),
                "Accept": "text/html,application/xhtml+xml",
            },
        ) as client:
            response = await client.get(normalized)
            if response.status_code >= 400:
                _CACHE[normalized] = preview
                return preview
            html = response.text[:250_000]
            meta = _parse_meta(html)
            title = (
                meta.get("og:title")
                or meta.get("twitter:title")
                or meta.get("title")
            )
            description = (
                meta.get("og:description")
                or meta.get("twitter:description")
                or meta.get("description")
            )
            image = (
                meta.get("og:image")
                or meta.get("twitter:image")
                or meta.get("twitter:image:src")
            )
            site_name = meta.get("og:site_name") or _site_label(kind, host)
            if title:
                preview["title"] = title[:200]
            if description:
                preview["description"] = description[:280]
            if image:
                preview["image"] = image
            elif kind == "youtube":
                preview["image"] = _youtube_thumb(normalized)
            preview["site_name"] = site_name
    except Exception:
        # Keep fallback card
        pass

    if len(_CACHE) >= _CACHE_MAX:
        _CACHE.clear()
    _CACHE[normalized] = preview
    return preview
