# Testing Guide for eljiran.com

## Overview

This document describes the testing strategy and guidelines for the eljiran.com codebase.

## Test Structure

```
backend/
├── tests/
│   ├── conftest.py          # Pytest fixtures and configuration
│   ├── test_auth.py         # Authentication tests
│   ├── test_crud/           # CRUD operation tests
│   ├── test_services/       # Service layer tests
│   └── test_integration/    # Integration tests

frontend/
├── tests/
│   ├── setup.ts             # Test setup and mocks
│   ├── utils/
│   │   └── test-utils.tsx   # Test utilities
│   ├── components/          # Component tests
│   ├── hooks/               # Hook tests
│   └── lib/                 # Utility tests
```

## Running Tests

### Backend Tests

```bash
# Run all tests
cd backend
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run specific test
pytest tests/test_auth.py::test_signup_success

# Run with markers
pytest -m unit
pytest -m integration
```

### Frontend Tests

```bash
# Run all tests in watch mode
cd frontend
npm run test

# Run tests once
npm run test:unit

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui

# Run E2E tests
npm run test:e2e
```

## Writing Tests

### Backend Unit Tests

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
@pytest.mark.unit
async def test_example(async_client: AsyncClient, db_session):
    """Test description."""
    response = await async_client.post("/api/endpoint", json={...})
    assert response.status_code == 200
    assert response.json()["key"] == "value"
```

### Frontend Component Tests

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils/test-utils'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Frontend Hook Tests

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from '@/hooks/use-auth'

describe('useAuth', () => {
  it('returns user when authenticated', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeDefined()
  })
})
```

## Test Markers

### Backend Markers:
- `@pytest.mark.unit`: Unit tests (fast, isolated)
- `@pytest.mark.integration`: Integration tests (slower, require DB)
- `@pytest.mark.e2e`: End-to-end tests (slowest, full stack)
- `@pytest.mark.slow`: Slow running tests

### Usage:
```python
@pytest.mark.unit
async def test_fast():
    pass

@pytest.mark.integration
async def test_with_db():
    pass
```

## Mocking

### Backend Mocking

```python
from unittest.mock import patch, AsyncMock

@patch('app.services.s3.generate_presigned_url')
async def test_upload(mock_presign):
    mock_presign.return_value = "https://example.com/file"
    # Test code
```

### Frontend Mocking

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))
```

## Test Data and Fixtures

### Backend Fixtures

Fixtures are defined in `backend/tests/conftest.py`:
- `db_session`: Database session
- `client`: Sync test client
- `async_client`: Async test client
- `test_user_data`: Sample user data
- `admin_user_data`: Admin user data

### Frontend Test Data

Create mock data in `frontend/tests/mockData/`:
```typescript
export const mockUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
}
```

## Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: All user flows covered

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Isolation**: Each test should be independent
4. **Mock External Services**: Don't call real APIs or services in tests
5. **Fast Tests**: Unit tests should run quickly
6. **Clear Assertions**: One assertion per test concept
7. **Test Edge Cases**: Don't just test happy paths

## E2E Testing with Playwright

```typescript
import { test, expect } from '@playwright/test'

test('user can sign up', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.click('text=Sign Up')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/)
})
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Can be run manually via GitHub Actions

## Troubleshooting

### Backend Tests Failing
- Ensure test database is set up correctly
- Check that all migrations are applied
- Verify fixtures are working

### Frontend Tests Failing
- Clear `node_modules` and reinstall
- Check that mocks are set up correctly
- Verify test environment variables

### E2E Tests Failing
- Ensure backend and frontend are running
- Check that test data is seeded
- Verify network requests are not blocked

