import { fetchActivities } from "./strava.js";
import { MOCK_ACCESS_TOKEN } from "./strava-mock.js";
import { listPlans, updatePlanActivity } from "./planning.js";

// Planned activity types matched against Strava activity types.
// A planned activity is auto-completed when a Strava activity of the
// corresponding Strava type exists on the same calendar date.
const PLANNED_TO_STRAVA_TYPE: Record<string, "run" | "workout"> = {
  Run: "run",
  Strength: "workout",
  Flexibility: "workout",
};

/**
 * After a Strava connect/reconnect, scan every plan owned by the user for
 * activities that are still `not_started` and have a date on or before today.
 * For each one, check whether a matching Strava activity exists on the same
 * calendar date:
 *   - Planned `Run`         → Strava activity whose type includes "run"
 *   - Planned `Strength`    → Strava activity whose type includes "workout"
 *   - Planned `Flexibility` → Strava activity whose type includes "workout"
 *
 * If a match is found, the planned activity is marked as `completed`.
 *
 * This runs fire-and-forget from the auth callback — failures are logged but
 * never surface to the user.
 */
export async function autoCompletePlanActivities(
  userId: string,
  accessToken: string,
): Promise<void> {
  if (accessToken === MOCK_ACCESS_TOKEN) return;

  const today = new Date().toISOString().slice(0, 10);

  const plans = await listPlans(userId);

  // Collect every not_started activity of a supported type with a past-or-present date.
  const pending: Array<{ planId: string; activityId: string; date: string; stravaType: "run" | "workout" }> = [];

  for (const plan of plans) {
    for (const activity of plan.activities) {
      const stravaType = PLANNED_TO_STRAVA_TYPE[activity.type as string];
      if (
        activity.status === "not_started" &&
        activity.date <= today &&
        stravaType !== undefined
      ) {
        pending.push({ planId: plan.id, activityId: activity.id, date: activity.date, stravaType });
      }
    }
  }

  if (!pending.length) return;

  // Determine the date window we need to query.
  const earliestDate = pending.reduce(
    (min, { date }) => (date < min ? date : min),
    today,
  );

  const afterTs = Math.floor(new Date(`${earliestDate}T00:00:00Z`).getTime() / 1000);
  const beforeTs = Math.floor(new Date(`${today}T23:59:59Z`).getTime() / 1000);

  // Fetch Strava activities covering the window (up to 200 — more than enough
  // for a ~30-day look-back).
  const stravaActivities = await fetchActivities(accessToken, 1, 200, afterTs, beforeTs);

  // Build per-strava-type sets of dates that have a matching Strava activity.
  const stravaDatesByType: Record<"run" | "workout", Set<string>> = {
    run: new Set(),
    workout: new Set(),
  };
  for (const sa of stravaActivities) {
    const activityType = (sa.sport_type ?? sa.type ?? "").toLowerCase();
    if (activityType.includes("run")) {
      stravaDatesByType.run.add(sa.start_date.slice(0, 10));
    } else if (activityType.includes("workout")) {
      stravaDatesByType.workout.add(sa.start_date.slice(0, 10));
    }
  }

  // Update every pending planned activity whose date has a matching Strava activity.
  for (const { planId, activityId, date, stravaType } of pending) {
    if (stravaDatesByType[stravaType].has(date)) {
      await updatePlanActivity(userId, planId, activityId, { status: "completed" });
    }
  }
}
