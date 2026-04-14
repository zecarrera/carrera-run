# Copilot Instructions — Carrera Run

## Before completing any change

### 1. Tests

Always check whether tests need to be added or updated:

- **Web** (`apps/web`): Vitest + React Testing Library. Test files live alongside components as `*.test.tsx`.
- **API** (`apps/api`): No test framework is set up yet. When adding non-trivial pure logic (parsing helpers, domain utilities), consider whether a test framework should be introduced.

Rules:
- If you modify existing logic covered by a test, update the test.
- If you add non-trivial logic (parsing, validation, business rules, state transitions), add a test.
- Run existing tests before and after your change: `npm test --workspace @carrera-run/web`.

### 2. Documentation

Always check whether documentation needs updating:

- **`README.md`** — Update when: environment variables change, new scripts are added, API endpoints change, setup steps change, or user-facing features are added/removed.
- **`.github/agents/`** — Update the relevant agent file when its scope, rules, or referenced knowledge changes.
- **`.github/knowledge/`** — Update coaching methodology or athlete context files when coaching logic or domain rules change.
- **`.env.example`** — Keep in sync with any new or changed environment variables.

## Repository overview

| Area | Path | Notes |
|---|---|---|
| API | `apps/api/src/` | Express + TypeScript, MongoDB |
| Web | `apps/web/src/` | React + TypeScript + Vite |
| Coach prompt | `apps/api/prompts/coach-system.md` | LLM system prompt |
| Knowledge base | `.github/knowledge/` | Coaching methodology & athlete profiles |
| Agent definitions | `.github/agents/` | Running coach and web developer agents |
| Skills | `.github/skills/` | Planning and profile skill guides |

## Code style

- Keep route handlers thin — business logic belongs in service modules.
- Never commit secrets or real credentials.
- Use TypeScript types for all API responses and domain models.
- Prefer explicit error handling and user-facing error messages over silent failures.
