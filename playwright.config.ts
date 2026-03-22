import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'cd api && npm run start',
      url: 'http://localhost:7071/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APP_PASSWORD: 'e2e-test-password',
        MONGODB_CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      },
    },
    {
      command: 'cd web && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
