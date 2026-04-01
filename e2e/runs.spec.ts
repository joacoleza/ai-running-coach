import { test, expect } from '@playwright/test'

// ── Shared fixtures ────────────────────────────────────────────────────────

const mockActivePlan = {
  _id: 'plan-runs-001',
  status: 'active',
  onboardingStep: 6,
  onboardingMode: 'conversational',
  objective: 'Run a 10K in under 55 minutes',
  targetDate: '2026-06-01',
  goal: { type: '10k', targetDate: '2026-06-01' },
  phases: [
    {
      name: 'Base Building',
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              label: 'A',
              type: 'run',
              objective: { kind: 'distance', value: 5, unit: 'km' },
              guidelines: 'Easy Zone 2 run',
              completed: false,
              skipped: false,
            },
            {
              label: '',
              type: 'rest',
              guidelines: 'Rest day',
              completed: false,
              skipped: false,
            },
          ],
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockSavedRun = {
  _id: 'run-001',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  planId: 'plan-runs-001',
  weekNumber: 1,
  dayLabel: 'A',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

const mockUnlinkedRun = {
  _id: 'run-unlinked-001',
  date: '2026-04-02',
  distance: 6,
  duration: '30:00',
  pace: 5.0,
  createdAt: '2026-04-02T00:00:00.000Z',
  updatedAt: '2026-04-02T00:00:00.000Z',
}

async function loginWithPlan(page: any, plan: any = mockActivePlan) {
  // Route all required API endpoints
  await page.route('**/api/plan', async (route: any) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan }) })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan }) })
    }
  })
  await page.route('**/api/plan/days/**', async (route: any) => {
    const method = route.request().method()
    if (method === 'DELETE' || method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan }) })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan }) })
    }
  })
  await page.route('**/api/plan/days', async (route: any) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan }) })
  })
  await page.route('**/api/plans/archived', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
  })
  await page.route('**/api/plans/archived/**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null }) })
  })
  await page.route('**/api/plan/archive', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/messages**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
  })
  await page.route('**/api/chat', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `data: ${JSON.stringify({ text: 'Great job!' })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
    })
  })

  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('app_password', 'e2e-test-password'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Training Plan' })).toBeVisible({ timeout: 15_000 })
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Run Logging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('complete a plan day: opens run entry form, saves run, form closes', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // Route POST /api/runs to return a completed run
    let runPostCalled = false
    await page.route('**/api/runs', async (route: any) => {
      if (route.request().method() === 'POST') {
        runPostCalled = true
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockSavedRun),
        })
      } else {
        // GET /api/runs for the runs page
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ runs: [mockSavedRun], total: 1 }),
        })
      }
    })

    // Click "Log run" on Day A (opens RunEntryForm inline)
    await page.getByTitle('Log run data').click()

    // RunEntryForm should appear (look for distance placeholder)
    await expect(page.getByPlaceholder('5.0')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByPlaceholder('45:30')).toBeVisible()

    // Fill distance and duration
    await page.getByPlaceholder('5.0').fill('5')
    await page.getByPlaceholder('45:30').fill('25:00')

    // Click Save run
    await page.getByRole('button', { name: /save run/i }).click()

    // Form should close (POST /api/runs was called)
    await expect(async () => {
      expect(runPostCalled).toBe(true)
    }).toPass({ timeout: 5_000 })

    // RunEntryForm should no longer be visible (completingRun reset to false)
    await expect(page.getByPlaceholder('5.0')).not.toBeVisible({ timeout: 5_000 })
  })

  test('log a standalone run from Runs page (unlinked)', async ({ page }) => {
    await loginWithPlan(page)

    // Route GET /api/runs — initially empty
    let runsData: any[] = []
    await page.route('**/api/runs', async (route: any) => {
      if (route.request().method() === 'POST') {
        // After posting, add the new run to the list
        runsData = [{ ...mockUnlinkedRun, _id: 'run-standalone-001' }]
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockUnlinkedRun, _id: 'run-standalone-001' }),
        })
      } else {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ runs: runsData, total: runsData.length }),
        })
      }
    })

    // Navigate to /runs
    await page.getByRole('link', { name: 'Runs' }).click()
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible({ timeout: 10_000 })

    // Click "Log a run"
    await page.getByRole('button', { name: /log a run/i }).click()

    // Form modal should appear
    await expect(page.getByRole('heading', { name: /log a run/i })).toBeVisible({ timeout: 5_000 })

    // Fill form and save
    await page.getByPlaceholder('5.0').fill('6')
    await page.getByPlaceholder('45:30').fill('30:00')
    await page.getByRole('button', { name: /save run/i }).click()

    // Modal closes and run appears in list (no plan badge since unlinked)
    await expect(page.getByRole('heading', { name: /log a run/i })).not.toBeVisible({ timeout: 5_000 })

    // A run row with 6km should appear in the list
    await expect(page.getByText(/6km/)).toBeVisible({ timeout: 5_000 })
  })

  test('link an unlinked run to a training plan day', async ({ page }) => {
    await loginWithPlan(page)

    // Route GET /api/runs?unlinked=true to return one unlinked run
    await page.route('**/api/runs?unlinked=true**', async (route: any) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ runs: [mockUnlinkedRun], total: 1 }),
      })
    })

    // Route POST /api/runs/:id/link to succeed
    let linkCalled = false
    await page.route('**/api/runs/*/link', async (route: any) => {
      if (route.request().method() === 'POST') {
        linkCalled = true
        const linkedRun = { ...mockUnlinkedRun, planId: 'plan-runs-001', weekNumber: 1, dayLabel: 'A' }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(linkedRun),
        })
      } else {
        await route.continue()
      }
    })

    // Navigate to /plan
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // Click "Link run" on Day A
    await page.getByText('Link run').click()

    // LinkRunModal should appear showing the unlinked run
    await expect(page.getByText(/Link a run to Week 1 Day A/)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/6km/)).toBeVisible({ timeout: 5_000 })

    // Click "Link" to link the run
    await page.getByRole('button', { name: /^Link$/ }).click()

    // linkRun API was called
    await expect(async () => {
      expect(linkCalled).toBe(true)
    }).toPass({ timeout: 5_000 })

    // Modal closes
    await expect(page.getByText(/Link a run to Week 1 Day A/)).not.toBeVisible({ timeout: 5_000 })
  })
})
