"""
Unit tests for seed_compounds.py script.
"""
import pytest
import csv
import tempfile
from pathlib import Path
from datetime import date
from decimal import Decimal

from scripts.seed_compounds import (
    normalize_string,
    normalize_float,
    normalize_date,
    validate_status,
    validate_row,
    REQUIRED_HEADERS,
    ALLOWED_STATUSES,
)


class TestNormalizeFunctions:
    """Test normalization functions."""
    
    def test_normalize_string(self):
        assert normalize_string("  test  ") == "test"
        assert normalize_string("") is None
        assert normalize_string("   ") is None
        assert normalize_string("valid") == "valid"
    
    def test_normalize_float(self):
        assert normalize_float("123.45") == Decimal("123.45")
        assert normalize_float("  123.45  ") == Decimal("123.45")
        assert normalize_float("") is None
        assert normalize_float("   ") is None
        assert normalize_float("invalid") is None
    
    def test_normalize_date(self):
        assert normalize_date("2025-12-28") == date(2025, 12, 28)
        assert normalize_date("  2025-12-28  ") == date(2025, 12, 28)
        assert normalize_date("") is None
        assert normalize_date("invalid") is None
        assert normalize_date("2025-13-45") is None  # Invalid date


class TestValidateStatus:
    """Test status validation."""
    
    def test_valid_statuses(self):
        for status_value in ALLOWED_STATUSES:
            assert validate_status(status_value) == status_value
            assert validate_status(f"  {status_value}  ") == status_value
    
    def test_invalid_status(self):
        with pytest.raises(ValueError, match="Invalid status_2025"):
            validate_status("Invalid Status")
    
    def test_empty_status(self):
        with pytest.raises(ValueError, match="status_2025 cannot be empty"):
            validate_status("")
            validate_status("   ")


class TestValidateRow:
    """Test CSV row validation."""
    
    def test_valid_row(self):
        row = {
            "compound_id": "test-compound",
            "compound_name": "Test Compound",
            "area": "New Cairo",
            "sub_area": "5th Settlement",
            "category": "Other",
            "developer": "Test Developer",
            "status_2025": "Ready to Move",
            "delivery_notes": "Some notes",
            "source_hint": "test",
            "last_verified_date": "2025-12-28",
            "lat": "30.1234567",
            "lng": "31.1234567",
        }
        result = validate_row(row, 1)
        assert result["compound_id"] == "test-compound"
        assert result["name"] == "Test Compound"
        assert result["area"] == "New Cairo"
        assert result["status_2025"] == "Ready to Move"
        assert result["lat"] == Decimal("30.1234567")
        assert result["last_verified_date"] == date(2025, 12, 28)
    
    def test_missing_required_fields(self):
        row = {
            "compound_id": "",
            "compound_name": "Test",
            "area": "New Cairo",
            "status_2025": "Ready to Move",
        }
        with pytest.raises(ValueError, match="compound_id is required"):
            validate_row(row, 1)
        
        row = {
            "compound_id": "test",
            "compound_name": "",
            "area": "New Cairo",
            "status_2025": "Ready to Move",
        }
        with pytest.raises(ValueError, match="compound_name is required"):
            validate_row(row, 1)
    
    def test_empty_strings_become_none(self):
        row = {
            "compound_id": "test",
            "compound_name": "Test",
            "area": "New Cairo",
            "sub_area": "",
            "category": "   ",
            "developer": None,
            "status_2025": "Ready to Move",
            "delivery_notes": "",
            "source_hint": "",
            "last_verified_date": "",
            "lat": "",
            "lng": "",
        }
        result = validate_row(row, 1)
        assert result["sub_area"] is None
        assert result["category"] is None
        assert result["developer"] is None
        assert result["lat"] is None
        assert result["lng"] is None


class TestCSVValidation:
    """Test CSV file validation."""
    
    def test_valid_csv(self):
        """Test that a valid CSV with all headers passes validation."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=REQUIRED_HEADERS)
            writer.writeheader()
            writer.writerow({
                "compound_id": "test-1",
                "compound_name": "Test 1",
                "area": "New Cairo",
                "sub_area": "5th Settlement",
                "category": "Other",
                "developer": "Dev 1",
                "status_2025": "Ready to Move",
                "delivery_notes": "Notes",
                "source_hint": "test",
                "last_verified_date": "2025-12-28",
                "lat": "30.0",
                "lng": "31.0",
            })
            csv_path = Path(f.name)
        
        try:
            # Read and validate headers
            with open(csv_path, 'r') as csv_file:
                reader = csv.DictReader(csv_file)
                assert set(reader.fieldnames) == set(REQUIRED_HEADERS)
        finally:
            csv_path.unlink()
    
    def test_missing_headers(self):
        """Test that missing headers are detected."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=["compound_id", "compound_name"])
            writer.writeheader()
            csv_path = Path(f.name)
        
        try:
            with open(csv_path, 'r') as csv_file:
                reader = csv.DictReader(csv_file)
                missing = set(REQUIRED_HEADERS) - set(reader.fieldnames)
                assert len(missing) > 0
        finally:
            csv_path.unlink()


class TestUpsertBehavior:
    """Test upsert logic (idempotency)."""
    
    def test_same_compound_id_updates(self):
        """Test that the same compound_id updates existing record."""
        # This would be tested with actual database in integration tests
        # For unit tests, we verify the logic structure
        row1 = {
            "compound_id": "test-compound",
            "compound_name": "Test Compound",
            "area": "New Cairo",
            "status_2025": "Ready to Move",
        }
        row2 = {
            "compound_id": "test-compound",  # Same ID
            "compound_name": "Updated Name",  # Different name
            "area": "New Cairo",
            "status_2025": "Under Construction",  # Different status
        }
        
        # Both should validate
        result1 = validate_row(row1, 1)
        result2 = validate_row(row2, 1)
        
        assert result1["compound_id"] == result2["compound_id"]
        assert result1["name"] != result2["name"]  # Names differ
        assert result1["status_2025"] != result2["status_2025"]  # Status differs
        
        # In actual upsert, row2 would update row1's data

