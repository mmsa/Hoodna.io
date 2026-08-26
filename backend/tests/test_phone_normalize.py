"""Tests for shared phone normalization (OTP + chat import)."""

from app.utils.phone import (
    format_phone_display,
    is_placeholder_import_phone,
    normalize_phone,
    phone_lookup_candidates,
)


def test_egyptian_local_to_country_code():
    assert normalize_phone("01001234567") == "201001234567"
    assert normalize_phone("+20 100 123 4567") == "201001234567"
    assert normalize_phone("201001234567") == "201001234567"
    assert normalize_phone("00201001234567") == "201001234567"


def test_otp_lookup_candidates_include_legacy_local():
    cands = phone_lookup_candidates("01001234567")
    assert "201001234567" in cands
    assert "01001234567" in cands


def test_placeholder_rejected():
    assert is_placeholder_import_phone("900123456789")
    assert normalize_phone("900123456789") is None


def test_format_display():
    assert format_phone_display("201001234567") == "+201001234567"
