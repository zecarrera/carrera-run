import { z } from "zod";

const activityStatusSchema = z.enum(["not_started", "completed", "completed_with_changes", "skipped"]);

export const createPlanSchema = z.object({
  raceName: z.string().min(1).max(160),
  raceDistanceKm: z.number().positive().max(500),
  startDate: z.string(),
  endDate: z.string(),
});

export const updatePlanSchema = z
  .object({
    raceName: z.string().min(1).max(160).optional(),
    raceDistanceKm: z.number().positive().max(500).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const createActivitySchema = z.discriminatedUnion("type", [
  z.object({
    date: z.string(),
    type: z.literal("Run"),
    status: activityStatusSchema.optional(),
    comment: z.string().optional(),
    notes: z.string().optional(),
    distanceKm: z.number().positive(),
    paceMinPerKm: z.number().positive(),
    stravaActivityId: z.string().optional(),
  }),
  z.object({
    date: z.string(),
    type: z.literal("Strength"),
    status: activityStatusSchema.optional(),
    comment: z.string().optional(),
    notes: z.string().optional(),
    durationMinutes: z.number().positive(),
    stravaActivityId: z.string().optional(),
  }),
  z.object({
    date: z.string(),
    type: z.literal("Flexibility"),
    status: activityStatusSchema.optional(),
    comment: z.string().optional(),
    notes: z.string().optional(),
    durationMinutes: z.number().positive(),
    stravaActivityId: z.string().optional(),
  }),
]);

export const importPlanSchema = z.object({
  raceName: z.string().min(1).max(160),
  raceDistanceKm: z.number().positive().max(500),
  startDate: z.string(),
  endDate: z.string(),
  activities: z.array(createActivitySchema).default([]),
});

export const updateActivitySchema = z
  .object({
    date: z.string().optional(),
    status: activityStatusSchema.optional(),
    comment: z.string().optional(),
    notes: z.string().optional(),
    distanceKm: z.number().positive().optional(),
    paceMinPerKm: z.number().positive().optional(),
    durationMinutes: z.number().positive().optional(),
    stravaActivityId: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });
