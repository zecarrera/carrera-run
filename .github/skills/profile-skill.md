---
name: profile-feature
description: 'Use when implementing or modifying the Profile area in Carrera Run, including training zones Z1-Z5, pace range inputs, race results history, profile API endpoints, MongoDB profile storage, and profile page UI flows.'
argument-hint: 'Describe the profile work: zones, race results, API, validation, or UI'
---

# Profile Feature Skill

Use this skill whenever implementing or modifying the Profile area.

This repository's app name is **Carrera Run**; use that naming in docs and examples.

## Scope

This skill governs:

- Profile page behavior for `/profile`
- Training zones configuration for `Z1` through `Z5`
- Race result history records
- Profile API behavior
- Profile persistence and validation

Activities dashboard, Strava OAuth, and training-plan workflows are out of scope unless a profile change depends on them.

## Storage Strategy (MongoDB)

Use MongoDB as the default Profile datastore.

Use `carrera_run` as the default MongoDB database name unless environment-specific conventions override it.

### Recommended default model

Use a `profiles` collection with one document per user.

Recommended document shape:

- `userId`
- `trainingZones`
- `raceResults[]`
- `createdAt`
- `updatedAt`

Keep training zones embedded because there is exactly one zone set per user.

Keep race results embedded by default because expected volume is low and profile reads should return the complete profile payload in one query.

### Suggested domain model

Prefer these TypeScript shapes or an equivalent explicit model:

- `type TrainingZoneKey = "Z1" | "Z2" | "Z3" | "Z4" | "Z5"`
- `type PaceRange = { fromSecondsPerKm: number; toSecondsPerKm: number }`
- `type TrainingZones = Record<TrainingZoneKey, PaceRange>`
- `type RaceResult = { id: string; title: string; distanceKm: number; date: string; elapsedTimeSeconds: number }`
- `type UserProfile = { id: string; userId: string; trainingZones: TrainingZones | null; raceResults: RaceResult[]; createdAt: string; updatedAt: string }`

Store pace values as integer seconds per kilometer, not raw display strings, so validation, ordering, and calculations stay reliable.

Convert display values like `6:30 min / km` to `390` seconds in the backend or in a shared parsing helper before persistence.

### Indexing guidance

1. Create a unique index on `userId`.
2. Index `raceResults.date` only if profile history queries become large or date-filtered endpoints are introduced.

## Core Business Rules

1. A user has at most one profile document.
2. Training zones are limited to `Z1 | Z2 | Z3 | Z4 | Z5`.
3. Each zone contains both `from` and `to` pace bounds.
4. Pace bounds are stored in seconds per kilometer and displayed as `mm:ss min/km`.
5. Each zone must satisfy `fromSecondsPerKm <= toSecondsPerKm`.
6. Reject zero, negative, malformed, or non-time pace inputs.
7. A race result contains:
   - `title`
   - `distanceKm`
   - `date`
   - `elapsedTimeSeconds`
8. Race results belong to the authenticated user only.
9. Race result dates must use `YYYY-MM-DD`.
10. Race result time is stored as total elapsed seconds, not a formatted string.

## Validation Rules

Always enforce these validations in backend or domain logic:

1. Reject unsupported zone keys.
2. Reject missing `from` or `to` values for any saved zone.
3. Reject invalid pace strings that do not match `m:ss` or `mm:ss` when text input is used.
4. Reject pace ranges where `fromSecondsPerKm > toSecondsPerKm`.
5. Reject race result titles that are empty after trimming.
6. Reject non-positive `distanceKm`.
7. Reject non-positive `elapsedTimeSeconds`.
8. Reject invalid race result dates.
9. Reject operations on another user's profile or race results.
10. Return clear validation messages suitable for UI display.

## API Guidance

Preferred endpoints for the Profile domain:

- `GET /api/profile` (return the authenticated user's full profile)
- `PUT /api/profile/zones` (replace the user's `Z1` to `Z5` training zones)
- `POST /api/profile/race-results` (create a race result)
- `PATCH /api/profile/race-results/:resultId` (edit a race result)
- `DELETE /api/profile/race-results/:resultId` (remove a race result)

Keep route handlers thin and place parsing, normalization, and validation in a profile service/domain module.

When the profile document does not exist yet, `GET /api/profile` should return a safe empty profile state instead of forcing the UI to infer defaults.

## UI Guidance

The Profile route should evolve in this order:

1. Replace the under-construction page with a real profile shell.
2. Add a training-zones editor with one row per zone from `Z1` to `Z5`.
3. Add pace inputs that accept `mm:ss` and show `min/km` clearly.
4. Add race-result creation form with title, distance, date, and finish time.
5. Add race-result list with edit and delete actions.
6. Add empty states when no zones or race results exist.

UI behavior rules:

1. Show zones in a fixed `Z1` to `Z5` order.
2. Use explicit labels like `From pace` and `To pace`.
3. Surface parsing and validation errors near the edited field or form.
4. Do not use fake profile data in production paths.
5. Sort race results by `date` descending by default.
6. Format race result time for display, but keep raw elapsed seconds in state or payloads.

## TypeScript Modeling Guidance

Prefer shared types between the API and UI for:

- `TrainingZoneKey`
- `PaceRange`
- `TrainingZones`
- `RaceResult`
- `UserProfile`

If UI forms use string inputs, keep dedicated form-state types separate from persisted DTOs so parsing stays explicit.

## Implementation Guidance

1. Keep profile-specific helpers together, for example pace parsing and formatting helpers.
2. Prefer a single profile aggregate instead of separate top-level collections unless product scope expands materially.
3. Use the authenticated Strava athlete id as `userId`, matching the planning implementation.
4. Keep date and time normalization on the server side even if the UI pre-validates.
5. Reuse existing visual patterns from the current dashboard and planning screens.

## Testing Priorities

When tests exist, prioritize:

1. Pace string parsing from `mm:ss` to seconds.
2. Invalid pace range rejection.
3. Profile upsert behavior for a first-time user.
4. Race result create, update, and delete flows.
5. Ownership checks by authenticated user id.
6. Race result sorting by date descending.

## Non-Goals

Do not add:

1. Heart-rate or power zones unless explicitly requested.
2. Multi-user shared profiles.
3. Derived performance predictions from race history unless explicitly requested.
4. Alternate pace units unless explicitly requested.