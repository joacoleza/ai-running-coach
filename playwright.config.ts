import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'cd api && npm run build && func start',
      url: 'http://localhost:7071/api/ping',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APP_PASSWORD: 'e2e-test-password',
        MONGODB_CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
        FUNCTIONS_WORKER_RUNTIME: 'node',
        AzureWebJobsStorage: 'UseDevelopmentStorage=false',
        // Explicitly unset so the real Claude API is never called from the server during E2E tests.
        // Chat functionality is covered in e2e/coach.spec.ts via page.route() mocks that
        // intercept /api/chat at the browser level and return fake SSE responses — the server
        // never processes those requests, so ANTHROPIC_API_KEY is irrelevant for chat E2E tests.
        ANTHROPIC_API_KEY: '',
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
