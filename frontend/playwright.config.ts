import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['html', { open: 'never' }]],
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
})
