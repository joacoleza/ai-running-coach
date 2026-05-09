import { test, expect } from '@playwright/test'

// ── Shared fixtures ────────────────────────────────────────────────────────

const mockActivePlan = {
  _id: 'plan-dash-001',
  status: 'active',
  onboardingStep: 6,
  onboardingMode: 'conversational',
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [{
    name: 'Base Building',
    description: 'Build aerobic base',
    weeks: [{
      weekNumber: 1,
      days: [
        { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: true, skipped: false },
        { label: 'B', type: 'run', objective: { kind: 'distance', value: 8, unit: 'km' }, guidelines: 'Long run', completed: false, skipped: false },
        { label: '', type: 'rest', guidelines: 'Rest', completed: false, skipped: false },
      ],
    }],
  }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockRuns = [
  { _id: 'run-001', date: '2026-04-07', distance: 5.2, duration: '27:30', pace: 5.29, planId: 'plan-dash-001', createdAt: '2026-04-07T00:00:00Z', updatedAt: '2026-04-07T00:00:00Z' },
  { _id: 'run-002', date: '2026-04-01', distance: 8.0, duration: '45:00', pace: 5.62, planId: 'plan-dash-001', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' },
]

// ── Test suite ────────────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'e2e-test-token')
      localStorage.setItem('auth_temp_password', 'false')
      localStorage.setItem('auth_email', 'test@example.com')
    })
    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan, linkedRuns: { '1-A': mockRuns[0] } }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plans/archived/**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null }) })
    })
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: mockRuns, total: mockRuns.length, totalAll: mockRuns.length }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
  })

  test('/ redirects to /dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  })

  test('Dashboard sidebar link is first nav item', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    // Get all nav links in sidebar — find the first link with a non-empty href
    const navLinks = page.locator('nav a')
    const firstLink = navLinks.first()
    const firstLinkText = await firstLink.textContent()
    expect(firstLinkText).toContain('Dashboard')
  })

  test('filter presets render and active state changes on click', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    // "Current Plan" should be active by default
    const currentPlanBtn = page.getByRole('button', { name: 'Current Plan' })
    await expect(currentPlanBtn).toBeVisible()
    await expect(currentPlanBtn).toHaveClass(/bg-gray-200/)

    // Click "Last 4 weeks"
    const last4Btn = page.getByRole('button', { name: 'Last 4 weeks' })
    await last4Btn.click()

    // "Last 4 weeks" should now be active
    await expect(last4Btn).toHaveClass(/bg-gray-200/)

    // "Current Plan" should no longer be active
    await expect(currentPlanBtn).not.toHaveClass(/bg-gray-200/)
  })

  test('stat cards render correct labels', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Total Distance')).toBeVisible()
    await expect(page.getByText('Total Runs')).toBeVisible()
    await expect(page.getByText('Total Time')).toBeVisible()
    await expect(page.getByText('Adherence')).toBeVisible()
  })

  test('Adherence card shows Progress sub-text', async ({ page }) => {
    // mockActivePlan has 1 completed day (A) out of 2 non-rest days (A, B)
    // adherence = 1/(1+0) = 100%, progress = 1/2 = 50%
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText(/Progress:/)).toBeVisible()
  })

  test('Adherence card navigates to /plan on click', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    const adherenceCard = page.locator('[role="button"]').filter({ hasText: 'Adherence' })
    await adherenceCard.click()
    await expect(page).toHaveURL(/\/plan/, { timeout: 10_000 })
  })

  test('empty state when no active plan and Current Plan filter', async ({ page }) => {
    // Override plan mock for this test
    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null, linkedRuns: {} }) })
    })
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('No active training plan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Planning' })).toBeVisible()
  })
})

test.describe('Discipline filter', () => {
  const mockGymRun = {
    _id: 'gym-001',
    discipline: 'gym',
    distance: 0,
    duration: '45:00',
    pace: 0,
    date: '2026-04-10',
    planId: 'plan-dash-001',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '2026-04-10T00:00:00Z',
  }

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'e2e-test-token')
      localStorage.setItem('auth_temp_password', 'false')
      localStorage.setItem('auth_email', 'test@example.com')
    })
    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan, linkedRuns: { '1-A': mockRuns[0] } }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plans/archived/**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
  })

  test('Discipline selector renders 4 buttons: All, Run, Gym, Cycle', async ({ page }) => {
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: mockRuns, total: mockRuns.length, totalAll: mockRuns.length }) })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gym', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cycle', exact: true })).toBeVisible()
  })

  test('Gym filter shows Total Sessions and Total Duration, hides Total Runs', async ({ page }) => {
    const allRuns = [...mockRuns, mockGymRun]
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: allRuns, total: allRuns.length, totalAll: allRuns.length }) })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Gym' }).click()

    await expect(page.getByText('Total Sessions')).toBeVisible()
    await expect(page.getByText('Total Duration')).toBeVisible()
    await expect(page.getByText('Total Runs')).not.toBeVisible()
  })

  test('Cycle filter shows Total Speed, hides Total Runs', async ({ page }) => {
    const cycleRun = {
      _id: 'cycle-001', discipline: 'cycle', distance: 20, duration: '60:00', pace: 0,
      date: '2026-04-09', createdAt: '2026-04-09T00:00:00Z', updatedAt: '2026-04-09T00:00:00Z',
    }
    const allRuns = [...mockRuns, cycleRun]
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: allRuns, total: allRuns.length, totalAll: allRuns.length }) })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Cycle' }).click()

    await expect(page.getByText('Total Speed')).toBeVisible()
    await expect(page.getByText('Total Runs')).not.toBeVisible()
  })

  test('WeightProgressionChart visible when gym runs exist', async ({ page }) => {
    const allRuns = [...mockRuns, mockGymRun]
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: allRuns, total: allRuns.length, totalAll: allRuns.length }) })
    })
    // registered after **/api/runs* so it takes precedence (Playwright LIFO)
    await page.route('**/api/runs/exercise-weights**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exercise: '', data: [] }) })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByRole('heading', { name: 'Weight Progression' })).toBeVisible()
  })

  test('WeightProgressionChart not visible when no gym runs exist', async ({ page }) => {
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: mockRuns, total: mockRuns.length, totalAll: mockRuns.length }) })
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('Weight Progression')).not.toBeVisible()
  })
})

test.describe('ArchivePlan', () => {
  test('archived plan page shows readonly panel FAB on mobile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'e2e-test-token')
      localStorage.setItem('auth_temp_password', 'false')
      localStorage.setItem('auth_email', 'test@example.com')
    })
    await page.route('**/api/plans/archived/archive-001', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: { ...mockActivePlan, _id: 'archive-001', status: 'archived' } }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [{ role: 'assistant', content: 'Great job!', planId: 'archive-001', timestamp: new Date().toISOString(), threadId: 'thread-1' }] }) })
    })
    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan, linkedRuns: {} }) })
    })
    await page.route('**/api/runs*', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })

    // Set mobile viewport before navigating
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/archive/archive-001')

    await expect(page.getByRole('button', { name: 'View plan history' })).toBeVisible({ timeout: 10_000 })
  })
})
