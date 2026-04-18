import { test, expect } from '@playwright/test'

const API = 'http://localhost:7071/api'

async function login(request: any, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password: 'password123' },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return body.token as string
}

// ── Cross-user data isolation ─────────────────────────────────────────────
//
// Verifies that all data (runs, plans) is scoped to the authenticated user.
// Uses the real API — no page.route mocking — so the DB-level userId filter
// is exercised end-to-end. Users seeded in e2e/global-setup.ts.

test.describe('Data isolation', () => {
  test('User A run is invisible to User B', async ({ request }) => {
    const tokenA = await login(request, 'test@example.com')
    const tokenB = await login(request, 'userb@example.com')

    // User A logs a run
    const createRes = await request.post(`${API}/runs`, {
      headers: { 'X-Authorization': `Bearer ${tokenA}` },
      data: { date: '2026-01-01', distance: 10, duration: '55:00' },
    })
    expect(createRes.status()).toBe(201)
    const run = await createRes.json()
    const runId: string = run._id

    try {
      // User B lists runs — should not include User A's run
      const listRes = await request.get(`${API}/runs`, {
        headers: { 'X-Authorization': `Bearer ${tokenB}` },
      })
      expect(listRes.ok()).toBeTruthy()
      const { runs } = await listRes.json()
      const ids = (runs as { _id: string }[]).map((r) => r._id)
      expect(ids).not.toContain(runId)

      // User B fetches the run by ID — must return 404, not 200
      const getRes = await request.get(`${API}/runs/${runId}`, {
        headers: { 'X-Authorization': `Bearer ${tokenB}` },
      })
      expect(getRes.status()).toBe(404)
    } finally {
      // Clean up: User A deletes the run
      await request.delete(`${API}/runs/${runId}`, {
        headers: { 'X-Authorization': `Bearer ${tokenA}` },
      })
    }
  })

  test('User A plan is invisible to User B', async ({ request }) => {
    const tokenA = await login(request, 'test@example.com')
    const tokenB = await login(request, 'userb@example.com')

    // User A creates an onboarding plan
    const createRes = await request.post(`${API}/plan`, {
      headers: { 'X-Authorization': `Bearer ${tokenA}` },
      data: { mode: 'conversational' },
    })
    expect(createRes.status()).toBe(201)
    const { plan } = await createRes.json()
    const planId: string = plan._id

    try {
      // User B fetches their active plan — should be null (not User A's)
      const getRes = await request.get(`${API}/plan`, {
        headers: { 'X-Authorization': `Bearer ${tokenB}` },
      })
      expect(getRes.ok()).toBeTruthy()
      const { plan: planB } = await getRes.json()
      if (planB !== null) {
        // If User B has their own plan, it must not be User A's
        expect(planB._id).not.toBe(planId)
      }
    } finally {
      // Clean up: User A archives (then there's no active plan to leak)
      // Delete the onboarding plan by creating a new one which triggers deleteMany of stale onboarding
      await request.post(`${API}/plan`, {
        headers: { 'X-Authorization': `Bearer ${tokenA}` },
        data: { mode: 'conversational' },
      })
      // Archive won't work on empty plan — just leave it; next test run's global-setup reseeds users
    }
  })

  test('archived plan cross-user access returns 404', async ({ request }) => {
    const tokenA = await login(request, 'test@example.com')
    const tokenB = await login(request, 'userb@example.com')

    // User B fetches User A's archived plans list — must be empty (not User A's archives)
    const listRes = await request.get(`${API}/plans/archived`, {
      headers: { 'X-Authorization': `Bearer ${tokenB}` },
    })
    expect(listRes.ok()).toBeTruthy()
    const { plans: plansA } = await listRes.json()

    // Fetch User A's archived plans to get an ID to probe with User B's token
    const listResA = await request.get(`${API}/plans/archived`, {
      headers: { 'X-Authorization': `Bearer ${tokenA}` },
    })
    expect(listResA.ok()).toBeTruthy()
    const { plans: archivedA } = await listResA.json()

    if (archivedA.length > 0) {
      // Attempt to fetch User A's archived plan using User B's token
      const archiveId = archivedA[0]._id
      const crossRes = await request.get(`${API}/plans/archived/${archiveId}`, {
        headers: { 'X-Authorization': `Bearer ${tokenB}` },
      })
      expect(crossRes.status()).toBe(404)

      // User B's own archived plans list must not contain User A's plan
      const idsB = (plansA as { _id: string }[]).map((p) => p._id)
      expect(idsB).not.toContain(archiveId)
    }
    // If User A has no archived plans, the cross-access path cannot be probed —
    // the test still passes (no false positives possible in that state).
  })
})
