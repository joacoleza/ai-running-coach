import { test, expect } from '@playwright/test'

const mockActivePlan = {
  _id: 'plan-001',
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
              date: '2026-04-07',
              type: 'run',
              objective: { kind: 'distance', value: 5, unit: 'km' },
              guidelines: 'Easy Zone 2 run',
              completed: false,
              skipped: false,
            },
            {
              date: '2026-04-08',
              type: 'rest',
              guidelines: 'Rest day',
              completed: false,
              skipped: false,
            },
            {
              date: '2026-04-09',
              type: 'run',
              objective: { kind: 'distance', value: 8, unit: 'km' },
              guidelines: 'Tempo run at 5:30/km',
              completed: true,
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

const mockArchivedPlans = [
  {
    _id: 'archived-001',
    status: 'archived',
    objective: 'Build base fitness',
    targetDate: '2026-03-01',
    phases: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
]

function makeSseBody(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`
}

async function loginWithPlan(page: any, plan: any = mockActivePlan) {
  await page.route('**/api/plan', async (route: any) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan }) })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan }) })
    }
  })
  await page.route('**/api/plan/days/**', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/plans/archived', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: mockArchivedPlans }) })
  })
  await page.route('**/api/plans/archived/**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: { ...mockArchivedPlans[0], phases: [] } }) })
  })
  await page.route('**/api/plan/archive', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/plan/import', async (route: any) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: { ...mockActivePlan, objective: 'Imported plan' } }) })
  })
  await page.route('**/api/messages**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
  })
  await page.route('**/api/chat', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: makeSseBody('Sure, let me update your plan!'),
    })
  })

  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('app_password', 'e2e-test-password'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })
}

test.describe('Training Plan view (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('plan page shows hierarchical phases/weeks/days (no calendar)', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()

    await expect(page.getByText('Base Building')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/week 1/i)).toBeVisible()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible()
    await expect(page.getByText('Tempo run at 5:30/km')).toBeVisible()
    // No react-big-calendar
    await expect(page.locator('.rbc-calendar')).not.toBeVisible()
  })

  test('completed day does not have action buttons; non-completed day does', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // 2 run days: 1 completed + 1 not completed. Only the non-completed one has action buttons.
    // Exactly 1 "Mark as completed" button should be on the page.
    await expect(page.getByTitle('Mark as completed')).toHaveCount(1)
    await expect(page.getByTitle('Mark as skipped')).toHaveCount(1)
  })

  test('clicking guidelines enters inline edit mode with input', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Easy Zone 2 run').click()

    // Input should appear
    const input = page.locator('input[type="text"]').first()
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('Easy Zone 2 run')
  })

  test('editing guidelines and pressing Enter saves the update', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Easy Zone 2 run').click()
    // The edit input has a blue border — distinct from the chat input
    const editInput = page.locator('input.border-blue-400')
    await expect(editInput).toBeVisible()
    await editInput.fill('Easy Zone 2 run — 45 min')
    await editInput.press('Enter')

    // Edit mode exits — blue-border input disappears
    await expect(editInput).not.toBeVisible({ timeout: 5_000 })
  })

  test('plan action buttons are visible — Import, Update Plan, Close & Archive', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()

    await expect(page.getByRole('button', { name: 'Import from ChatGPT' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Update Plan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close & Archive' })).toBeVisible()
    // "New Plan" is hidden when active plan exists
    await expect(page.getByRole('button', { name: 'New Plan' })).not.toBeVisible()
  })

  test('Import from ChatGPT shows URL input form', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await page.getByRole('button', { name: 'Import from ChatGPT' }).click()

    await expect(page.getByPlaceholder('https://chatgpt.com/share/...')).toBeVisible({ timeout: 5_000 })
  })

  test('Update Plan button opens coach panel', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await page.getByRole('button', { name: 'Update Plan' }).click()

    // Coach panel should open (shows chat input or welcome)
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10_000 })
  })

  test('Close & Archive prompts confirmation and archives', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByRole('button', { name: 'Close & Archive' })).toBeVisible({ timeout: 10_000 })

    // Intercept the confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Archive this plan')
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Close & Archive' }).click()
    // No error shown after archiving
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Archive section (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('Archive nav item appears in sidebar', async ({ page }) => {
    await loginWithPlan(page)
    await expect(page.getByRole('link', { name: /archive/i })).toBeVisible({ timeout: 10_000 })
  })

  test('Archive list page shows archived plans with objective and date', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: /archive/i }).click()

    await expect(page.getByText('Build base fitness')).toBeVisible({ timeout: 10_000 })
  })

  test('clicking an archived plan navigates to readonly view', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: /archive/i }).click()

    await page.getByText('Build base fitness').click()

    await expect(page.url()).toContain('/archive/')
    // ArchivePlan renders a "← Back to Archive" link
    await expect(page.getByText(/back to archive/i)).toBeVisible({ timeout: 10_000 })
  })
})
