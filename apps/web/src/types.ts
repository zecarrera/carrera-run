export type Activity = {
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
  recentRun?: Activity;
};
