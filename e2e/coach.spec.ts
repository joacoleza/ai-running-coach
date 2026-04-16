import { test, expect } from '@playwright/test'

/**
 * Build a fake SSE body in the format the chat endpoint emits.
 * page.route() fulfills requests at the browser level — the real API server
 * never processes these requests, so ANTHROPIC_API_KEY is irrelevant.
 */
function makeSseBody(text: string): string {
  return `data: ${JSON.stringify({ text })}\n\ndata: ${JSON.stringify({ done: true })}\n\n`
}

const mockPlanBase = {
  _id: 'mock-plan-id',
  status: 'onboarding' as const,
  onboardingStep: 0,
  onboardingMode: 'conversational' as const,
  goal: {},
  sessions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test.describe('Coach chat (E2E with mocked /api/chat)', () => {
  test.beforeEach(async ({ page }) => {
    // All API routes are mocked via page.route() — no real MongoDB interaction needed.
    // Just ensure we start from a clean browser state.
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  /**
   * Set up browser-level route mocks for all /api/* calls used by the coach.
   * currentPlan is a shared reference — updated by POST /api/plan so GET reads it back.
   */
  async function setupMocks(
    page: Parameters<typeof test>[1] extends (args: infer A) => any ? A extends { page: infer P } ? P : never : never,
    opts: { initialPlan?: typeof mockPlanBase | null; coachReply?: string; messages?: unknown[] } = {},
  ) {
    const { coachReply = 'What is your goal race?', messages = [], initialPlan = null } = opts
    let currentPlan: typeof mockPlanBase | null = initialPlan

    await page.route('**/api/plan', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ plan: currentPlan }),
        })
      } else {
        currentPlan = { ...mockPlanBase }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ plan: currentPlan }),
        })
      }
    })

    await page.route('**/api/messages**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ messages }),
      })
    })

    // Mock runs to prevent 401 from real API triggering the logout interceptor
    await page.route('**/api/runs**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }),
      })
    })

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: makeSseBody(coachReply),
      })
    })
  }

  async function loginWithMocks(
    page: Parameters<typeof test>[1] extends (args: infer A) => any ? A extends { page: infer P } ? P : never : never,
    opts: Parameters<typeof setupMocks>[1] = {},
  ) {
    await setupMocks(page, opts)
    await page.goto('/')
    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    // Wait for the main app shell to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })
  }

  test('shows welcome screen with Start New Plan button when no plan exists', async ({ page }) => {
    await loginWithMocks(page, { initialPlan: null })

    await expect(page.getByRole('button', { name: 'Start New Plan' })).toBeVisible({ timeout: 10_000 })
    // Import from Existing Plan was removed — only conversational onboarding is supported
    await expect(page.getByRole('button', { name: 'Import from Existing Plan' })).not.toBeVisible()
  })

  test('starts plan and displays streaming coach response', async ({ page }) => {
    await loginWithMocks(page, { coachReply: 'What is your goal race distance?' })

    await page.getByRole('button', { name: 'Start New Plan' }).click()

    await expect(page.getByText('What is your goal race distance?')).toBeVisible({ timeout: 15_000 })
  })

  test('can type and send a message after plan is started', async ({ page }) => {
    await loginWithMocks(page, { coachReply: 'Great! When is your target race?' })

    await page.getByRole('button', { name: 'Start New Plan' }).click()
    await expect(page.getByText('Great! When is your target race?')).toBeVisible({ timeout: 15_000 })

    // Wait for streaming to finish (input enabled after isStreaming = false)
    const input = page.getByPlaceholder('Type a message...')
    await expect(input).toBeEnabled({ timeout: 10_000 })

    await input.fill('I want to run a 10K')
    await page.getByRole('button', { name: 'Send' }).click()

    // The sent message appears in the conversation
    await expect(page.getByText('I want to run a 10K')).toBeVisible({ timeout: 10_000 })
    // And the next coach reply appears
    await expect(page.getByText('Great! When is your target race?').first()).toBeVisible()
  })

  test('Start Over button returns to welcome screen', async ({ page }) => {
    await loginWithMocks(page, { coachReply: 'What is your goal?' })

    await page.getByRole('button', { name: 'Start New Plan' }).click()
    await expect(page.getByText('What is your goal?')).toBeVisible({ timeout: 15_000 })

    // Start Over only appears during onboarding
    await page.getByRole('button', { name: 'Start Over' }).click()

    // Welcome screen returns
    await expect(page.getByRole('button', { name: 'Start New Plan' })).toBeVisible({ timeout: 10_000 })
  })

  test('past messages are visible in coach panel when plan is active', async ({ page }) => {
    const pastMessages = [
      { role: 'user', content: 'Hello coach', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date().toISOString() },
    ]
    await loginWithMocks(page, {
      initialPlan: { ...mockPlanBase, status: 'active' as const },
      messages: pastMessages,
    })

    // Messages are loaded directly into the panel — no history button needed
    await expect(page.getByText('Hello coach')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Hello! How can I help you today?')).toBeVisible()
  })

  test('mobile: FAB is visible and opens coach panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginWithMocks(page, { initialPlan: null })

    // When no plan, FAB label is "Start New Plan"
    const fab = page.getByRole('button', { name: 'Start New Plan' }).first()
    await expect(fab).toBeVisible({ timeout: 10_000 })

    // Tapping FAB opens the coach panel (welcome screen inside the panel)
    await fab.click()
    await expect(page.getByRole('button', { name: 'Close coach' })).toBeVisible({ timeout: 10_000 })
  })

  test('mobile: close button hides coach panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginWithMocks(page, { initialPlan: null })

    // Open the coach panel via FAB
    await page.getByRole('button', { name: 'Start New Plan' }).first().click()
    await expect(page.getByRole('button', { name: 'Close coach' })).toBeVisible({ timeout: 10_000 })

    // Close via the X button inside the panel
    await page.getByRole('button', { name: 'Close coach' }).click()

    // Main content (Dashboard) should be visible again
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10_000 })
  })

  test('planGenerated=true: re-fetches plan via GET /api/plan, never calls /api/plan/generate', async ({ page }) => {
    const planWithPhases = {
      ...mockPlanBase,
      status: 'active' as const,
      objective: 'Half marathon in spring',
      phases: [
        {
          name: 'Base',
          weeks: [
            {
              weekNumber: 1,
              days: [{ date: '2026-04-07', type: 'run', guidelines: 'Easy run', completed: false, skipped: false }],
            },
          ],
        },
      ],
    }

    // phase tracks app state so GET /api/plan returns the right plan at each stage
    let phase: 'initial' | 'onboarding' | 'planSaved' = 'initial'
    let generateEndpointCalled = false
    let planGetAfterSaveCount = 0

    await page.route('**/api/plan/generate', async (route) => {
      generateEndpointCalled = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: planWithPhases }) })
    })

    await page.route('**/api/plan', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        if (phase === 'planSaved') {
          planGetAfterSaveCount++
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: planWithPhases }) })
        } else {
          // Before onboarding or during onboarding: no plan yet (shows welcome screen)
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ plan: null }) })
        }
      } else {
        // POST /api/plan — create onboarding plan so startPlan flow proceeds
        phase = 'onboarding'
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ plan: { ...mockPlanBase } }),
        })
      }
    })

    await page.route('**/api/messages**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) })
    })

    // Mock runs to prevent 401 from real API triggering logout interceptor
    await page.route('**/api/runs**', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], total: 0, totalAll: 0 }) })
    })

    // Chat responds with planGenerated: true — set phase BEFORE fulfilling so subsequent GETs return the saved plan
    await page.route('**/api/chat', async (route) => {
      phase = 'planSaved'
      const body =
        `data: ${JSON.stringify({ text: 'Here is your training plan!' })}\n\n` +
        `data: ${JSON.stringify({ done: true, planGenerated: true })}\n\n`
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body,
      })
    })

    await page.evaluate(() => { localStorage.setItem('access_token', 'e2e-test-token'); localStorage.setItem('auth_temp_password', 'false'); localStorage.setItem('auth_email', 'test@example.com'); })
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Start New Plan' }).click()
    await expect(page.getByText('Here is your training plan!')).toBeVisible({ timeout: 15_000 })

    // After planGenerated: true, the client must have re-fetched via GET /api/plan
    expect(planGetAfterSaveCount).toBeGreaterThanOrEqual(1)
    // /api/plan/generate must never have been called — server saves the plan, client only re-fetches
    expect(generateEndpointCalled).toBe(false)
  })
})
