import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useChat } from '../hooks/useChat'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children)

const testPhases = [
  {
    name: 'Base',
    description: '',
    weeks: [
      {
        weekNumber: 1,
        startDate: '2026-04-07',
        days: [{ date: '2026-04-07', type: 'run', guidelines: 'Easy run', completed: false, skipped: false }],
      },
    ],
  },
]

const testPlan = {
  _id: 'plan1',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 0,
  goal: { eventType: 'half-marathon', targetDate: '2026-05-17', weeklyMileage: 30, availableDays: 3, units: 'km' },
  phases: testPhases,
}

function makeStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
  return { ok: true, body: stream, json: async () => ({}) }
}

describe('sendMessage — planState in request body', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.setItem('app_password', 'test-pw')
    // Mount: return existing active plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // Messages fetch
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })
  })

  it('sends planId, message, and currentDate in the /api/chat request body', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Hello!"}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('hi')
    })

    const chatCall = mockFetch.mock.calls.find(([url]: string[]) => url === '/api/chat')
    expect(chatCall).toBeDefined()
    const body = JSON.parse(chatCall![1].body as string)
    expect(body.planId).toBe('plan1')
    expect(body.message).toBe('hi')
    expect(body.currentDate).toBeDefined()
  })

  it('does NOT call /api/plan/generate when server signals planGenerated', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Here is your plan!"}\n\n',
        'data: {"done":true,"planGenerated":true}\n\n',
      ])
    )
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('create my plan')
    })

    const generateCalls = mockFetch.mock.calls.filter(([url]: string[]) => url === '/api/plan/generate')
    expect(generateCalls).toHaveLength(0)
  })
})

describe('startPlan — planGenerated flow', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.setItem('app_password', 'test-pw')
    // Mount: no existing plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: null }) })
  })

  it('does NOT call /api/plan/generate when startPlan receives planGenerated=true', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const onboardingPlan = { ...testPlan, _id: 'plan2', status: 'onboarding', onboardingStep: 0, phases: [] }

    // POST /api/plan → new onboarding plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: onboardingPlan }) })
    // POST /api/chat stream → planGenerated: true
    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Here is your training plan!"}\n\n',
        'data: {"done":true,"planGenerated":true}\n\n',
      ])
    )
    // GET /api/plan → active plan after server saved it
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.startPlan('conversational')
    })

    const generateCalls = mockFetch.mock.calls.filter(([url]: string[]) => url === '/api/plan/generate')
    expect(generateCalls).toHaveLength(0)
    expect(result.current.plan?._id).toBe('plan1')
  })
})

// Two regexes used in useChat.ts:
// 1. Live streaming (no closing tag yet): /<training_plan>[\s\S]*/g
// 2. End-of-stream cleanup (closing tag present): /<training_plan>[\s\S]*?<\/training_plan>/g

const stripTrainingPlanLive = (content: string): string =>
  content.replace(/<training_plan>[\s\S]*/g, '').trim()

const stripTrainingPlan = (content: string): string =>
  content.replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '').trim()

describe('training_plan live-stream stripping (no closing tag)', () => {
  it('strips everything from <training_plan> to end when tag is open', () => {
    const partial = 'Great news! Here is your plan.\n\n<training_plan>{"phases":[{"name":"Base"'
    expect(stripTrainingPlanLive(partial)).toBe('Great news! Here is your plan.')
  })

  it('preserves text before <training_plan> when tag just opened', () => {
    const partial = 'Your plan is ready!\n<training_plan>'
    expect(stripTrainingPlanLive(partial)).toBe('Your plan is ready!')
  })

  it('returns content unchanged when no <training_plan> tag', () => {
    const text = 'How many days per week can you train?'
    expect(stripTrainingPlanLive(text)).toBe(text)
  })

  it('handles mid-JSON truncation gracefully', () => {
    const partial =
      'Here is your 6-month plan.\n\n' +
      '<training_plan>{"phases":[{"name":"Base Building","weeks":[{"weekNumber":1'
    expect(stripTrainingPlanLive(partial)).toBe('Here is your 6-month plan.')
    expect(stripTrainingPlanLive(partial)).not.toContain('<training_plan>')
  })
})

describe('training_plan tag stripping', () => {
  it('strips a <training_plan> block leaving only the human-readable text', () => {
    const raw =
      'Great news! Here is your 8-week plan.\n\n' +
      '<training_plan>[{"date":"2025-01-06","distance":3,"notes":"Easy run"}]</training_plan>'

    const result = stripTrainingPlan(raw)
    expect(result).toBe('Great news! Here is your 8-week plan.')
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('2025-01-06')
  })

  it('strips a multiline <training_plan> block', () => {
    const raw =
      'Here is your plan:\n\n' +
      '<training_plan>[\n' +
      '  {"date":"2025-01-06","distance":3},\n' +
      '  {"date":"2025-01-08","distance":4}\n' +
      ']</training_plan>\n\n' +
      'Good luck!'

    const result = stripTrainingPlan(raw)
    // Surrounding newlines remain after stripping the tag block
    expect(result).toBe('Here is your plan:\n\n\n\nGood luck!')
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('2025-01-06')
  })

  it('returns content unchanged when no <training_plan> tag is present', () => {
    const raw = 'How many days per week can you train?'
    expect(stripTrainingPlan(raw)).toBe(raw)
  })

  it('strips multiple <training_plan> blocks if present', () => {
    const raw =
      'Plan A: <training_plan>[{"date":"2025-01-01"}]</training_plan> ' +
      'Plan B: <training_plan>[{"date":"2025-02-01"}]</training_plan> Done.'

    const result = stripTrainingPlan(raw)
    expect(result).toBe('Plan A:  Plan B:  Done.')
    expect(result).not.toContain('<training_plan>')
  })

  it('strips a <training_plan> block that contains the full coach response from the live API', () => {
    const raw =
      "You're all set! Here's your personalized 8-week 5K plan:\n\n" +
      '**Week 1-2**: Base building\n' +
      '**Week 7**: Taper week\n\n' +
      '<training_plan>[{"date":"2025-01-06","distance":3,"duration":20,"avgPace":"6:40","notes":"Easy run"},' +
      '{"date":"2025-01-08","distance":3.5,"duration":24,"avgPace":"6:50","notes":"Easy run"}]</training_plan>\n\n' +
      "You're going to do great!"

    const result = stripTrainingPlan(raw)
    expect(result).toContain("You're all set!")
    expect(result).toContain('**Week 1-2**: Base building')
    expect(result).toContain("You're going to do great!")
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('"avgPace"')
  })
})
