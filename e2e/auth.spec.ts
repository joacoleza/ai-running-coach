import { test, expect } from '@playwright/test'

test.describe('Auth flows', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test unauthenticated
    await page.addInitScript(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_is_admin')
      localStorage.removeItem('auth_temp_password')
    })
  })

  test('login page renders when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'AI Running Coach' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 10_000 })
  })

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    // Route API calls to pass through to real server (test user seeded in global-setup)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

    // Mock plan and runs so dashboard loads quickly
    await page.route('**/api/plan', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null, linkedRuns: {} }) })
    })
    await page.route('**/api/runs*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })
    await page.route('**/api/messages*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })

    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).not.toBeNull()
  })

  test('login with temp-password user shows ChangePasswordPage', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

    await page.getByLabel('Email').fill('temp@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page.getByText('Change Your Password')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('New Password')).toBeVisible()
    await expect(page.getByLabel('Confirm Password')).toBeVisible()
  })

  test('change password flow: temp user changes password and reaches dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })

    // Mock data endpoints so dashboard loads
    await page.route('**/api/plan', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null, linkedRuns: {} }) })
    })
    await page.route('**/api/runs*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })
    await page.route('**/api/messages*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })

    // Log in as temp user
    await page.getByLabel('Email').fill('temp@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page.getByText('Change Your Password')).toBeVisible({ timeout: 10_000 })

    // Fill in new password
    await page.getByLabel('New Password').fill('newpassword123')
    await page.getByLabel('Confirm Password').fill('newpassword123')
    await page.getByRole('button', { name: 'Change Password' }).click()

    // Should reach dashboard after successful password change
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    // auth_temp_password should now be false in localStorage
    const tempPw = await page.evaluate(() => localStorage.getItem('auth_temp_password'))
    expect(tempPw).toBe('false')

    // Note: global-setup re-seeds temp user with tempPassword: true on next full run
  })

  test('logout clears session and shows login page', async ({ page }) => {
    // Set up authenticated state directly via localStorage
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fake-jwt-for-logout-test')
      localStorage.setItem('auth_temp_password', 'false')
      localStorage.setItem('auth_email', 'test@example.com')
    })

    // Mock all API calls including logout
    await page.route('**/api/plan', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null, linkedRuns: {} }) })
    })
    await page.route('**/api/runs*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })
    await page.route('**/api/messages*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    // Click the logout button in the sidebar
    await page.getByRole('button', { name: /logout/i }).click()

    // Should redirect to login page
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })
    const token = await page.evaluate(() => localStorage.getItem('access_token'))
    expect(token).toBeNull()
  })

  test('accessing dashboard while unauthenticated stays on login page', async ({ page }) => {
    await page.goto('/dashboard')
    // App gate shows LoginPage — no redirect to /dashboard URL since it is above BrowserRouter
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible({ timeout: 10_000 })
  })
})
