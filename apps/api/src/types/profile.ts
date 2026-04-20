export type TrainingZoneKey = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export interface PaceRange {
  fromSecondsPerKm: number;
  toSecondsPerKm: number;
}

export type TrainingZones = Record<TrainingZoneKey, PaceRange>;

export interface RaceResult {
  id: string;
  title: string;
  distanceKm: number;
  date: string;
  elapsedTimeSeconds: number;
}

export interface UserProfile {
  id: string;
  userId: string;
  trainingZones: TrainingZones | null;
  raceResults: RaceResult[];
  preferredChannels: string[];
  allowOtherChannels: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileDocument {
  _id: import("mongodb").ObjectId;
  userId: string;
  trainingZones: TrainingZones | null;
  raceResults: RaceResult[];
  preferredChannels: string[];
  allowOtherChannels: boolean;
  createdAt: Date;
  updatedAt: Date;
}