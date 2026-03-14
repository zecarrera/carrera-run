# Planning Skill

Use this skill whenever implementing or modifying the Planning area.

This repository's app name is **Carrera Run**; use that naming in docs and examples.

## Scope

This skill governs:

- Training plan data model
- Plan lifecycle state rules
- One-active-plan constraints
- Planning API behavior
- Planning UI behavior

Activities dashboard and Strava ingestion are out of scope unless a planning change depends on them.

## Storage Strategy (MongoDB)

Use MongoDB as the default Planning datastore.

Use `carrera_run` as the default MongoDB database name unless environment-specific conventions override it.

### Recommended default model

Use a `plans` collection with embedded `activities`:

- One document per plan
- Plan-level fields at root (`userId`, `raceName`, `raceDistance`, `startDate`, `endDate`)
- `activities` as an array of subdocuments

This keeps create/update operations straightforward and allows atomic plan-level writes.

Expected scale for this project is roughly 12–16 weeks with ~3–5 activities/week (about 36–80 activities per plan), which fits the embedded model comfortably.

### When to split into a separate collection

Use a separate `planActivities` collection only if at least one applies:

1. Very large activity arrays per plan that risk document growth limits/perf issues.
2. High-frequency activity-only queries that do not need plan payloads.
3. Independent lifecycle requirements for activities (e.g., archival, separate retention).

If split, still keep `plans` as the aggregate root and enforce ownership and status rules in the planning domain layer.

### MongoDB validation and indexing guidance

1. Use MongoDB JSON Schema validation for allowed activity types and statuses.
2. Require status comment when status is `completed_with_changes`.
3. Index `userId`, `startDate`, and `endDate` for active-plan and timeline queries.
4. Index nested `activities.date` when reconciliation with Strava by date is implemented.

## Core Business Rules

1. A training plan has:
	- `id`
	- `userId`
	- `raceName`
	- `raceDistance`
	- `startDate`
	- `endDate`
	- `activities[]`
	- `endDate` is the race date
2. A plan activity has:
	- `id`
	- `date` (or scheduled day)
	- `type` in `Run | Strength | Flexibility`
	- `status` in `not_started | completed | completed_with_changes | skipped`
	- optional status comment (required for `completed_with_changes`)
	- optional notes/metadata
3. Type-specific activity fields:
	- `Run` requires `distance` and `paceMinPerKm`
	- `Strength` requires `duration`
	- `Flexibility` requires `duration`
4. Plan status is derived from current date and not stored as mutable source-of-truth when avoidable:
	- before `startDate` => `upcoming`
	- between `startDate` and `endDate` (inclusive) => `active`
	- after `endDate` => `completed`
5. A user can only have one `active` plan at a time.
6. Any create/update operation must prevent date windows that could produce more than one active plan for the same user at the same time.
7. `startDate` must be less than or equal to `endDate`.

## Validation Rules

Always enforce these validations in backend/domain logic:

1. Reject unsupported activity types.
2. Reject unsupported activity statuses.
3. Require comment when status is `completed_with_changes`.
4. Enforce required fields by activity type.
5. Reject invalid date ranges.
6. Reject scheduling outside plan window when scheduling is date-based.
7. Reject operations on plans belonging to another user.
8. Return clear error messages suitable for UI display.

## API Guidance

Preferred endpoints for planning domain:

- `GET /api/plans` (list user plans with derived status)
- `POST /api/plans` (create plan)
- `GET /api/plans/:id` (plan detail)
- `PATCH /api/plans/:id` (edit date range/name/metadata)
- `POST /api/plans/:id/activities` (add plan activity)
- `PATCH /api/plans/:id/activities/:activityId` (edit plan activity)
- `DELETE /api/plans/:id/activities/:activityId` (remove activity)

Keep handlers thin and place rules in a planning service/domain module.

For embedded activities, plan activity endpoints should perform targeted array updates (e.g., positional updates by `activities.id`) while still validating full business rules.

## UI Guidance

Implementation phases:

1. Phase 1 (current): Planning route can be under construction.
2. Phase 2: Add create-plan form with start/end date validation.
3. Phase 3: Add race metadata (`raceName`, `raceDistance`) and enforce `endDate` as race date.
4. Phase 4: Add activities list editor for `Run | Strength | Flexibility`, including type-specific fields.
5. Phase 5: Add activity status updates (`not_started`, `completed`, `completed_with_changes`, `skipped`) and required comments for `completed_with_changes`.
6. Phase 6: Add detail/edit views and status badges (`upcoming | active | completed`).
7. Phase 7: Add automatic reconciliation that marks/updates planned activities when matching Strava entries exist for the planned date.

UI behavior rules:

1. If no plans exist, show a clear empty state with create action.
2. If one plan is active, show it prominently as the current plan.
3. Default new activities to `not_started` status.
4. When user selects `completed_with_changes`, show a comment input and require it.
5. Surface backend validation errors verbatim when safe and user-friendly.
6. Avoid fake metrics and placeholder mock records in production paths.

## TypeScript Modeling Guidance

Prefer discriminated and explicit types:

- `type PlanActivityType = "Run" | "Strength" | "Flexibility"`
- `type PlanStatus = "upcoming" | "active" | "completed"`
- `type ActivityStatus = "not_started" | "completed" | "completed_with_changes" | "skipped"`

Use shared DTO/domain types between API and UI where practical to reduce drift.

## Testing Priorities

When tests exist, prioritize:

1. Date boundary transitions for status (`startDate`, `endDate` inclusive logic)
2. One-active-plan constraint checks
3. Activity type validation and required field checks by type
4. Activity status transitions and comment requirement for `completed_with_changes`
5. Invalid date range rejection
6. Strava-to-plan activity reconciliation for matching dates

## Non-Goals

Do not add:

1. Multi-user collaboration in plans
2. Auto-generated AI plans unless explicitly requested
3. Extra activity types beyond `Run | Strength | Flexibility`
