import { test, expect, Page } from '@playwright/test'

// ── Usage tracking E2E tests ─────────────────────────────────────────────────
//
// Covers: sidebar My Usage navigation, UsagePage stat cards + monthly table,
// admin panel Month/All-time columns, $0.00 for users with no usage.
//
// Normal user: test@example.com / password123 (has 1 seeded usage_event)
// Admin user: admin@example.com / password123

const USAGE_ME_FIXTURE = {
  allTime: { cost: 2.47, messages: 312 },
  thisMonth: { cost: 0.18, messages: 23 },
  monthly: [{ year: 2026, month: 4, cost: 0.18, messages: 23 }],
}

async function setupDataMocks(page: Page) {
  await page.route('**/api/plan', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null, linkedRuns: {} }) })
  })
  await page.route('**/api/runs*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
  })
  await page.route('**/api/messages*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
  })
}

async function loginAsUser(page: Page) {
  await setupDataMocks(page)
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()

  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 15_000 })
}

async function loginAsAdmin(page: Page) {
  await setupDataMocks(page)
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()

  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 15_000 })
}

test.describe('Usage tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_is_admin')
      localStorage.removeItem('auth_temp_password')
    })
  })

  test('My Usage sidebar item navigates to /usage page', async ({ page }) => {
    await loginAsUser(page)

    // Mock usage/me so the page renders without hitting real API
    await page.route('**/api/usage/me', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(USAGE_ME_FIXTURE) })
    })

    // Open the account dropdown
    await page.getByRole('button', { name: 'Account menu' }).click()

    // Click My Usage
    await page.getByRole('button', { name: 'My Usage' }).click()

    await expect(page).toHaveURL('/usage')
    await expect(page.getByRole('heading', { name: 'My Usage' })).toBeVisible()
  })

  test('UsagePage shows all-time and this-month stat cards', async ({ page }) => {
    await loginAsUser(page)

    // Mock usage/me with fixture data
    await page.route('**/api/usage/me', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(USAGE_ME_FIXTURE) })
    })

    await page.goto('/usage')

    await expect(page.getByText('All-time')).toBeVisible()
    await expect(page.getByText('This month')).toBeVisible()
    await expect(page.getByText('$2.47')).toBeVisible()
  })

  test('UsagePage shows monthly breakdown table', async ({ page }) => {
    await loginAsUser(page)

    await page.route('**/api/usage/me', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(USAGE_ME_FIXTURE) })
    })

    await page.goto('/usage')

    await expect(page.getByRole('columnheader', { name: 'Month' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Cost' })).toBeVisible()
  })

  test('Admin panel shows Month and All-time columns', async ({ page }) => {
    await loginAsAdmin(page)

    // Mock usage-summary
    await page.route('**/api/users/usage-summary', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ summary: {} }) })
    })

    await page.goto('/admin')

    // Wait for table to load
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })

    await expect(page.getByRole('columnheader', { name: 'Month' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'All-time' })).toBeVisible()
  })

  test('Admin panel shows $0.00 for users with no usage', async ({ page }) => {
    await loginAsAdmin(page)

    // Mock usage-summary with empty map — all users will show $0.00
    await page.route('**/api/users/usage-summary', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ summary: {} }) })
    })

    await page.goto('/admin')

    // Wait for table to load
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('table')).toBeVisible()

    // Find the row for deactivate@example.com (no seeded usage) and verify $0.00
    const row = page.getByRole('row', { name: /deactivate@example\.com/ })
    await expect(row.getByText('$0.00').first()).toBeVisible()
  })
})
