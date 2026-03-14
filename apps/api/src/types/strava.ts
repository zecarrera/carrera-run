export type StravaTokenSet = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
};

export type StravaAthlete = {
  id: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  profile?: string;
};

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kudos_count?: number;
  achievement_count?: number;
  suffer_score?: number;
};

export type NormalizedActivity = {
  id: number;
  name: string;
  type: string;
  startDate: string;
  distanceKm: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  averagePaceSecondsPerKm: number | null;
  averageHeartRate?: number;
  maxHeartRate?: number;
  kudosCount?: number;
  achievementCount?: number;
};

export type AthleteSummary = {
  athlete: {
    id: number;
    displayName: string;
    avatarUrl?: string;
  };
  totals: {
    runs: number;
    distanceKm: number;
    movingTimeSeconds: number;
    elevationGainMeters: number;
  };
  recentRun?: NormalizedActivity;
};
