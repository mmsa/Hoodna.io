#!/usr/bin/env python3
"""
Smoke test script to verify critical API endpoints are working.
Run this after starting the backend to ensure basic functionality.
"""
import asyncio
import httpx
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_URL = os.getenv("API_URL", "http://localhost:8000")
TIMEOUT = 10.0

# Test results
results = {
    "passed": [],
    "failed": [],
    "warnings": []
}


def log_test(name: str, passed: bool, message: str = ""):
    """Log test result."""
    if passed:
        results["passed"].append(name)
        print(f"✅ {name}: PASSED" + (f" - {message}" if message else ""))
    else:
        results["failed"].append(name)
        print(f"❌ {name}: FAILED" + (f" - {message}" if message else ""))


def log_warning(name: str, message: str):
    """Log warning."""
    results["warnings"].append(f"{name}: {message}")
    print(f"⚠️  {name}: WARNING - {message}")


async def test_health_check():
    """Test health check endpoint."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                log_test("Health Check", True)
            else:
                log_test("Health Check", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Health Check", False, str(e))


async def test_root_endpoint():
    """Test root endpoint."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{BASE_URL}/")
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    log_test("Root Endpoint", True)
                else:
                    log_test("Root Endpoint", False, "Invalid response format")
            else:
                log_test("Root Endpoint", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Root Endpoint", False, str(e))


async def test_signup():
    """Test user signup."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Use unique email to avoid conflicts
            import random
            test_email = f"smoketest_{random.randint(10000, 99999)}@test.com"
            payload = {
                "name": "Smoke Test User",
                "email": test_email,
                "password": "TestPassword123!",
                "phone": "+201234567890"
            }
            response = await client.post(f"{BASE_URL}/api/auth/signup", json=payload)
            if response.status_code == 201:
                data = response.json()
                if "access_token" in data and "refresh_token" in data:
                    log_test("User Signup", True)
                    return data.get("access_token"), test_email
                else:
                    log_test("User Signup", False, "Missing tokens in response")
            else:
                log_test("User Signup", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("User Signup", False, str(e))
    return None, None


async def test_login(email: str):
    """Test user login."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload = {
                "email": email,
                "password": "TestPassword123!"
            }
            response = await client.post(f"{BASE_URL}/api/auth/login", json=payload)
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    log_test("User Login", True)
                    return data.get("access_token")
                else:
                    log_test("User Login", False, "Missing access_token")
            else:
                log_test("User Login", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("User Login", False, str(e))
    return None


async def test_get_me(token: str):
    """Test getting current user info."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(f"{BASE_URL}/api/auth/me", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "email" in data:
                    log_test("Get Current User", True)
                    return data
                else:
                    log_test("Get Current User", False, "Invalid response format")
            else:
                log_test("Get Current User", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Get Current User", False, str(e))
    return None


async def test_list_compounds(token: str):
    """Test listing compounds."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(f"{BASE_URL}/api/compounds?limit=5", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "items" in data or isinstance(data, list):
                    log_test("List Compounds", True)
                else:
                    log_test("List Compounds", False, "Invalid response format")
            elif response.status_code == 403:
                log_warning("List Compounds", "Requires approved user (expected for new signup)")
            else:
                log_test("List Compounds", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("List Compounds", False, str(e))


async def test_verification_status(token: str):
    """Test getting verification status."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(f"{BASE_URL}/api/verification/status", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "user_status" in data:
                    log_test("Verification Status", True)
                else:
                    log_test("Verification Status", False, "Invalid response format")
            else:
                log_test("Verification Status", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Verification Status", False, str(e))


async def test_feed_endpoint(token: str):
    """Test feed endpoint (may require verification)."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(f"{BASE_URL}/api/feed", headers=headers)
            if response.status_code == 200:
                log_test("Feed Endpoint", True)
            elif response.status_code == 403:
                log_warning("Feed Endpoint", "Requires verified user (expected for new signup)")
            else:
                log_test("Feed Endpoint", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Feed Endpoint", False, str(e))


async def test_marketplace_endpoint(token: str):
    """Test marketplace endpoint (may require verification)."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(f"{BASE_URL}/api/listings?scope=compound&limit=5", headers=headers)
            if response.status_code == 200:
                log_test("Marketplace Endpoint", True)
            elif response.status_code == 403:
                log_warning("Marketplace Endpoint", "Requires approved user (expected for new signup)")
            else:
                log_test("Marketplace Endpoint", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Marketplace Endpoint", False, str(e))


async def run_all_tests():
    """Run all smoke tests."""
    print("=" * 60)
    print("eljiran.com API Smoke Tests")
    print("=" * 60)
    print(f"Testing against: {BASE_URL}\n")
    
    # Basic endpoints (no auth)
    await test_health_check()
    await test_root_endpoint()
    
    # Auth flow
    token, email = await test_signup()
    if token:
        await test_get_me(token)
        await test_login(email)
        
        # Protected endpoints (may require verification)
        await test_list_compounds(token)
        await test_verification_status(token)
        await test_feed_endpoint(token)
        await test_marketplace_endpoint(token)
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"✅ Passed: {len(results['passed'])}")
    print(f"❌ Failed: {len(results['failed'])}")
    print(f"⚠️  Warnings: {len(results['warnings'])}")
    
    if results['failed']:
        print("\nFailed Tests:")
        for test in results['failed']:
            print(f"  - {test}")
    
    if results['warnings']:
        print("\nWarnings:")
        for warning in results['warnings']:
            print(f"  - {warning}")
    
    # Exit code
    if results['failed']:
        print("\n❌ Some tests failed!")
        sys.exit(1)
    else:
        print("\n✅ All critical tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(run_all_tests())

