import { describe, it } from 'vitest';

describe('Plan Generation - JSON extraction (PLAN-01)', () => {
  it.todo('extracts JSON from <training_plan> XML tags');
  it.todo('returns 400 when no <training_plan> tags found');
  it.todo('returns 400 on malformed JSON inside tags (D-15)');
  it.todo('generates UUID id for each session');
  it.todo('sets completed: false on all sessions');
});

describe('Plan Schema (PLAN-02)', () => {
  it.todo('plan document has correct schema fields');
  it.todo('session subdocument matches D-05 schema');
});

describe('Plan CRUD', () => {
  it.todo('POST /api/plan creates plan with status onboarding');
  it.todo('POST /api/plan discards existing onboarding plan (D-02)');
  it.todo('GET /api/plan returns active or onboarding plan');
  it.todo('GET /api/plan does not return completed plans');
});
