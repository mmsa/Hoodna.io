import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('placeholder runs', async () => {
    expect(true).toBeTruthy()
  })
})
