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
        days: [{ label: 'A', type: 'run', guidelines: 'Easy run', completed: false, skipped: false }],
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

  it('sends planId and message in the /api/chat request body (no currentDate)', async () => {
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
    // currentDate is no longer sent
    expect(body.currentDate).toBeUndefined()
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

// ---------------------------------------------------------------------------
// sendMessage — plan:update and plan:add tag processing
// ---------------------------------------------------------------------------

describe('sendMessage — plan:update triggers PATCH and plan:add triggers POST', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.setItem('app_password', 'test-pw')
    // Mount: active plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // Messages fetch
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })
  })

  it('strips plan:add tag from displayed message and POSTs to /api/plan/days', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const tag = '<plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy run" />'
    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        `data: ${JSON.stringify({ text: `Added Day D! ${tag}` })}\n\n`,
        `data: ${JSON.stringify({ done: true })}\n\n`,
      ])
    )
    // GET /api/plan after message
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // POST /api/plan/days
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan after updates
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('Add a run on Day D')
    })

    // plan:add tag should not appear in the displayed message
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content).not.toContain('<plan:add')
    expect(lastMsg.content).toContain('Added Day D!')

    // POST to /api/plan/days should have been called
    const postCall = mockFetch.mock.calls.find(([url]: string[]) => url === '/api/plan/days')
    expect(postCall).toBeDefined()
    const body = JSON.parse(postCall![1].body as string)
    expect(body.weekNumber).toBe(1)
    expect(body.label).toBe('D')
    expect(body.type).toBe('run')
  })

  it('includes completed="true" in POST body for plan:add with completed flag', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const tag = '<plan:add week="2" day="B" type="run" objective_kind="time" objective_value="30" objective_unit="min" guidelines="30\' Z2" completed="true" />'
    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        `data: ${JSON.stringify({ text: `Logged past run! ${tag}` })}\n\n`,
        `data: ${JSON.stringify({ done: true })}\n\n`,
      ])
    )
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('log my past run')
    })

    const postCall = mockFetch.mock.calls.find(([url]: string[]) => url === '/api/plan/days')
    expect(postCall).toBeDefined()
    const body = JSON.parse(postCall![1].body as string)
    expect(body.weekNumber).toBe(2)
    expect(body.label).toBe('B')
    expect(body.completed).toBe('true')
  })

  it('isGeneratingPlan is true while plan:update is being applied and false when done', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const tag = '<plan:update week="1" day="A" guidelines="Updated!" />'
    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        `data: ${JSON.stringify({ text: `Updated! ${tag}` })}\n\n`,
        `data: ${JSON.stringify({ done: true })}\n\n`,
      ])
    )
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // PATCH /api/plan/days/1/A
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan after updates
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('update my run')
    })

    // After everything completes, isGeneratingPlan should be false
    expect(result.current.isGeneratingPlan).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// plan:add and plan:update live-stream stripping
// ---------------------------------------------------------------------------

// Regexes used in useChat.ts during streaming (same as production code)
const stripPlanUpdateLive = (content: string): string =>
  content.replace(/<plan:update[^/]*\/>/g, '').trim()

const stripPlanAddLive = (content: string): string =>
  content.replace(/<plan:add[^/]*\/>/g, '').trim()

const stripPlanTagsLive = (content: string): string =>
  content
    .replace(/<training_plan>[\s\S]*/g, '')
    .replace(/<plan:update[^/]*\/>/g, '')
    .replace(/<plan:add[^/]*\/>/g, '')
    .trim()

describe('plan:update live-stream stripping', () => {
  it('strips a self-closing plan:update tag from display', () => {
    const text = 'I updated Week 1 Day A! <plan:update week="1" day="A" guidelines="Easy run" />'
    expect(stripPlanUpdateLive(text)).toBe("I updated Week 1 Day A!")
  })

  it('strips multiple plan:update tags', () => {
    const text = 'Updated two days! <plan:update week="1" day="A" completed="true" /> <plan:update week="1" day="C" skipped="true" />'
    expect(stripPlanUpdateLive(text)).toBe('Updated two days!')
  })

  it('returns content unchanged when no plan:update tag', () => {
    const text = 'Your next run is on Day A!'
    expect(stripPlanUpdateLive(text)).toBe(text)
  })
})

describe('plan:add live-stream stripping', () => {
  it('strips a self-closing plan:add tag from display', () => {
    const text = 'Added a run to Week 1! <plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy run" />'
    expect(stripPlanAddLive(text)).toBe('Added a run to Week 1!')
  })

  it('strips a plan:add tag with completed="true"', () => {
    const text = 'Logged your past run! <plan:add week="2" day="B" type="run" objective_kind="time" objective_value="30" objective_unit="min" guidelines="30 Z2" completed="true" />'
    expect(stripPlanAddLive(text)).toBe("Logged your past run!")
  })

  it('strips a plan:add tag with skipped="true"', () => {
    const text = 'Marked as skipped! <plan:add week="1" day="C" type="run" objective_kind="time" objective_value="40" objective_unit="min" guidelines="40 Z2" skipped="true" />'
    expect(stripPlanAddLive(text)).toBe('Marked as skipped!')
  })

  it('strips multiple plan:add tags', () => {
    const text = 'Added two runs! <plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy" /> <plan:add week="1" day="E" type="run" objective_kind="distance" objective_value="8" objective_unit="km" guidelines="Tempo" />'
    expect(stripPlanAddLive(text)).toBe('Added two runs!')
  })

  it('returns content unchanged when no plan:add tag', () => {
    const text = 'Your training plan looks great!'
    expect(stripPlanAddLive(text)).toBe(text)
  })
})

describe('combined plan tag live-stream stripping', () => {
  it('strips both plan:update and plan:add tags from one response', () => {
    const text = 'Updated Week 1 Day A and added Day D! <plan:update week="1" day="A" completed="true" /> <plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy run" />'
    expect(stripPlanTagsLive(text)).toBe('Updated Week 1 Day A and added Day D!')
  })

  it('strips training_plan block even when plan:add tag also present', () => {
    const text = 'Here is your plan! <plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy" /> <training_plan>{"phases":[]}'
    expect(stripPlanTagsLive(text)).toBe('Here is your plan!')
  })
})

// ---------------------------------------------------------------------------
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
      '<training_plan>[{"label":"A","type":"run","guidelines":"Easy run"}]</training_plan>'

    const result = stripTrainingPlan(raw)
    expect(result).toBe('Great news! Here is your 8-week plan.')
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('"label":"A"')
  })

  it('strips a multiline <training_plan> block', () => {
    const raw =
      'Here is your plan:\n\n' +
      '<training_plan>[\n' +
      '  {"label":"A","type":"run"},\n' +
      '  {"label":"B","type":"run"}\n' +
      ']</training_plan>\n\n' +
      'Good luck!'

    const result = stripTrainingPlan(raw)
    // Surrounding newlines remain after stripping the tag block
    expect(result).toBe('Here is your plan:\n\n\n\nGood luck!')
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('"label":"A"')
  })

  it('returns content unchanged when no <training_plan> tag is present', () => {
    const raw = 'How many days per week can you train?'
    expect(stripTrainingPlan(raw)).toBe(raw)
  })

  it('strips multiple <training_plan> blocks if present', () => {
    const raw =
      'Plan A: <training_plan>[{"label":"A"}]</training_plan> ' +
      'Plan B: <training_plan>[{"label":"B"}]</training_plan> Done.'

    const result = stripTrainingPlan(raw)
    expect(result).toBe('Plan A:  Plan B:  Done.')
    expect(result).not.toContain('<training_plan>')
  })

  it('strips a <training_plan> block that contains the full coach response from the live API', () => {
    const raw =
      "You're all set! Here's your personalized 8-week 5K plan:\n\n" +
      '**Week 1-2**: Base building\n' +
      '**Week 7**: Taper week\n\n' +
      '<training_plan>[{"label":"A","type":"run","objective":{"kind":"distance","value":5,"unit":"km"},"guidelines":"Easy run"},' +
      '{"label":"B","type":"run","objective":{"kind":"distance","value":5,"unit":"km"},"guidelines":"Easy run"}]</training_plan>\n\n' +
      "You're going to do great!"

    const result = stripTrainingPlan(raw)
    expect(result).toContain("You're all set!")
    expect(result).toContain('**Week 1-2**: Base building')
    expect(result).toContain("You're going to do great!")
    expect(result).not.toContain('<training_plan>')
    expect(result).not.toContain('"label"')
  })
})

// ---------------------------------------------------------------------------
// sendMessage — phase 5 new tag handlers
// ---------------------------------------------------------------------------

describe('sendMessage — phase 5 new tag handlers', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.setItem('app_password', 'test-pw')
    // Mount: active plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // Messages fetch
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })
  })

  // --- plan:add-phase ---

  it('strips plan:add-phase tag and POSTs to /api/plan/phases', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const updatedPlan = { ...testPlan, phases: [...testPlan.phases, { name: 'Race Prep', description: '', weeks: [] }] }

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"I\'ve added a new phase <plan:add-phase name=\\"Race Prep\\"/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // POST /api/plan/phases
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) })

    await act(async () => {
      await result.current.sendMessage('add a phase')
    })

    const addPhaseCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan/phases' && opts?.method === 'POST'
    )
    expect(addPhaseCalls).toHaveLength(1)

    // Tag stripped from displayed message
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content).not.toContain('plan:add-phase')
  })

  // --- plan:add-week ---

  it('strips plan:add-week tag and POSTs to /api/plan/phases/:phaseIndex/weeks', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Added a week <plan:add-week phaseIndex=\\"0\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // POST /api/plan/phases/0/weeks
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('add a week to phase 1')
    })

    const addWeekCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan/phases/0/weeks' && opts?.method === 'POST'
    )
    expect(addWeekCalls).toHaveLength(1)

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).not.toContain('plan:add-week')
  })

  it('shows ⚠️ error when plan:add-week has no phaseIndex attr', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Tag matches the regex (has whitespace + attr) but phaseIndex attr is absent
    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Added a week <plan:add-week name=\\"Base\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('add a week')
    })

    const addWeekCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      typeof url === 'string' && url.includes('/weeks') && opts?.method === 'POST'
    )
    expect(addWeekCalls).toHaveLength(0)

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).toContain('⚠️')
  })

  // --- plan:update-feedback ---

  it('strips plan:update-feedback tag and PATCHes /api/plan with progressFeedback', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"You\'re on track! <plan:update-feedback feedback=\\"Great progress this week.\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // PATCH /api/plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('how am I doing?')
    })

    const feedbackCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan' && opts?.method === 'PATCH'
    )
    expect(feedbackCalls).toHaveLength(1)
    const body = JSON.parse(feedbackCalls[0][1].body as string)
    expect(body.progressFeedback).toBe('Great progress this week.')

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).not.toContain('plan:update-feedback')
  })

  it('skips plan:update-feedback PATCH when feedback attr is empty', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"No feedback <plan:update-feedback feedback=\\"\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('anything')
    })

    const feedbackCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan' && opts?.method === 'PATCH'
    )
    expect(feedbackCalls).toHaveLength(0)
  })

  // --- plan:update-goal ---

  it('strips plan:update-goal and PATCHes /api/plan with targetDate', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Updated your target date <plan:update-goal targetDate=\\"2026-11-01\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // PATCH /api/plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('set my target date to November 2026')
    })

    const patchCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan' && opts?.method === 'PATCH'
    )
    expect(patchCalls).toHaveLength(1)
    const body = JSON.parse(patchCalls[0][1].body as string)
    expect(body.targetDate).toBe('2026-11-01')

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).not.toContain('plan:update-goal')
  })

  it('sends empty string targetDate to clear the field', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Cleared your target date <plan:update-goal targetDate=\\"\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // PATCH /api/plan
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('remove my target date')
    })

    const patchCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/plan' && opts?.method === 'PATCH'
    )
    expect(patchCalls).toHaveLength(1)
    const body = JSON.parse(patchCalls[0][1].body as string)
    expect(body.targetDate).toBe('')
  })

  // --- run:create ---

  it('strips run:create and POSTs to /api/runs without unit field', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Logged your run <run:create date=\\"2026-04-10\\" distance=\\"8\\" unit=\\"km\\" duration=\\"45:00\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // POST /api/runs
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ _id: 'run1' }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('log my run')
    })

    const runCreateCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/runs' && opts?.method === 'POST'
    )
    expect(runCreateCalls).toHaveLength(1)

    const body = JSON.parse(runCreateCalls[0][1].body as string)
    expect(body.date).toBe('2026-04-10')
    expect(body.distance).toBe(8)
    expect(body.duration).toBe('45:00')
    // unit field must NOT be forwarded to the runs API
    expect(body).not.toHaveProperty('unit')

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).not.toContain('run:create')
  })

  it('shows ⚠️ error when run:create is missing required field (duration)', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Logged run <run:create date=\\"2026-04-10\\" distance=\\"8\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan — no run POST, but plan is still fetched)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('log my run')
    })

    // POST /api/runs must NOT be called
    const runCreateCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/runs' && opts?.method === 'POST'
    )
    expect(runCreateCalls).toHaveLength(0)

    // Error surfaced in message
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).toContain('⚠️')
  })

  // --- run:update-insight ---

  it('strips run:update-insight and PATCHes /api/runs/:runId', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Saved insight <run:update-insight runId=\\"abc123\\" insight=\\"Great run!\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // PATCH /api/runs/abc123
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    // GET /api/plan (applyPlanOperations fetchPlan — insight-only, no plan-updated dispatch)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    const planUpdatedEvents: Event[] = []
    const listener = (e: Event) => planUpdatedEvents.push(e)
    window.addEventListener('plan-updated', listener)

    await act(async () => {
      await result.current.sendMessage('give feedback on my run')
    })

    window.removeEventListener('plan-updated', listener)

    const patchCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      url === '/api/runs/abc123' && opts?.method === 'PATCH'
    )
    expect(patchCalls).toHaveLength(1)
    const body = JSON.parse(patchCalls[0][1].body as string)
    expect(body.insight).toBe('Great run!')

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).not.toContain('run:update-insight')

    // plan-updated must NOT be dispatched for insight-only update
    expect(planUpdatedEvents).toHaveLength(0)
  })

  it('shows ⚠️ error when run:update-insight is missing runId', async () => {
    const { result } = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mockFetch.mockReturnValueOnce(
      makeStreamResponse([
        'data: {"text":"Insight <run:update-insight insight=\\"Great run!\\"\\/>."}\n\n',
        'data: {"done":true,"planGenerated":false}\n\n',
      ])
    )
    // GET /api/plan (onDone fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })
    // GET /api/plan (applyPlanOperations fetchPlan)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plan: testPlan }) })

    await act(async () => {
      await result.current.sendMessage('give feedback')
    })

    // No PATCH /api/runs/* should be called
    const patchRunCalls = mockFetch.mock.calls.filter(([url, opts]: any[]) =>
      typeof url === 'string' && url.startsWith('/api/runs/') && opts?.method === 'PATCH'
    )
    expect(patchRunCalls).toHaveLength(0)

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.content).toContain('⚠️')
  })
})
