import type { NormalizedActivity, StravaActivity } from "../types/strava.js";
import { normalizeActivity } from "./strava.js";

export const MOCK_ACCESS_TOKEN = "dev-mock-token";

export const isMockSession = (token: string): boolean =>
  token === MOCK_ACCESS_TOKEN;

/**
 * Returns a small set of realistic mock Strava activities anchored to the
 * current week so that dashboard progress bars and stats populate correctly
 * during local development.
 */
export const getMockStravaActivities = (): StravaActivity[] => {
  const today = new Date();
  today.setHours(8, 0, 0, 0);

  const dayOfWeek = today.getDay(); // 0 = Sunday

  // Place mock runs on Mon, Wed and Fri of the current week (whichever have
  // already passed), so they consistently appear in "this week" queries.
  const runOffsets: Array<{ daysAgo: number; name: string; distanceM: number; movingTime: number; elevation: number; hr: number }> = [
    { daysAgo: dayOfWeek >= 1 ? dayOfWeek - 1 : 6, name: "Monday Easy Run",    distanceM: 8200,  movingTime: 2880, elevation: 45, hr: 142 },
    { daysAgo: dayOfWeek >= 3 ? dayOfWeek - 3 : 4, name: "Wednesday Tempo",    distanceM: 12400, movingTime: 3720, elevation: 80, hr: 163 },
    { daysAgo: dayOfWeek >= 5 ? dayOfWeek - 5 : 2, name: "Friday Long Run",    distanceM: 18600, movingTime: 6300, elevation: 120, hr: 155 },
  ].filter((r) => r.daysAgo >= 0 && r.daysAgo <= 6);

  return runOffsets.map((r, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - r.daysAgo);
    date.setHours(7, 30, 0, 0);

    return {
      id: 9000000 + i,
      name: r.name,
      type: "Run",
      sport_type: "Run",
      start_date: date.toISOString(),
      distance: r.distanceM,
      moving_time: r.movingTime,
      elapsed_time: r.movingTime + 60,
      total_elevation_gain: r.elevation,
      average_speed: r.distanceM / r.movingTime,
      average_heartrate: r.hr,
      max_heartrate: r.hr + 15,
      kudos_count: 3,
      achievement_count: 1,
    };
  });
};

export const getMockActivities = (): NormalizedActivity[] =>
  getMockStravaActivities().map(normalizeActivity);

export const getMockActivityById = (id: string): NormalizedActivity => {
  const activities = getMockActivities();
  const found = activities.find((a) => String(a.id) === id);
  if (!found) {
    const error = new Error(`Mock activity ${id} not found`) as Error & { status: number };
    error.status = 404;
    throw error;
  }
  return found;
};
