"""Tests for compound demo seed helpers."""
from app.services.compound_demo import (
    DEFAULT_COMPOUND_SLUG,
    demo_email,
    demo_email_pattern,
    get_demo_listings,
    get_demo_posts,
    get_demo_users,
    is_demo_email,
)


def test_demo_email_format():
    email = demo_email("palm-hills-katameya", "sara")
    assert email == "sara@palm-hills-katameya.demo.hoodna.io"
    assert is_demo_email(email)
    assert not is_demo_email("real@example.com")


def test_demo_email_pattern_scoped():
    assert demo_email_pattern("palm-hills-katameya") == "%@palm-hills-katameya.demo.hoodna.io"


def test_demo_email_pattern_all():
    assert demo_email_pattern(None) == "%.demo.hoodna.io"


def test_default_compound_slug():
    assert DEFAULT_COMPOUND_SLUG == "palm-hills-katameya"


def test_demo_content_counts():
    assert len(get_demo_users()) == 5
    assert len(get_demo_listings("Palm Hills Katameya")) == 9
    assert len(get_demo_posts("Palm Hills Katameya")) == 8


def test_demo_users_have_avatar_urls():
    for user in get_demo_users():
        assert user.avatar_url.startswith("https://")


def test_demo_listings_have_image_urls():
    listings = get_demo_listings("Palm Hills Katameya")
    assert all(listing.image_urls for listing in listings)
    service_listings = [
        listing for listing in listings if listing.category.value == "SERVICE"
    ]
    assert len(service_listings) == 2
    assert all(len(listing.image_urls) >= 2 for listing in service_listings)
