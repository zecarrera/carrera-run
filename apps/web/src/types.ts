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

export type PlanActivityType = "Run" | "Strength" | "Flexibility";

export type ActivityStatus = "not_started" | "completed" | "completed_with_changes" | "skipped";

export type PlanStatus = "upcoming" | "active" | "completed";

export type PlanActivity = {
  id: string;
  date: string;
  type: PlanActivityType;
  status: ActivityStatus;
  comment?: string;
  notes?: string;
  stravaActivityId?: string;
  distanceKm?: number;
  paceMinPerKm?: number;
  durationMinutes?: number;
};

export type TrainingPlan = {
  id: string;
  userId: string;
  raceName: string;
  raceDistanceKm: number;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  activities: PlanActivity[];
  createdAt: string;
  updatedAt: string;
};
