import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../shared/prompts.js';

describe('Onboarding Resume (D-03)', () => {
  it('plan with onboardingStep=3 resumes from step 3 in system prompt', () => {
    const prompt = buildSystemPrompt(undefined, 3, []);
    expect(prompt).toContain('question **4 of 6**');
  });

  it('onboardingStep increments: each step number produces the correct question label', () => {
    for (let step = 0; step < 6; step++) {
      const prompt = buildSystemPrompt(undefined, step, []);
      expect(prompt).toContain(`question **${step + 1} of 6**`);
    }
  });

  it('onboarding completes after step 6: no onboarding section in prompt', () => {
    const prompt = buildSystemPrompt(undefined, 6, []);
    expect(prompt).not.toContain('## Onboarding');
    expect(prompt).not.toContain('of 6');
  });

  it('start over: new plan at step 0 shows first onboarding question', () => {
    // When a plan is reset or a new one is started, it begins at step 0
    const prompt = buildSystemPrompt(undefined, 0, []);
    expect(prompt).toContain('question **1 of 6**');
  });
});
