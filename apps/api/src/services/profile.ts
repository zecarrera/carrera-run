import { randomUUID } from "node:crypto";
import { getDatabase } from "./mongodb.js";
import type {
  RaceResult,
  TrainingZoneKey,
  TrainingZones,
  UserProfile,
  UserProfileDocument,
} from "../types/profile.js";

interface ZoneInput {
  from: string;
  to: string;
}

type ZonesInput = Record<TrainingZoneKey, ZoneInput>;

interface CreateRaceResultInput {
  title: string;
  distanceKm: number;
  date: string;
  time: string;
}

interface UpdateRaceResultInput {
  title?: string;
  distanceKm?: number;
  date?: string;
  time?: string;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseMmSsToSeconds(value: string) {
  const [minutesRaw, secondsRaw] = value.split(":");
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
    throw new Error("Pace must use mm:ss format.");
  }

  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    throw new Error("Pace values must be greater than zero.");
  }

  return totalSeconds;
}

function parseDurationToSeconds(value: string) {
  const parts = value.split(":").map((part) => Number(part));

  if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error("Time must use mm:ss or hh:mm:ss format.");
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds > 59) throw new Error("Time must use mm:ss or hh:mm:ss format.");
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds <= 0) throw new Error("Time must be greater than zero.");
    return totalSeconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    if (minutes > 59 || seconds > 59) throw new Error("Time must use mm:ss or hh:mm:ss format.");
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0) throw new Error("Time must be greater than zero.");
    return totalSeconds;
  }

  throw new Error("Time must use mm:ss or hh:mm:ss format.");
}

function normalizeZones(input: ZonesInput): TrainingZones {
  const keys: TrainingZoneKey[] = ["Z1", "Z2", "Z3", "Z4", "Z5"];

  return keys.reduce((accumulator, key) => {
    const fromSecondsPerKm = parseMmSsToSeconds(input[key].from);
    const toSecondsPerKm = parseMmSsToSeconds(input[key].to);

    if (fromSecondsPerKm > toSecondsPerKm) {
      throw new Error(`${key} pace range is invalid: from pace must be less than or equal to to pace.`);
    }

    accumulator[key] = {
      fromSecondsPerKm,
      toSecondsPerKm,
    };

    return accumulator;
  }, {} as TrainingZones);
}

function mapDocument(document: UserProfileDocument): UserProfile {
  return {
    id: document._id.toHexString(),
    userId: document.userId,
    trainingZones: document.trainingZones,
    raceResults: [...document.raceResults].sort((first, second) => second.date.localeCompare(first.date)),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function getProfilesCollection() {
  const database = await getDatabase();
  const collection = database.collection<UserProfileDocument>("profiles");
  await collection.createIndex({ userId: 1 }, { unique: true });
  return collection;
}

async function ensureProfileDocument(userId: string) {
  const collection = await getProfilesCollection();
  const existing = await collection.findOne({ userId });
  if (existing) {
    return existing;
  }

  const now = new Date();
  const insertResult = await collection.insertOne({
    userId,
    trainingZones: null,
    raceResults: [],
    createdAt: now,
    updatedAt: now,
  } as Omit<UserProfileDocument, "_id"> as UserProfileDocument);

  return {
    _id: insertResult.insertedId,
    userId,
    trainingZones: null,
    raceResults: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function getProfile(userId: string) {
  const document = await ensureProfileDocument(userId);
  return mapDocument(document);
}

export async function updateTrainingZones(userId: string, zonesInput: ZonesInput) {
  const zones = normalizeZones(zonesInput);
  const collection = await getProfilesCollection();
  const now = new Date();

  await collection.updateOne(
    { userId },
    {
      $set: {
        trainingZones: zones,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        raceResults: [],
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const updated = await collection.findOne({ userId });
  if (!updated) {
    throw new Error("Unable to update profile.");
  }

  return mapDocument(updated);
}

export async function createRaceResult(userId: string, input: CreateRaceResultInput) {
  if (!isValidIsoDate(input.date)) {
    throw new Error("Race result date must use YYYY-MM-DD format.");
  }

  const elapsedTimeSeconds = parseDurationToSeconds(input.time);

  const result: RaceResult = {
    id: randomUUID(),
    title: input.title.trim(),
    distanceKm: input.distanceKm,
    date: input.date,
    elapsedTimeSeconds,
  };

  const collection = await getProfilesCollection();
  const now = new Date();

  await collection.updateOne(
    { userId },
    {
      $push: { raceResults: result },
      $set: { updatedAt: now },
      $setOnInsert: {
        userId,
        trainingZones: null,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const updated = await collection.findOne({ userId });
  if (!updated) {
    throw new Error("Unable to save race result.");
  }

  return mapDocument(updated);
}

export async function updateRaceResult(userId: string, resultId: string, input: UpdateRaceResultInput) {
  const collection = await getProfilesCollection();
  const profile = await collection.findOne({ userId });

  if (!profile) {
    return null;
  }

  const existing = profile.raceResults.find((entry) => entry.id === resultId);
  if (!existing) {
    return null;
  }

  if (input.date && !isValidIsoDate(input.date)) {
    throw new Error("Race result date must use YYYY-MM-DD format.");
  }

  const merged: RaceResult = {
    ...existing,
    ...(input.title != null ? { title: input.title.trim() } : {}),
    ...(input.distanceKm != null ? { distanceKm: input.distanceKm } : {}),
    ...(input.date != null ? { date: input.date } : {}),
    ...(input.time != null ? { elapsedTimeSeconds: parseDurationToSeconds(input.time) } : {}),
  };

  await collection.updateOne(
    { userId, "raceResults.id": resultId },
    {
      $set: {
        "raceResults.$": merged,
        updatedAt: new Date(),
      },
    },
  );

  const updated = await collection.findOne({ userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}

export async function deleteRaceResult(userId: string, resultId: string) {
  const collection = await getProfilesCollection();
  const profile = await collection.findOne({ userId });

  if (!profile) {
    return null;
  }

  const exists = profile.raceResults.some((entry) => entry.id === resultId);
  if (!exists) {
    return null;
  }

  await collection.updateOne(
    { userId },
    {
      $pull: { raceResults: { id: resultId } },
      $set: { updatedAt: new Date() },
    },
  );

  const updated = await collection.findOne({ userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}