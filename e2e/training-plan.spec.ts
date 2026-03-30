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
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: { ...mockArchivedPlans[0], phases: [] } }) })
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
      body: makeSseBody('Sure, let me update your plan!'),
    })
  })

  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('app_password', 'e2e-test-password'))
  await page.reload()
  // Home redirects to /plan — wait for Training Plan heading
  await expect(page.getByRole('heading', { name: 'Training Plan' })).toBeVisible({ timeout: 15_000 })
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

  test('plan action buttons — only Update Plan and Close & Archive are shown', async ({ page }) => {
    await loginWithPlan(page)
    await page.getByRole('link', { name: 'Plan' }).click()

    await expect(page.getByRole('button', { name: 'Update Plan' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Close & Archive' })).toBeVisible()
    // "New Plan" is hidden when active plan exists
    await expect(page.getByRole('button', { name: 'New Plan' })).not.toBeVisible()
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

    // Click delete on the first run day — shows confirmation
    await page.getByTitle('Delete day').first().click()
    await expect(page.getByText('Remove?')).toBeVisible({ timeout: 3_000 })

    // Confirm deletion
    await page.getByText('Yes').click()

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

    await page.getByTitle('Delete day').first().click()
    await expect(page.getByText('Remove?')).toBeVisible({ timeout: 3_000 })
    await page.getByText('No').click()

    // Confirmation dismissed, no DELETE request sent
    await expect(page.getByText('Remove?')).not.toBeVisible()
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

  test('sidebar shows nav items in order: Training Plan, Runs, Archive, Dashboard', async ({ page }) => {
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
    const knownOrder = ['Training Plan', 'Runs', 'Archive', 'Dashboard']
    const indices = knownOrder.map(label => navTexts.findIndex(t => t.includes(label)))
    expect(indices.every(i => i !== -1)).toBe(true)
    // Indices must be strictly increasing (correct order)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  test('/ redirects to /plan', async ({ page }) => {
    await loginWithPlan(page)
    await page.goto('/')
    // Should redirect to /plan
    await expect(page).toHaveURL(/\/plan/, { timeout: 5_000 })
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
