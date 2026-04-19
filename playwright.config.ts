import { defineConfig } from '@playwright/test'

// Set E2E database before globalSetup runs. CI provides MONGODB_CONNECTION_STRING explicitly
// (mongodb://localhost:27017, no db name → falls back to 'running-coach' in db.ts).
// Locally, default to an isolated 'running-coach-e2e' database so E2E never touches dev data.
// NOTE: requires the dev API server to be stopped first — if it's already running on port 7071,
// Playwright reuses it (with its own 'running-coach' connection) and E2E logins will fail.
if (!process.env.MONGODB_CONNECTION_STRING) {
  process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017/running-coach-e2e'
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['json', { outputFile: 'playwright-results.json' }]]
    : 'line',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'cd api && npm start',
      url: 'http://localhost:7071/api/ping',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        MONGODB_CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING,
        FUNCTIONS_WORKER_RUNTIME: 'node',
        AzureWebJobsStorage: 'UseDevelopmentStorage=false',
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-key-minimum-32-chars',
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
