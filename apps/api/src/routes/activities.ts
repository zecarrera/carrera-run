import { Router } from "express";
import { z } from "zod";
import { ensureFreshToken, fetchActivities, fetchActivityById, normalizeActivity } from "../services/strava.js";

const activitiesRouter = Router();

activitiesRouter.use(async (request, response, next) => {
  try {
    const stravaSession = request.session.strava;

    if (!stravaSession) {
      response.status(401).json({ message: "Connect your Strava account first." });
      return;
    }

    const freshTokens = await ensureFreshToken(stravaSession.tokens);
    request.session.strava = {
      ...stravaSession,
      tokens: freshTokens,
    };

    next();
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get("/", async (request, response, next) => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    perPage: z.coerce.number().int().positive().max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
    type: z.string().optional(),
  });

  try {
    const { page = 1, perPage = 30, after, before, type } = querySchema.parse(request.query);
    const tokens = request.session.strava?.tokens;

    if (!tokens) {
      response.status(401).json({ message: "Connect your Strava account first." });
      return;
    }

    const afterTimestamp = after ? Math.floor(new Date(after).getTime() / 1000) : undefined;
    const beforeTimestamp = before ? Math.floor(new Date(`${before}T23:59:59`).getTime() / 1000) : undefined;
    const activities = await fetchActivities(tokens.access_token, page, perPage, afterTimestamp, beforeTimestamp);
    const normalized = activities.map(normalizeActivity);
    const filtered = type ? normalized.filter((a) => a.type.toLowerCase() === type.toLowerCase()) : normalized;
    response.json({
      activities: filtered,
    });
  } catch (error) {
    next(error);
  }
});

activitiesRouter.get("/:id", async (request, response, next) => {
  try {
    const tokens = request.session.strava?.tokens;

    if (!tokens) {
      response.status(401).json({ message: "Connect your Strava account first." });
      return;
    }

    const activity = await fetchActivityById(tokens.access_token, request.params.id);
    response.json({ activity });
  } catch (error) {
    next(error);
  }
});

export { activitiesRouter };
