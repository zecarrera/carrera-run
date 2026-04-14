import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./mongodb.js";
import type {
  ActivityStatus,
  PlanActivity,
  PlanActivityType,
  PlanStatus,
  TrainingPlan,
  TrainingPlanDocument,
} from "../types/planning.js";

interface CreatePlanInput {
  userId: string;
  raceName: string;
  raceDistanceKm: number;
  startDate: string;
  endDate: string;
}

interface UpdatePlanInput {
  raceName?: string;
  raceDistanceKm?: number;
  startDate?: string;
  endDate?: string;
}

type CreateActivityInput = Omit<PlanActivity, "id" | "status"> & { status?: ActivityStatus };

type UpdateActivityInput = Partial<Omit<PlanActivity, "id" | "type">> & { comment?: string };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function assertDateRange(startDate: string, endDate: string) {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }
  if (startDate > endDate) {
    throw new Error("startDate must be less than or equal to endDate.");
  }
}

function derivePlanStatus(startDate: string, endDate: string, currentDate = todayIsoDate()): PlanStatus {
  if (currentDate < startDate) return "upcoming";
  if (currentDate > endDate) return "completed";
  return "active";
}

function ensureActivityForType(activity: Omit<PlanActivity, "id">) {
  if (activity.type === "Run") {
    if (!("distanceKm" in activity) || !("paceMinPerKm" in activity)) {
      throw new Error("Run activities require distanceKm and paceMinPerKm.");
    }

    if (activity.distanceKm == null || activity.paceMinPerKm == null) {
      throw new Error("Run activities require distanceKm and paceMinPerKm.");
    }
    return;
  }

  if (activity.type === "Strength" || activity.type === "Flexibility") {
    if (!("durationMinutes" in activity)) {
      throw new Error(`${activity.type} activities require durationMinutes.`);
    }

    if (activity.durationMinutes == null) {
      throw new Error(`${activity.type} activities require durationMinutes.`);
    }
  }
}

function ensureCommentForStatus(status: ActivityStatus, comment?: string) {
  if (status === "completed_with_changes" && !comment?.trim()) {
    throw new Error("A comment is required when status is completed_with_changes.");
  }
}

function mapDocument(document: TrainingPlanDocument): TrainingPlan {
  return {
    id: document._id.toHexString(),
    userId: document.userId,
    raceName: document.raceName,
    raceDistanceKm: document.raceDistanceKm,
    startDate: document.startDate,
    endDate: document.endDate,
    status: derivePlanStatus(document.startDate, document.endDate),
    activities: document.activities,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function getPlansCollection() {
  const database = await getDatabase();
  const collection = database.collection<TrainingPlanDocument>("plans");

  await collection.createIndex({ userId: 1, startDate: 1, endDate: 1 });
  await collection.createIndex({ userId: 1, "activities.date": 1 });

  return collection;
}

function toObjectId(value: string) {
  if (!ObjectId.isValid(value)) {
    return null;
  }

  return new ObjectId(value);
}

async function assertNoOverlappingPlan(userId: string, startDate: string, endDate: string, ignoreId?: string) {
  const collection = await getPlansCollection();

  const overlapFilter: Record<string, unknown> = {
    userId,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };

  if (ignoreId) {
    const ignoreObjectId = toObjectId(ignoreId);
    if (!ignoreObjectId) {
      throw new Error("Invalid plan id.");
    }
    overlapFilter._id = { $ne: ignoreObjectId };
  }

  const existingPlans = await collection.countDocuments(overlapFilter);

  if (existingPlans > 0) {
    throw new Error("User can only have one active plan at a time.");
  }
}

export async function listPlans(userId: string) {
  const collection = await getPlansCollection();
  const documents = await collection.find({ userId }).sort({ startDate: -1 }).toArray();
  return documents.map(mapDocument);
}

export async function getPlanById(userId: string, planId: string) {
  const objectId = toObjectId(planId);
  if (!objectId) {
    return null;
  }

  const collection = await getPlansCollection();
  const document = await collection.findOne({ _id: objectId, userId });
  if (!document) {
    return null;
  }
  return mapDocument(document);
}

export async function createPlan(input: CreatePlanInput) {
  assertDateRange(input.startDate, input.endDate);
  await assertNoOverlappingPlan(input.userId, input.startDate, input.endDate);

  const now = new Date();
  const document: Omit<TrainingPlanDocument, "_id"> = {
    userId: input.userId,
    raceName: input.raceName,
    raceDistanceKm: input.raceDistanceKm,
    startDate: input.startDate,
    endDate: input.endDate,
    activities: [],
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getPlansCollection();
  const result = await collection.insertOne(document as TrainingPlanDocument);

  const created: TrainingPlanDocument = {
    ...document,
    _id: result.insertedId,
  };

  return mapDocument(created);
}

export async function updatePlan(userId: string, planId: string, input: UpdatePlanInput) {
  const objectId = toObjectId(planId);
  if (!objectId) {
    return null;
  }

  const collection = await getPlansCollection();
  const existing = await collection.findOne({ _id: objectId, userId });

  if (!existing) {
    return null;
  }

  const nextStartDate = input.startDate ?? existing.startDate;
  const nextEndDate = input.endDate ?? existing.endDate;

  assertDateRange(nextStartDate, nextEndDate);
  await assertNoOverlappingPlan(userId, nextStartDate, nextEndDate, planId);

  const updateSet: Partial<TrainingPlanDocument> = {
    updatedAt: new Date(),
  };

  if (input.raceName != null) updateSet.raceName = input.raceName;
  if (input.raceDistanceKm != null) updateSet.raceDistanceKm = input.raceDistanceKm;
  if (input.startDate != null) updateSet.startDate = input.startDate;
  if (input.endDate != null) updateSet.endDate = input.endDate;

  await collection.updateOne({ _id: objectId, userId }, { $set: updateSet });

  const updated = await collection.findOne({ _id: objectId, userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}

export async function addPlanActivity(userId: string, planId: string, input: CreateActivityInput) {
  const objectId = toObjectId(planId);
  if (!objectId) {
    return null;
  }

  const collection = await getPlansCollection();
  const existing = await collection.findOne({ _id: objectId, userId });

  if (!existing) {
    return null;
  }

  if (!isValidIsoDate(input.date)) {
    throw new Error("Activity date must use YYYY-MM-DD format.");
  }

  if (input.date < existing.startDate || input.date > existing.endDate) {
    throw new Error("Activity date must be within the plan window.");
  }

  const status = input.status ?? "not_started";
  ensureCommentForStatus(status, input.comment);

  const activity: PlanActivity = {
    ...input,
    id: randomUUID(),
    status,
  } as PlanActivity;

  ensureActivityForType(activity);

  await collection.updateOne(
    { _id: objectId, userId },
    {
      $push: { activities: activity },
      $set: { updatedAt: new Date() },
    },
  );

  const updated = await collection.findOne({ _id: objectId, userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}

export async function updatePlanActivity(userId: string, planId: string, activityId: string, input: UpdateActivityInput) {
  const objectId = toObjectId(planId);
  if (!objectId) {
    return null;
  }

  const collection = await getPlansCollection();
  const existing = await collection.findOne({ _id: objectId, userId });

  if (!existing) {
    return null;
  }

  const activity = existing.activities.find((entry) => entry.id === activityId);
  if (!activity) {
    return null;
  }

  const mergedActivity = { ...activity, ...input } as PlanActivity;

  if (input.date && !isValidIsoDate(input.date)) {
    throw new Error("Activity date must use YYYY-MM-DD format.");
  }

  if (mergedActivity.date < existing.startDate || mergedActivity.date > existing.endDate) {
    throw new Error("Activity date must be within the plan window.");
  }

  ensureCommentForStatus(mergedActivity.status, mergedActivity.comment);
  ensureActivityForType(mergedActivity);

  await collection.updateOne(
    { _id: objectId, userId, "activities.id": activityId },
    {
      $set: {
        "activities.$": mergedActivity,
        updatedAt: new Date(),
      },
    },
  );

  const updated = await collection.findOne({ _id: objectId, userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}

export async function deletePlanActivity(userId: string, planId: string, activityId: string) {
  const objectId = toObjectId(planId);
  if (!objectId) {
    return null;
  }

  const collection = await getPlansCollection();
  const existing = await collection.findOne({ _id: objectId, userId });

  if (!existing) {
    return null;
  }

  await collection.updateOne(
    { _id: objectId, userId },
    {
      $pull: { activities: { id: activityId } },
      $set: { updatedAt: new Date() },
    },
  );

  const updated = await collection.findOne({ _id: objectId, userId });
  if (!updated) {
    return null;
  }

  return mapDocument(updated);
}

interface ImportPlanInput {
  userId: string;
  raceName: string;
  raceDistanceKm: number;
  startDate: string;
  endDate: string;
  activities: CreateActivityInput[];
}

export async function importPlan(input: ImportPlanInput): Promise<TrainingPlan> {
  assertDateRange(input.startDate, input.endDate);
  await assertNoOverlappingPlan(input.userId, input.startDate, input.endDate);

  for (const activity of input.activities) {
      throw new Error('Activity date "' + activity.date + '" must use YYYY-MM-DD format.');
    }
    if (activity.date < input.startDate || activity.date > input.endDate) {
      throw new Error('Activity date "' + activity.date + '" must be within the plan window (' + input.startDate + ' – ' + input.endDate + ').');
    }
    ensureActivityForType(activity);
  }

  const now = new Date();
  const activities: PlanActivity[] = input.activities.map((a) => ({
    ...a,
    id: randomUUID(),
    status: a.status ?? "not_started",
  } as PlanActivity));

  const document: Omit<TrainingPlanDocument, "_id"> = {
    userId: input.userId,
    raceName: input.raceName,
    raceDistanceKm: input.raceDistanceKm,
    startDate: input.startDate,
    endDate: input.endDate,
    activities,
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getPlansCollection();
  const result = await collection.insertOne(document as TrainingPlanDocument);

  return mapDocument({ ...document, _id: result.insertedId });
}
