---
phase: 05-missing-features
padded: "05"
nyquist_compliant: true
created: 2026-04-13
updated: 2026-04-13
---

# Phase 05 Validation Strategy

## Test Infrastructure

| Layer | Framework | Config | Run Command |
|-------|-----------|--------|-------------|
| API unit | Vitest | `api/vitest.config.ts` | `cd api && npm test` |
| Web unit | Vitest | `web/vitest.config.ts` | `cd web && npm test` |
| E2E | Playwright | `playwright.config.ts` | `npx playwright test` |

## Per-Task Requirement Map

| Requirement | Description | Test File | Status |
|-------------|-------------|-----------|--------|
| FEAT-ADD-PHASE-API | POST /api/plan/phases creates phase with sequential weekNumbers | `api/src/__tests__/planPhases.test.ts` describe('POST /api/plan/phases') | COVERED |
| FEAT-TARGET-DATE-API | PATCH /api/plan saves/clears targetDate via $unset | `api/src/__tests__/plan.test.ts` targetDate describe block | COVERED |
| FEAT-AGENT-COMMANDS | System prompt documents all 4 new XML commands | `api/src/__tests__/prompts.test.ts` describe('Phase 5 agent commands') | COVERED |
| FEAT-AGENT-ADD-PHASE | plan:add-phase tag → POST /api/plan/phases, plan-updated dispatched | `web/src/__tests__/useChat.trainingPlan.test.ts` plan:add-phase describe | COVERED |
| FEAT-AGENT-TARGET-DATE | plan:update-goal tag → PATCH /api/plan with targetDate | `web/src/__tests__/useChat.trainingPlan.test.ts` plan:update-goal describe | COVERED |
| FEAT-AGENT-RUN-CREATE | run:create tag → POST /api/runs (unit not forwarded) | `web/src/__tests__/useChat.trainingPlan.test.ts` run:create describe | COVERED |
| FEAT-AGENT-RUN-INSIGHT | run:update-insight tag → PATCH /api/runs/:id, no plan-updated | `web/src/__tests__/useChat.trainingPlan.test.ts` run:update-insight describe | COVERED |
| FEAT-ADD-PHASE-UI | + Add phase button visible and creates phase | `e2e/training-plan.spec.ts` 'Phase 5 features' describe | COVERED |
| FEAT-TARGET-DATE-UI | Inline target date editor: click, edit, save, clear, placeholder | `e2e/training-plan.spec.ts` 'Phase 5 features' describe | COVERED |
| FEAT-TEST-COVERAGE | All layers green | All above | COVERED |

## Manual-Only

None — all requirements have automated coverage.

## Sign-Off

- API tests: 193/193 ✓ (197 after Nyquist additions)
- Web tests: 418/418 ✓
- E2E tests: 62/62 ✓
- TypeScript build: clean ✓

## Validation Audit 2026-04-13

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Gap resolved: FEAT-AGENT-COMMANDS — added 4 tests to `prompts.test.ts` verifying all Phase 5 XML commands are documented in the system prompt.
