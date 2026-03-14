import axios from "axios";
import type {
  AthleteSummary,
  NormalizedActivity,
  StravaActivity,
  StravaAthlete,
  StravaTokenSet,
} from "../types/strava.js";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";
const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

type ExchangeCodeResult = StravaTokenSet & {
  athlete: StravaAthlete;
};

const toDisplayName = (athlete?: StravaAthlete) => {
  if (!athlete) {
    return "Runner";
  }

  return [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || athlete.username || "Runner";
};

export const buildAuthorizationUrl = () => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const scopes = process.env.STRAVA_SCOPES ?? "read,activity:read_all";

  if (!clientId || !redirectUri) {
    throw new Error("Strava OAuth environment variables are not configured.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: scopes,
  });

  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
};

export const exchangeCodeForToken = async (code: string): Promise<ExchangeCodeResult> => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Strava client credentials are missing.");
  }

  const response = await axios.post(`${STRAVA_OAUTH_BASE}/token`, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });

  return response.data as ExchangeCodeResult;
};

export const refreshAccessToken = async (refreshToken: string): Promise<StravaTokenSet> => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Strava client credentials are missing.");
  }

  const response = await axios.post(`${STRAVA_OAUTH_BASE}/token`, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return response.data as StravaTokenSet;
};

export const ensureFreshToken = async (tokens: StravaTokenSet) => {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (tokens.expires_at > nowInSeconds + 60) {
    return tokens;
  }

  return refreshAccessToken(tokens.refresh_token);
};

export const normalizeActivity = (activity: StravaActivity): NormalizedActivity => {
  const distanceKm = activity.distance / 1000;
  const averagePaceSecondsPerKm = distanceKm > 0 ? Math.round(activity.moving_time / distanceKm) : null;

  return {
    id: activity.id,
    name: activity.name,
    type: activity.sport_type || activity.type,
    startDate: activity.start_date,
    distanceKm,
    movingTimeSeconds: activity.moving_time,
    elapsedTimeSeconds: activity.elapsed_time,
    elevationGainMeters: activity.total_elevation_gain,
    averagePaceSecondsPerKm,
    averageHeartRate: activity.average_heartrate,
    maxHeartRate: activity.max_heartrate,
    kudosCount: activity.kudos_count,
    achievementCount: activity.achievement_count,
  };
};

export const fetchAthlete = async (accessToken: string) => {
  const response = await axios.get(`${STRAVA_API_BASE}/athlete`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data as StravaAthlete;
};

export const fetchActivities = async (
  accessToken: string,
  page = 1,
  perPage = 30,
  after?: number,
  before?: number,
) => {
  const response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      page,
      per_page: perPage,
      ...(after !== undefined && { after }),
      ...(before !== undefined && { before }),
    },
  });

  return response.data as StravaActivity[];
};

export const fetchActivityById = async (accessToken: string, activityId: string) => {
  const response = await axios.get(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return normalizeActivity(response.data as StravaActivity);
};

export const buildAthleteSummary = (athlete: StravaAthlete | undefined, activities: NormalizedActivity[]): AthleteSummary => {
  const runs = activities.filter((activity) => activity.type.toLowerCase().includes("run"));
  const totals = runs.reduce(
    (result, run) => ({
      runs: result.runs + 1,
      distanceKm: result.distanceKm + run.distanceKm,
      movingTimeSeconds: result.movingTimeSeconds + run.movingTimeSeconds,
      elevationGainMeters: result.elevationGainMeters + run.elevationGainMeters,
    }),
    {
      runs: 0,
      distanceKm: 0,
      movingTimeSeconds: 0,
      elevationGainMeters: 0,
    },
  );

  return {
    athlete: {
      id: athlete?.id ?? 0,
      displayName: toDisplayName(athlete),
      avatarUrl: athlete?.profile,
    },
    totals,
    recentRun: runs[0],
  };
};
