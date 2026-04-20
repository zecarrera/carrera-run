import { z } from "zod";

const pacePattern = /^\d{1,2}:[0-5]\d$/;
const durationPattern = /^([0-9]+:)?[0-5]\d:[0-5]\d$/;

const zoneSchema = z.object({
  from: z.string().regex(pacePattern, "Pace must use mm:ss format."),
  to: z.string().regex(pacePattern, "Pace must use mm:ss format."),
});

export const updateVideoChannelsSchema = z.object({
  preferredChannels: z.array(z.string().trim().min(1).max(100)).max(20),
  allowOtherChannels: z.boolean(),
});

export const updateZonesSchema = z.object({
  Z1: zoneSchema,
  Z2: zoneSchema,
  Z3: zoneSchema,
  Z4: zoneSchema,
  Z5: zoneSchema,
});

export const createRaceResultSchema = z.object({
  title: z.string().trim().min(1).max(160),
  distanceKm: z.number().positive().max(500),
  date: z.string(),
  time: z.string().regex(durationPattern, "Time must use mm:ss or hh:mm:ss format."),
});

export const updateRaceResultSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    distanceKm: z.number().positive().max(500).optional(),
    date: z.string().optional(),
    time: z.string().regex(durationPattern, "Time must use mm:ss or hh:mm:ss format.").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });