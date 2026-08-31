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


def test_uk_mobile_not_treated_as_egypt():
    assert normalize_phone("+447539673391") == "447539673391"
    assert normalize_phone("+44 7539 673391") == "447539673391"
    assert normalize_phone("00447539673391") == "447539673391"
    # No country code → do not invent +20 (or +44)
    assert normalize_phone("07539673391") != "207539673391"
    cands = phone_lookup_candidates("+447539673391")
    assert "447539673391" in cands
    assert "07539673391" in cands
    # Chat import used to map UK 07… to +20 because it looked like 01…
    assert "207539673391" in cands


def test_any_country_code_is_kept():
    assert normalize_phone("+33 6 34 07 35 01") == "33634073501"
    assert normalize_phone("+971 50 123 4567") == "971501234567"
    assert normalize_phone("+1 415 555 2671") == "14155552671"
    assert normalize_phone("+966 50 123 4567") == "966501234567"


def test_placeholder_rejected():
    assert is_placeholder_import_phone("900123456789")
    assert normalize_phone("900123456789") is None


def test_format_display():
    assert format_phone_display("201001234567") == "+201001234567"
