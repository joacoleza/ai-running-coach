import { describe, it, expect } from 'vitest'

// Unit tests for the <training_plan> stripping regex used in useChat.ts.
// The regex is: /<training_plan>[\s\S]*?<\/training_plan>/g

const stripTrainingPlan = (content: string): string =>
  content.replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '').trim()

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
