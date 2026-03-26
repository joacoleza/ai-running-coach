# Claude Code Guidelines — AI Running Coach

## Git Workflow

- **Never commit directly to `master`** — it is branch-protected
- Always create a feature branch before starting work: `git checkout -b feature/phase-N-name`
- When a phase is complete, open a PR against `master` using `gh pr create`
- Stop after opening the PR — the user reviews and merges manually via GitHub UI
- **Always ask for confirmation before pushing** — do not push on every small change; batch commits and push only when the user says so
- **ALWAYS rebase onto master before pushing — NO EXCEPTIONS** — run `git fetch origin && git rebase origin/master` immediately before every `git push`. This prevents merge conflicts in PRs. Skipping this causes code conflicts in the PR diff. Do it even if you think the branch is up to date.

## Architecture Decisions

- **MongoDB must be running for the app to work** — if MongoDB is down, all API requests return 503. This is intentional for security. Do NOT add graceful degradation or fallback behavior when MongoDB is unavailable.
- **Azure Functions Core Tools** — `func start` must be run from the `api/` directory. `azure-functions-core-tools@4` is installed as a local dev dependency in `api/` so `npm run start` always uses the correct version from `node_modules/.bin/func` regardless of system PATH. CI installs `azure-functions-core-tools-4` via apt. Do NOT use `npx func start` — it resolves a different unrelated npm package named `func`.
- **`func start` requires `FUNCTIONS_WORKER_RUNTIME=node`** — `local.settings.json` is gitignored, so this env var must be set explicitly in any environment that doesn't have it (CI, Playwright webServer). Without it, `func start` hangs on an interactive runtime selection prompt.
- **E2E tests use `APP_PASSWORD=e2e-test-password`** — when starting the API manually to run E2E tests, set this: `APP_PASSWORD=e2e-test-password npm start` from `api/`. The Playwright webServer config sets it automatically when Playwright manages the server.
- **`ANTHROPIC_API_KEY` must never be set in test environments** — `playwright.config.ts` explicitly sets `ANTHROPIC_API_KEY: ''` in the webServer env. Unit/integration tests mock `@anthropic-ai/sdk` via `vi.mock()`. Never add real API keys to test configs.
- **App commands use `<app:*/>` XML tags** — Claude can emit `<app:navigate page="X"/>` and `<app:complete session_id="Y"/>` at the end of responses. `useChat.ts` strips them from the displayed message and executes them client-side after the stream closes. System prompt (`api/src/shared/prompts.ts`) defines the full protocol and includes upcoming session IDs so Claude can reference them.
- **CoachPanel mobile layout** — `AppShell` owns `coachOpen` state and passes `isOpen`/`onClose` to `CoachPanel`. Mobile: `fixed inset-0 z-50` overlay. Desktop (`md+`): static right column. FAB (`fixed bottom-6 right-6 md:hidden`) in AppShell opens the panel.
- **Shared chat state via ChatContext** — `useChat` is instantiated once inside `ChatProvider` (wraps AppShell in App.tsx). Both `CoachPanel` and `TrainingPlan` consume it via `useChatContext()`. Never call `useChat()` directly in components — always use `useChatContext()` to avoid duplicate state instances.
- **Plan archive clears chat** — `usePlan.archivePlan()` dispatches a `plan-archived` window event after success. `useChat` listens for this event and resets plan/messages state. This keeps the coach panel in sync without prop drilling.
- **Training plan goal embedded in JSON** — The system prompt instructs Claude to include a `goal` object inside `<training_plan>` JSON. `generatePlan` API extracts it from the JSON (takes precedence over client-passed goal). The `objective` field is derived server-side via `deriveObjective()` to avoid client-side marathon-fallback bugs.
- **`<plan:update>` stripped during streaming** — `useChat.ts` strips `<plan:update>` tags from the displayed message live (same pattern as `<training_plan>`). After `done`, it applies patches via `PATCH /api/plan/days/:date` and dispatches a `plan-updated` window event so `usePlan` (TrainingPlan page) refreshes automatically without a page reload.
- **Day operations** — `PATCH /api/plan/days/:date` and `DELETE /api/plan/days/:date` both match plans with `status: { $in: ['active', 'onboarding'] }` — not just 'active' — to handle edge cases where the plan may be in onboarding state but have days visible. PATCH supports `completed: 'false'`/`skipped: 'false'` (undo), `type` changes (rest → run), `newDate` (reschedule), and all field updates. The completed/skipped comparison accepts both string `'false'` and boolean `false` to guard against Azure Functions JSON runtime coercion. `POST /api/plan/days` adds a new day using `{ phaseName, weekNumber, date, type, ... }` with `arrayFilters`.
- **DayRow actions** — Undo and Delete buttons are always visible (no hover-to-reveal). Date label is clickable on active days to open a date-picker for rescheduling; the picker closes on blur via `onBlur`. Rest days show a `+ run` button on hover. All action buttons are hidden in `readonly` mode.
- **Rest days hidden in PlanView** — PlanView filters `day.type !== 'rest'` before rendering and sorts days by date. DayRow still handles rest days for archive views. Each week shows a `+ Add day` button (when `onAddDay` prop provided and not readonly). The `existingDates` passed to `AddDayForm` excludes rest days — rest day slots are free to overwrite with a run.
- **Empty plan archive prevention** — `POST /api/plan/archive` deletes (rather than archives) plans with no workout days — this covers plans with no phases AND plans with phases that contain only rest days or empty weeks. Only plans with at least one non-rest day get archived.
- **Training Plan as home** — `"/"` route redirects to `"/plan"`. Dashboard moved to `"/dashboard"`. Sidebar order: Training Plan → Runs → Archive → Dashboard.
- **Chat scroll** — `CoachPanel` uses a ref on the messages container div and sets `scrollTop = scrollHeight` instead of `scrollIntoView` — prevents the whole page from scrolling when new messages arrive.
- **XML stripped from chat history** — On mount, `useChat` strips `<training_plan>`, `<plan:update>`, and `<app:*/>` tags from assistant messages loaded from MongoDB, since they were stored raw and must not be re-displayed.
- **Sidebar layout** — Sidebar uses `h-screen sticky top-0 overflow-y-auto` so it stays fixed as the main content scrolls. Previously `min-h-screen` caused the sidebar to stretch with page content.

## Testing & Documentation

- **Tests are part of execution, not UAT** — creating AND running all test layers (unit, integration, E2E) is part of every phase execution, not optional cleanup. Run `npm test` in `api/` and `web/`, and `npx playwright test` for E2E. Write real test implementations that cover the phase requirements — stubs are placeholders only. Do not ask the user to run tests or treat test results as human UAT items.
- **E2E tests are mandatory — run `npx playwright test` after every set of changes, not just unit tests.** `e2e/global-setup.ts` starts MongoDB automatically via `docker compose up -d mongodb` — Docker must be running but MongoDB does not need to be pre-started. `reuseExistingServer: true` locally means Playwright will reuse already-running API/web servers or start them via `cd api && npm start`. Fix all E2E failures before considering work done. Never skip E2E because "unit tests pass".
- **CI test count badges** — CI runs vitest with `--reporter=verbose --reporter=json --outputFile.json=coverage/test-results.json` to produce a JSON results file alongside coverage. Playwright uses a conditional reporter in `playwright.config.ts`: `process.env.CI ? [['line'], ['json', { outputFile: 'playwright-results.json' }]] : 'line'`. The `coverage-badge` job (runs on `if: always()`) downloads both artifacts and updates API Tests / Web Tests / E2E Tests badges in README — green if all pass, red if any fail.
- **Review and update README.md** after changes — keep setup instructions, feature list, and any relevant sections accurate
- **Review and update CLAUDE.md** after changes — keep architecture decisions and guidelines current

## GSD Workflow

- This project uses [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done)
- Planning docs live in `.planning/`
- Phase sequence: plan → execute → PR → (user merges) → next phase
- Run `/gsd:plan-phase N` to plan a phase, `/gsd:execute-phase N` to build it
