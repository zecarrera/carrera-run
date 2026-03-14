export type PlanActivityType = "Run" | "Strength" | "Flexibility";

export type ActivityStatus = "not_started" | "completed" | "completed_with_changes" | "skipped";

export type PlanStatus = "upcoming" | "active" | "completed";

export interface BasePlanActivity {
  id: string;
  date: string;
  type: PlanActivityType;
  status: ActivityStatus;
  comment?: string;
  notes?: string;
  stravaActivityId?: string;
}

export interface RunPlanActivity extends BasePlanActivity {
  type: "Run";
  distanceKm: number;
  paceMinPerKm: number;
}

export interface StrengthPlanActivity extends BasePlanActivity {
  type: "Strength";
  durationMinutes: number;
}

export interface FlexibilityPlanActivity extends BasePlanActivity {
  type: "Flexibility";
  durationMinutes: number;
}

export type PlanActivity = RunPlanActivity | StrengthPlanActivity | FlexibilityPlanActivity;

export interface TrainingPlan {
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
}

export interface TrainingPlanDocument {
  _id: import("mongodb").ObjectId;
  userId: string;
  raceName: string;
  raceDistanceKm: number;
  startDate: string;
  endDate: string;
  activities: PlanActivity[];
  createdAt: Date;
  updatedAt: Date;
}
