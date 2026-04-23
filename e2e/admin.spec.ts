import { test, expect, Page } from '@playwright/test'

// ── Admin panel E2E tests ────────────────────────────────────────────────────
//
// Covers: sidebar guard, route guard, user list, create user, reset password,
// deactivate user, deactivated user login rejection.
//
// Admin user seeded in e2e/global-setup.ts: admin@example.com / password123
// Normal user: test@example.com / password123
// Second user (for deactivate tests): deactivate@example.com / password123

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

async function loginAsAdmin(page: Page) {
  // beforeEach already navigated to '/' and cleared localStorage.
  // Wait for login form then authenticate.
  await setupDataMocks(page)
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()

  // Wait for sidebar to confirm authenticated state
  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 15_000 })
}

async function loginAsUser(page: Page) {
  // beforeEach already navigated to '/' and cleared localStorage.
  // Wait for login form then authenticate.
  await setupDataMocks(page)
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Log In' }).click()

  // Wait for sidebar to confirm authenticated state
  await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 15_000 })
}

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and clear any existing session before each test.
    // We use page.goto + page.evaluate (not addInitScript) so the clear runs once,
    // not on every subsequent page.goto() that the test makes.
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_is_admin')
      localStorage.removeItem('auth_temp_password')
    })
  })

  test('non-admin user does not see Admin link in sidebar', async ({ page }) => {
    await loginAsUser(page)

    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toBeVisible()

    // Admin link must not be visible to a non-admin user
    await expect(page.getByRole('link', { name: /Admin/i })).toHaveCount(0)
  })

  test('non-admin navigating to /admin is redirected to /dashboard', async ({ page }) => {
    await loginAsUser(page)

    await page.goto('/admin')

    // Should be redirected away from /admin
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('admin sees Admin link in sidebar and can navigate to admin page', async ({ page }) => {
    await loginAsAdmin(page)

    // Admin link must be visible in the sidebar
    const adminLink = page.getByRole('link', { name: /Admin/i })
    await expect(adminLink).toBeVisible()

    // Click the Admin link to navigate
    await adminLink.click()

    // URL should contain /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })

    // Page heading and table header visible
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Email/i })).toBeVisible()
  })

  test('admin page lists seeded users', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/admin')

    // Wait for the table to load (loading text goes away, rows appear)
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('table')).toBeVisible()

    // At least test@example.com should be in the table
    await expect(page.getByRole('row', { name: /test@example\.com/ })).toBeVisible()
  })

  test('admin can create a user and see temp password modal', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/admin')
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })

    // Click "Create User"
    await page.getByRole('button', { name: 'Create User' }).click()

    // Fill in the email
    const uniqueEmail = `e2e-new-${Date.now()}@example.com`
    await page.getByPlaceholder('user@example.com').fill(uniqueEmail)

    // Click "Create" (exact match to avoid matching "Create User" button)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Temp password modal should appear with "New Account Created" heading
    await expect(page.getByRole('heading', { name: 'New Account Created' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Save this password — it won't be shown again.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible()

    // Dismiss the modal
    await page.getByRole('button', { name: "I've saved the password" }).click()

    // Modal should be gone
    await expect(page.getByRole('heading', { name: 'New Account Created' })).toHaveCount(0)
  })

  test('admin can reset a user password and see temp password modal', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/admin')
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('table')).toBeVisible()

    // Accept the confirm dialog before clicking Reset Password
    page.once('dialog', dialog => dialog.accept())

    // Find the row for deactivate@example.com and click Reset Password
    // (using the dedicated test user to avoid affecting test@example.com's password)
    const row = page.getByRole('row', { name: /deactivate@example\.com/ })
    await row.getByRole('button', { name: /Reset Password/i }).click()

    // Temp password modal should appear with "Password Reset" heading
    await expect(page.getByRole('heading', { name: 'Password Reset' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Save this password — it won't be shown again.")).toBeVisible()

    // Dismiss the modal
    await page.getByRole('button', { name: "I've saved the password" }).click()

    // Modal should be gone
    await expect(page.getByRole('heading', { name: 'Password Reset' })).toHaveCount(0)
  })

  test('admin can deactivate a user', async ({ page }) => {
    await loginAsAdmin(page)

    await page.goto('/admin')
    await expect(page.getByText('Loading users...')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByRole('table')).toBeVisible()

    // Accept the confirm dialog before clicking Deactivate
    page.once('dialog', dialog => dialog.accept())

    // Find the row for deactivate@example.com and click Deactivate.
    // Using aria-label pattern to avoid matching "Reset password for deactivate@..." button
    // whose aria-label also contains "deactivate" (case-insensitive).
    const row = page.getByRole('row', { name: /deactivate@example\.com/ })
    await row.getByRole('button', { name: /^Deactivate deactivate/i }).click()

    // Row status badge should update to "Deactivated"
    await expect(row.getByText('Deactivated')).toBeVisible({ timeout: 10_000 })
  })

  test('deactivated user cannot log in', async ({ page, request }) => {
    // Deactivate deactivate@example.com via API directly (faster and more reliable than UI flow)
    const adminLoginRes = await request.post('http://localhost:7071/api/auth/login', {
      data: { email: 'admin@example.com', password: 'password123' },
    })
    expect(adminLoginRes.ok()).toBeTruthy()
    const { token: adminToken } = await adminLoginRes.json() as { token: string }

    // List users to find deactivate@example.com's ID
    const usersRes = await request.get('http://localhost:7071/api/users', {
      headers: { 'X-Authorization': `Bearer ${adminToken}` },
    })
    expect(usersRes.ok()).toBeTruthy()
    const { users } = await usersRes.json() as { users: { _id: string; email: string }[] }
    const targetUser = users.find(u => u.email === 'deactivate@example.com')
    expect(targetUser).toBeDefined()

    // Deactivate the target user
    const patchRes = await request.patch(`http://localhost:7071/api/users/${targetUser!._id}`, {
      headers: { 'X-Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      data: { active: false },
    })
    expect(patchRes.ok()).toBeTruthy()

    // Now try to log in as the deactivated user via the UI
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

    await page.getByLabel('Email').fill('deactivate@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Log In' }).click()

    // Should see invalid credentials error (same message as wrong password — no user enumeration)
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10_000 })
  })
})
