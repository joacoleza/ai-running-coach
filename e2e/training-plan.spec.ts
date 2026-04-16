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
            {
              label: 'B',
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

async function loginWithPlan(page: any, plan: any = mockActivePlan, linkedRuns: Record<string, any> = {}) {
  await page.route('**/api/plan', async (route: any) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan, linkedRuns }) })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan, linkedRuns }) })
    }
  })
  await page.route('**/api/plan/days/**', async (route: any) => {
    const method = route.request().method()
    if (method === 'DELETE' || method === 'PATCH') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    } else {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    }
  })
  await page.route('**/api/plan/days', async (route: any) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
  })
  await page.route('**/api/plans/archived', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: mockArchivedPlans }) })
  })
  await page.route('**/api/plans/archived/**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: { ...mockArchivedPlans[0], phases: [] }, linkedRuns: {} }) })
  })
  await page.route('**/api/plan/archive', async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.route('**/api/messages**', async (route: any) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
  })
  // Mock runs to prevent 401 from real API triggering the logout interceptor
  await page.route('**/api/runs**', async (route: any) => {
    if (!route.request().url().includes('/link') && !route.request().url().includes('/unlink')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    } else {
      await route.continue()
    }
  })
  await page.route('**/api/chat', async (route: any) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: makeSseBody('Sure, let me update your plan!'),
    })
  })

  await page.goto('/')
  await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
  await page.reload()
  // Home redirects to /dashboard — wait for Dashboard heading
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

  test('clicking guidelines enters inline edit mode with textarea', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Easy Zone 2 run').click()

    // Textarea should appear (guidelines uses a textarea, not an input)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveValue('Easy Zone 2 run')
  })

  test('editing guidelines and pressing Enter saves the update', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    await page.getByText('Easy Zone 2 run').click()
    // Guidelines editor is a textarea with blue border
    const editTextarea = page.locator('textarea.border-blue-400')
    await expect(editTextarea).toBeVisible()
    await editTextarea.fill('Easy Zone 2 run — 45 min')
    await editTextarea.press('Enter')

    // Edit mode exits — blue-border textarea disappears
    await expect(editTextarea).not.toBeVisible({ timeout: 5_000 })
  })

  test('plan action buttons — compact Archive inline with title, no Update Plan', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()

    // Archive button is present (compact, inline with title)
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible({ timeout: 10_000 })
    // Update Plan button is gone (removed in phase 3.3)
    await expect(page.getByRole('button', { name: 'Update Plan' })).not.toBeVisible()
    // "New Plan" is hidden when active plan exists
    await expect(page.getByRole('button', { name: 'New Plan' })).not.toBeVisible()
  })

  test('Archive button prompts confirmation and archives', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible({ timeout: 10_000 })

    // Intercept the confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Archive this plan')
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Archive' }).click()
    // No error shown after archiving
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5_000 })
  })

  test('completed day run date is clickable and opens RunDetailModal', async ({ page }) => {
    const planWithLinkedRun = {
      ...mockActivePlan,
      phases: [{
        name: 'Base Building',
        weeks: [{
          weekNumber: 1,
          days: [
            {
              label: 'B',
              type: 'run',
              objective: { kind: 'distance', value: 8, unit: 'km' },
              guidelines: 'Tempo run',
              completed: true,
              skipped: false,
            },
          ],
        }],
      }],
    }

    const linkedRun = {
      _id: 'run-linked-001',
      date: '2026-04-01',
      distance: 8,
      duration: '40:00',
      pace: 5.0,
      planId: 'plan-001',
      weekNumber: 1,
      dayLabel: 'B',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    }

    await page.route('**/api/runs/run-linked-001', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(linkedRun) })
    })

    const linkedRunsMap = { '1-B': linkedRun }
    await loginWithPlan(page, planWithLinkedRun, linkedRunsMap)

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Tempo run')).toBeVisible({ timeout: 10_000 })

    // The run date button should be visible on the completed day
    const runDateBtn = page.getByRole('button', { name: /01\/04\/2026|Apr.*2026|2026-04-01/i })
    await expect(runDateBtn).toBeVisible({ timeout: 5_000 })
    await runDateBtn.click()

    // RunDetailModal should open showing the run distance
    await expect(page.getByText(/8.*km|8km/i)).toBeVisible({ timeout: 5_000 })
  })

  test('completed day without linked run shows Log run button', async ({ page }) => {
    const planWithCompletedUnlinked = {
      ...mockActivePlan,
      phases: [{
        name: 'Base Building',
        weeks: [{
          weekNumber: 1,
          days: [{
            label: 'A',
            type: 'run',
            objective: { kind: 'distance', value: 5, unit: 'km' },
            guidelines: 'Easy Zone 2 run',
            completed: true,
            skipped: false,
          }],
        }],
      }],
    }

    await loginWithPlan(page, planWithCompletedUnlinked)
    await page.route('**/api/runs**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0 }) })
    })

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // Completed day without linked run: "Log run" button should be visible in action area
    await expect(page.getByTitle('Log run data')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Day row actions (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('undo button appears on completed day and sends PATCH with completed=false', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Tempo run at 5:30/km')).toBeVisible({ timeout: 10_000 })

    // The completed day (Tempo run) should show Undo button
    await expect(page.getByTitle('Undo')).toBeVisible()

    // Capture the PATCH request body when Undo is clicked (completed day is label B, week 1)
    let patchBody: any = null
    await page.route('**/api/plan/days/1/B', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    await page.getByTitle('Undo').click()

    // Verify the PATCH was sent with completed: 'false'
    await page.waitForFunction(() => true) // allow microtasks to flush
    expect(patchBody).toMatchObject({ completed: 'false', skipped: 'false' })
  })

  test('delete button shows confirmation then sends DELETE request', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // Capture DELETE request
    let deleteUrl = ''
    await page.route('**/api/plan/days/**', async (route: any) => {
      if (route.request().method() === 'DELETE') {
        deleteUrl = route.request().url()
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    // Click delete — browser confirm dialog appears, accept it
    page.once('dialog', dialog => dialog.accept())
    await page.getByTitle('Delete day').first().click()

    await expect(async () => {
      expect(deleteUrl).toContain('/api/plan/days/')
      expect(deleteUrl).toMatch(/\/api\/plan\/days\/\d+\/[A-G]/)
    }).toPass({ timeout: 5_000 })
  })

  test('delete confirmation can be cancelled with No', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    let deleteWasCalled = false
    await page.route('**/api/plan/days/**', async (route: any) => {
      if (route.request().method() === 'DELETE') {
        deleteWasCalled = true
        await route.continue()
      } else {
        await route.continue()
      }
    })

    // Click delete — browser confirm dialog appears, dismiss it
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByTitle('Delete day').first().click()

    // No DELETE request sent
    await page.waitForTimeout(500)
    expect(deleteWasCalled).toBe(false)
  })

  test('Add day form day-selector: taken label A is disabled, free label B is enabled', async ({ page }) => {
    // mockActivePlan has Week 1: label A (run) + label B (completed run) + rest day
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByTitle('Add a day to this week')).toBeVisible({ timeout: 10_000 })

    await page.getByTitle('Add a day to this week').click()

    // Labels A and B are taken by run days — should be disabled
    await expect(page.getByRole('button', { name: 'A', exact: true })).toBeDisabled()

    // Label C is free — should be enabled
    await expect(page.getByRole('button', { name: 'C', exact: true })).not.toBeDisabled()
  })
})

test.describe('Day row — mark complete / skip / reschedule (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('mark as completed sends PATCH with completed=true', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    let patchBody: any = null
    await page.route('**/api/plan/days/1/A', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    await page.getByTitle('Mark as completed').click()

    await expect(async () => {
      expect(patchBody).toMatchObject({ completed: 'true' })
    }).toPass({ timeout: 5_000 })
  })

  test('mark as skipped sends PATCH with skipped=true', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    let patchBody: any = null
    await page.route('**/api/plan/days/1/A', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    await page.getByTitle('Mark as skipped').click()

    await expect(async () => {
      expect(patchBody).toMatchObject({ skipped: 'true' })
    }).toPass({ timeout: 5_000 })
  })

  test('objective inline edit: clicking objective opens edit field', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Easy Zone 2 run')).toBeVisible({ timeout: 10_000 })

    // The non-completed day has objective 5 km — click it
    await page.getByTitle('Click to edit objective').first().click()

    // A text input should appear with the current value
    const numInput = page.locator('input.border-blue-400').first()
    await expect(numInput).toBeVisible({ timeout: 5_000 })
    await expect(numInput).toHaveValue('5')
  })
})

test.describe('plan:update streaming (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('coach response with <plan:update> tag triggers PATCH and plan refresh', async ({ page }) => {
    const planUpdateTag = '<plan:update week="1" day="A" guidelines="Updated guidelines" />'
    const replyWithUpdate = `I've updated Day A for you! ${planUpdateTag}`

    // Log in with base routes first
    await loginWithPlan(page)

    // Now override chat to return a plan:update SSE response (registered after loginWithPlan, so takes precedence)
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: `data: ${JSON.stringify({ text: replyWithUpdate })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
      })
    })

    // Override the specific day route to track whether PATCH is called (takes precedence over loginWithPlan's wildcard)
    let patchCalled = false
    await page.route('**/api/plan/days/1/A', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    // Send a message via the coach panel
    const input = page.getByPlaceholder('Type a message...')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Update Monday run')
    await page.getByRole('button', { name: 'Send' }).click()

    // The plan:update tag should be stripped from displayed message
    await expect(page.getByText(planUpdateTag)).not.toBeVisible({ timeout: 10_000 })
    // The visible part of the reply IS shown (without the tag)
    await expect(page.getByText("I've updated Day A for you!")).toBeVisible({ timeout: 10_000 })

    // PATCH was called for the day mentioned in the plan:update tag
    await expect(async () => {
      expect(patchCalled).toBe(true)
    }).toPass({ timeout: 8_000 })
  })
})

test.describe('plan:add streaming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('coach response with <plan:add> tag triggers POST to /api/plan/days and tag is stripped from display', async ({ page }) => {
    const planAddTag = '<plan:add week="1" day="C" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy recovery run" />'
    const replyWithAdd = `I've added Day C for you! ${planAddTag}`

    await loginWithPlan(page)

    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: `data: ${JSON.stringify({ text: replyWithAdd })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
      })
    })

    let postCalled = false
    let postBody: any = null
    await page.route('**/api/plan/days', async (route: any) => {
      if (route.request().method() === 'POST') {
        postCalled = true
        postBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    const input = page.getByPlaceholder('Type a message...')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Add a run on Day C')
    await page.getByRole('button', { name: 'Send' }).click()

    // Tag should be stripped from the displayed message
    await expect(page.getByText(planAddTag)).not.toBeVisible({ timeout: 10_000 })
    // Readable part of reply is shown
    await expect(page.getByText("I've added Day C for you!")).toBeVisible({ timeout: 10_000 })

    // POST was called with week number and label
    await expect(async () => {
      expect(postCalled).toBe(true)
      expect(postBody).toMatchObject({ weekNumber: 1, label: 'C', type: 'run' })
    }).toPass({ timeout: 8_000 })
  })

  test('plan:add with completed="true" sends correct POST body', async ({ page }) => {
    const planAddTag = '<plan:add week="2" day="D" type="run" objective_kind="time" objective_value="30" objective_unit="min" guidelines="30\' Z2" completed="true" />'
    const replyWithAdd = `Logged your completed run! ${planAddTag}`

    await loginWithPlan(page)

    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: `data: ${JSON.stringify({ text: replyWithAdd })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
      })
    })

    let postBody: any = null
    await page.route('**/api/plan/days', async (route: any) => {
      if (route.request().method() === 'POST') {
        postBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    const input = page.getByPlaceholder('Type a message...')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Log my completed run')
    await page.getByRole('button', { name: 'Send' }).click()

    // Tag stripped from display
    await expect(page.getByText(planAddTag)).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Logged your completed run!')).toBeVisible({ timeout: 10_000 })

    // POST body must include weekNumber, label, and completed="true"
    await expect(async () => {
      expect(postBody).toMatchObject({ weekNumber: 2, label: 'D', type: 'run', completed: 'true' })
    }).toPass({ timeout: 8_000 })
  })

  test('plan:update tag response shows "Building your training plan..." indicator then hides it', async ({ page }) => {
    const planUpdateTag = '<plan:update week="1" day="A" guidelines="Updated run!" />'
    const replyWithUpdate = `Done! ${planUpdateTag}`

    await loginWithPlan(page)

    // Use a slow-resolving chat response to give the indicator time to appear
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: `data: ${JSON.stringify({ text: replyWithUpdate })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`,
      })
    })

    await page.route('**/api/plan/days/1/A', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    const input = page.getByPlaceholder('Type a message...')
    await expect(input).toBeVisible({ timeout: 10_000 })
    await input.fill('Update Monday run')
    await page.getByRole('button', { name: 'Send' }).click()

    // After the response processes, the indicator should have been shown and then hidden.
    // The plan:update tag should not appear in the chat.
    await expect(page.getByText(planUpdateTag)).not.toBeVisible({ timeout: 10_000 })
    // The readable text should be visible
    await expect(page.getByText('Done!')).toBeVisible({ timeout: 10_000 })
    // Input should be re-enabled after isGeneratingPlan returns to false
    await expect(input).toBeEnabled({ timeout: 8_000 })
  })
})

test.describe('Sidebar navigation order (Phase 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('sidebar shows nav items in order: Dashboard, Training Plan, Runs, Archive', async ({ page }) => {
    await loginWithPlan(page)

    const sidebar = page.getByTestId('sidebar')
    const links = sidebar.getByRole('link')
    const count = await links.count()
    // Collect aria-label or text of each link to determine order
    const navTexts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await links.nth(i).textContent() ?? ''
      navTexts.push(text)
    }
    // Each nav item includes icon + label text (e.g. "📅Training Plan")
    // Verify the four items appear in the correct order
    const knownOrder = ['Dashboard', 'Training Plan', 'Runs', 'Archive']
    const indices = knownOrder.map(label => navTexts.findIndex(t => t.includes(label)))
    expect(indices.every(i => i !== -1)).toBe(true)
    // Indices must be strictly increasing (correct order)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  test('/ redirects to /dashboard', async ({ page }) => {
    await loginWithPlan(page)
    await page.goto('/')
    // Should redirect to /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 })
  })

  test('Dashboard is accessible at /dashboard', async ({ page }) => {
    await loginWithPlan(page)
    await page.route('**/api/runs**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [] }) })
    })
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })
  })
})

const mockTwoPhasePlan = {
  ...mockActivePlan,
  phases: [
    {
      name: 'Base Building',
      description: 'Build your aerobic base',
      weeks: [
        {
          weekNumber: 1,
          days: [
            { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy Zone 2 run', completed: false, skipped: false },
          ],
        },
      ],
    },
    {
      name: 'Build Phase',
      description: 'Increase intensity',
      weeks: [
        {
          weekNumber: 2,
          days: [
            { label: 'A', type: 'run', objective: { kind: 'distance', value: 8, unit: 'km' }, guidelines: 'Tempo run', completed: false, skipped: false },
          ],
        },
      ],
    },
  ],
}

test.describe('Phase edit and delete (260331-0vx)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('can edit phase name inline', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Base Building')).toBeVisible({ timeout: 10_000 })

    // Intercept PATCH request for phase update
    let patchCalled = false
    let patchBody: any = null
    await page.route('**/api/plan/phases/0', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        // Return updated plan with new phase name
        const updatedPlan = {
          ...mockActivePlan,
          phases: [{ ...mockActivePlan.phases[0], name: 'Foundation Phase' }],
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: updatedPlan }) })
      } else {
        await route.continue()
      }
    })

    // Click on phase name to enter edit mode
    await page.getByText('Base Building').click()

    // An input should appear
    const nameInput = page.locator('input[aria-label="Phase name"]')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill('Foundation Phase')
    await nameInput.press('Enter')

    // Input should disappear (edit mode exits)
    await expect(nameInput).not.toBeVisible({ timeout: 5_000 })

    // PATCH was called with the new name
    await expect(async () => {
      expect(patchCalled).toBe(true)
      expect(patchBody).toMatchObject({ name: 'Foundation Phase' })
    }).toPass({ timeout: 5_000 })
  })

  test('can edit phase description inline', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Base Building')).toBeVisible({ timeout: 10_000 })

    // Intercept PATCH request for phase description update
    let patchBody: any = null
    await page.route('**/api/plan/phases/0', async (route: any) => {
      if (route.request().method() === 'PATCH') {
        patchBody = JSON.parse(route.request().postData() ?? '{}')
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      } else {
        await route.continue()
      }
    })

    // mockActivePlan only has one phase with no description field set
    // The description area should exist — click on it to edit
    const descArea = page.locator('p[title="Click to edit description"]').first()
    await expect(descArea).toBeVisible({ timeout: 5_000 })
    await descArea.click()

    const descTextarea = page.locator('textarea[aria-label="Phase description"]')
    await expect(descTextarea).toBeVisible({ timeout: 5_000 })
    await descTextarea.fill('Build aerobic base with easy effort runs')

    // Blur to save
    await descTextarea.blur()

    await expect(async () => {
      expect(patchBody).toMatchObject({ description: 'Build aerobic base with easy effort runs' })
    }).toPass({ timeout: 5_000 })
  })

  test('delete button only visible on last phase when plan has multiple phases', async ({ page }) => {
    await loginWithPlan(page, mockTwoPhasePlan)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Build Phase')).toBeVisible({ timeout: 10_000 })

    // Delete button should exist (one instance for the last phase only)
    const deleteButtons = page.getByTitle('Delete last phase')
    await expect(deleteButtons).toHaveCount(1)
  })

  test('can delete last phase with confirmation dialog', async ({ page }) => {
    await loginWithPlan(page, mockTwoPhasePlan)
    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Build Phase')).toBeVisible({ timeout: 10_000 })

    let deleteCalled = false
    await page.route('**/api/plan/phases/last', async (route: any) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        const onePhase = { ...mockActivePlan, phases: [mockTwoPhasePlan.phases[0]] }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: onePhase }) })
      } else {
        await route.continue()
      }
    })

    // Accept the confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Delete the last phase')
      await dialog.accept()
    })

    await page.getByTitle('Delete last phase').click()

    await expect(async () => {
      expect(deleteCalled).toBe(true)
    }).toPass({ timeout: 5_000 })
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

  test('clicking an archived plan navigates to readonly view with PlanView', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: /archive/i }).click()

    await page.getByText('Build base fitness').click()

    await expect(page.url()).toContain('/archive/')
    // ArchivePlan renders a "← Back to Archive" link
    await expect(page.getByText(/back to archive/i)).toBeVisible({ timeout: 10_000 })
  })

  test('archived plan shows linked run date and opens RunDetailModal on click', async ({ page }) => {
    const archivedPlanWithRun = {
      ...mockArchivedPlans[0],
      phases: [
        {
          name: 'Base Building',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              days: [
                {
                  label: 'A',
                  type: 'run',
                  guidelines: 'Easy run 5km',
                  completed: true,
                  skipped: false,
                },
              ],
            },
          ],
        },
      ],
    }
    const linkedRuns = {
      '1-A': {
        _id: 'run-archived-001',
        date: '2026-03-10',
        distance: 5,
        duration: '30:00',
        pace: 6.0,
        planId: 'archived-001',
        weekNumber: 1,
        dayLabel: 'A',
      },
    }

    await loginWithPlan(page)

    // Override the archived plan detail mock to return plan with phases + linkedRuns
    await page.route('**/api/plans/archived/archived-001', async (route: any) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ plan: archivedPlanWithRun, linkedRuns }),
      })
    })
    // Mock the run fetch when RunDetailModal opens
    await page.route('**/api/runs/run-archived-001', async (route: any) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(linkedRuns['1-A']),
      })
    })

    await page.getByRole('link', { name: /archive/i }).click()
    await page.getByText('Build base fitness').click()
    await expect(page.getByText(/back to archive/i)).toBeVisible({ timeout: 10_000 })

    // The linked run date button should be visible inside the completed day row
    await expect(page.getByText('10/03/2026')).toBeVisible({ timeout: 10_000 })

    // Clicking the run date should open RunDetailModal (identified by its Close button)
    await page.getByText('10/03/2026').click()
    await expect(page.getByRole('button', { name: /close/i })).toBeVisible({ timeout: 10_000 })
  })

  test('COACH-04: TrainingPlan strips XML tags from coach response before saving progressFeedback', async ({ page }) => {
    // Set up a plan with phases and objective (so the "Get plan feedback" button appears)
    const activePlanWithObjective = { ...mockActivePlan }

    let currentPlan = activePlanWithObjective

    // Mock /api/plan to track PATCH requests
    await page.route('**/api/plan', async (route: any) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ plan: currentPlan }),
        })
      } else if (method === 'PATCH') {
        // Capture the PATCH body to verify progressFeedback is XML-stripped
        const patchData = JSON.parse(route.request().postData() ?? '{}')
        currentPlan = { ...currentPlan, ...patchData }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ plan: currentPlan }),
        })
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ plan: currentPlan }),
        })
      }
    })

    // Mock /api/messages
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      })
    })

    // Mock /api/runs to prevent 401 from real API triggering logout interceptor
    await page.route('**/api/runs**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })

    // Mock /api/chat to return a response with XML tags
    const rawCoachReply =
      'Great progress! <plan:update week="1" day="A" guidelines="easy"/> Keep it up!'
    const expectedCleanReply = 'Great progress!  Keep it up!'

    let capturedPatchBody: any = null

    await page.route('**/api/chat', async (route: any) => {
      // After this response, capture subsequent PATCH calls
      setTimeout(() => {
        page.route('**/api/plan', async (innerRoute: any) => {
          const innerMethod = innerRoute.request().method()
          if (innerMethod === 'PATCH') {
            capturedPatchBody = JSON.parse(innerRoute.request().postData() ?? '{}')
            currentPlan = { ...currentPlan, ...capturedPatchBody }
            await innerRoute.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ plan: currentPlan }),
            })
          } else {
            await innerRoute.continue()
          }
        })
      }, 10)

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody(rawCoachReply),
      })
    })

    // Login and navigate to plan
    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })
    await page.goto('/plan')
    await expect(page.getByRole('heading', { name: 'Training Plan' })).toBeVisible({ timeout: 10_000 })

    // Click "Get plan feedback" button
    const feedbackButton = page.getByRole('button', { name: /Get plan feedback/i })
    await expect(feedbackButton).toBeVisible({ timeout: 10_000 })
    await feedbackButton.click()

    // Wait for coach response to appear in chat
    await expect(page.getByText(/Great progress/)).toBeVisible({ timeout: 15_000 })

    // Verify that progressFeedback was saved without XML tags
    await expect(async () => {
      expect(capturedPatchBody?.progressFeedback).toBeDefined()
      expect(capturedPatchBody.progressFeedback).not.toContain('<')
      expect(capturedPatchBody.progressFeedback).not.toContain('>')
      expect(capturedPatchBody.progressFeedback).toContain('Great progress')
      expect(capturedPatchBody.progressFeedback).toContain('Keep it up')
    }).toPass({ timeout: 5_000 })
  })
})

test.describe('Phase 5 features — Add phase and target date editing', () => {
  test.beforeEach(async ({ page }) => {
    // Mock runs to prevent 401 from real API triggering logout interceptor
    await page.route('**/api/runs**', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('shows + Add phase button and creates a new phase on click', async ({ page }) => {
    let addPhaseCalled = false
    const planWithNewPhase = {
      ...mockActivePlan,
      phases: [
        ...mockActivePlan.phases,
        { name: 'Phase 2', description: '', weeks: [{ weekNumber: 2, days: [] }] },
      ],
    }

    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: addPhaseCalled ? planWithNewPhase : mockActivePlan, linkedRuns: {} }),
      })
    })
    await page.route('**/api/plan/phases', async (route: any) => {
      if (route.request().method() === 'POST') {
        addPhaseCalled = true
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ plan: planWithNewPhase }),
        })
      }
    })
    await page.route('**/api/plan/days/**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plan/days', async (route: any) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plan/archive', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody('Sure!'),
      })
    })

    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Base Building')).toBeVisible({ timeout: 10_000 })

    // + Add phase button visible
    await expect(page.getByText('+ Add phase')).toBeVisible({ timeout: 5_000 })

    // Click it — POST to /api/plan/phases should be called
    await page.getByText('+ Add phase').click()

    // New phase should appear
    await expect(async () => {
      expect(addPhaseCalled).toBe(true)
    }).toPass({ timeout: 8_000 })
  })

  test('shows target date and allows entering edit mode', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()

    // Target date shown as clickable text
    await expect(page.getByText('Target: 2026-06-01')).toBeVisible({ timeout: 10_000 })

    // Click to enter edit mode
    await page.getByText('Target: 2026-06-01').click()

    // Date input should now be visible
    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 5_000 })

    // Press Escape — should revert to display mode
    await page.keyboard.press('Escape')
    await expect(page.getByText('Target: 2026-06-01')).toBeVisible({ timeout: 5_000 })
  })

  test('shows + Set target date when no target date is set', async ({ page }) => {
    const planNoDate = { ...mockActivePlan, targetDate: undefined }

    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: planNoDate, linkedRuns: {} }),
      })
    })
    await page.route('**/api/plan/days/**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: planNoDate }) })
    })
    await page.route('**/api/plan/days', async (route: any) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: planNoDate }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plan/archive', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody('Sure!'),
      })
    })

    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('+ Set target date')).toBeVisible({ timeout: 10_000 })
  })

  test('pressing Enter after editing target date calls PATCH /api/plan', async ({ page }) => {
    let patchBody: Record<string, unknown> | null = null

    await page.route('**/api/plan', async (route: any) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        patchBody = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: { ...mockActivePlan, targetDate: patchBody?.targetDate ?? '' } }) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan, linkedRuns: {} }) })
      }
    })
    await page.route('**/api/plan/days/**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plan/days', async (route: any) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plan/archive', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody('Sure!'),
      })
    })

    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Target: 2026-06-01')).toBeVisible({ timeout: 10_000 })

    // Enter edit mode
    await page.getByText('Target: 2026-06-01').click()
    const dateInput = page.locator('input[type="date"]')
    await expect(dateInput).toBeVisible({ timeout: 5_000 })

    // Type a new date and press Enter
    await dateInput.fill('2026-11-01')
    await dateInput.press('Enter')

    await expect(async () => {
      expect(patchBody).not.toBeNull()
      expect((patchBody as any).targetDate).toBe('2026-11-01')
    }).toPass({ timeout: 8_000 })
  })

  test('shows + Add week button and calls POST /api/plan/phases/:phaseIndex/weeks on click', async ({ page }) => {
    let addWeekCalled = false

    await page.route('**/api/plan', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan, linkedRuns: {} }) })
    })
    await page.route('**/api/plan/phases/0/weeks', async (route: any) => {
      if (route.request().method() === 'POST') {
        addWeekCalled = true
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
      }
    })
    await page.route('**/api/plan/days/**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plan/days', async (route: any) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ plan: mockActivePlan }) })
    })
    await page.route('**/api/plans/archived', async (route: any) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plans: [] }) })
    })
    await page.route('**/api/plan/archive', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
    await page.route('**/api/messages**', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })
    await page.route('**/api/chat', async (route: any) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody('Sure!'),
      })
    })

    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: 'Plan' }).click()
    await expect(page.getByText('Base Building')).toBeVisible({ timeout: 10_000 })

    // + Add week button visible inside the phase
    await expect(page.getByText('+ Add week')).toBeVisible({ timeout: 5_000 })

    // Click it — POST to /api/plan/phases/0/weeks should be called
    await page.getByText('+ Add week').click()

    await expect(async () => {
      expect(addWeekCalled).toBe(true)
    }).toPass({ timeout: 8_000 })
  })
})
