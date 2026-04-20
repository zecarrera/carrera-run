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

export type TrainingZoneKey = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export type PaceRange = {
  fromSecondsPerKm: number;
  toSecondsPerKm: number;
};

export type TrainingZones = Record<TrainingZoneKey, PaceRange>;

export type RaceResult = {
  id: string;
  title: string;
  distanceKm: number;
  date: string;
  elapsedTimeSeconds: number;
};

export type UserProfile = {
  id: string;
  userId: string;
  trainingZones: TrainingZones | null;
  raceResults: RaceResult[];
  preferredChannels: string[];
  allowOtherChannels: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VideoRole = "warm-up" | "cool-down" | "general";

export type VideoRecommendation = {
  videoId: string;
  title: string;
  channelName: string;
  role: VideoRole;
};

export type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CoachProposedAction = {
  type: "create_plan" | "modify_plan" | "add_activity" | "none";
  reason: string;
  payload?: Record<string, unknown>;
};

export type CoachResponse = {
  answer: string;
  followUpQuestions: string[];
  proposedActions: CoachProposedAction[];
  safetyNotes: string[];
};
