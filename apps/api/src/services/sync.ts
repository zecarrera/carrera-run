import { fetchActivities } from "./strava.js";
import { listPlans, updatePlanActivity } from "./planning.js";

/**
 * After a Strava connect/reconnect, scan every plan owned by the user for
 * Run activities that are still `not_started` and have a date on or before
 * today. For each one, check whether a matching Run exists in Strava on the
 * same calendar date. If so, mark the planned activity as `completed`.
 *
 * This runs fire-and-forget from the auth callback — failures are logged but
 * never surface to the user.
 */
export async function autoCompletePlanActivities(
  userId: string,
  accessToken: string,
): Promise<void> {
  if (accessToken === "dev-mock-token") return;

  const today = new Date().toISOString().slice(0, 10);

  const plans = await listPlans(userId);

  // Collect every not_started Run with a past-or-present date.
  const pending: Array<{ planId: string; activityId: string; date: string }> = [];

  for (const plan of plans) {
    for (const activity of plan.activities) {
      if (
        activity.status === "not_started" &&
        activity.date <= today &&
        activity.type === "Run"
      ) {
        pending.push({ planId: plan.id, activityId: activity.id, date: activity.date });
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

  // Build a set of dates that have at least one Run in Strava.
  const stravaRunDates = new Set<string>();
  for (const sa of stravaActivities) {
    const activityType = (sa.sport_type ?? sa.type ?? "").toLowerCase();
    if (activityType.includes("run")) {
      stravaRunDates.add(sa.start_date.slice(0, 10));
    }
  }

  // Update every pending planned activity whose date has a Strava Run.
  for (const { planId, activityId, date } of pending) {
    if (stravaRunDates.has(date)) {
      await updatePlanActivity(userId, planId, activityId, { status: "completed" });
    }
  }
}
