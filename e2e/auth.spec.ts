import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start unauthenticated
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('shows password page when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('AI Running Coach')).toBeVisible()
    await expect(page.getByPlaceholder('Enter password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible()
  })

  test('correct password grants access', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Enter password').fill('e2e-test-password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    // After success, should see app content (Dashboard heading)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder('Enter password').fill('wrong-password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('Wrong password')).toBeVisible({ timeout: 10_000 })
    // Should still be on password page
    await expect(page.getByPlaceholder('Enter password')).toBeVisible()
  })

  test('logout returns to password page', async ({ page }) => {
    // First login
    await page.goto('/')
    await page.getByPlaceholder('Enter password').fill('e2e-test-password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })
    // Click logout
    await page.getByRole('button', { name: /Logout/i }).click()
    // Should be back on password page
    await expect(page.getByText('AI Running Coach')).toBeVisible({ timeout: 10_000 })
  })
})
