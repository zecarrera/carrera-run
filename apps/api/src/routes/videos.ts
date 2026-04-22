import { Router } from "express";
import { getProfile } from "../services/profile.js";
import { getVideoRecommendations } from "../services/videos.js";
import type { ActivityType } from "../services/videos.js";

const videosRouter = Router();

const VALID_ACTIVITY_TYPES: ActivityType[] = ["Run", "Strength", "Flexibility"];

videosRouter.get("/recommendation", async (request, response, next) => {
  try {
    const athleteId = request.session.strava?.athlete?.id;
    if (!athleteId) {
      response.status(401).json({ message: "Connect your Strava account first." });
      return;
    }

    const activityType = request.query.activityType as string;
    if (!VALID_ACTIVITY_TYPES.includes(activityType as ActivityType)) {
      response.status(400).json({
        message: `activityType must be one of: ${VALID_ACTIVITY_TYPES.join(", ")}`,
      });
      return;
    }

    const durationMinutesRaw = request.query.durationMinutes;
    const activityDurationMinutes =
      typeof durationMinutesRaw === "string" && durationMinutesRaw !== ""
        ? parseInt(durationMinutesRaw, 10) || undefined
        : undefined;

    const userId = String(athleteId);
    const profile = await getProfile(userId);

    const recommendations = await getVideoRecommendations(
      activityType as ActivityType,
      profile.preferredChannels,
      profile.allowOtherChannels,
      activityDurationMinutes,
    );

    response.json({ recommendations });
  } catch (error) {
    next(error);
  }
});

export { videosRouter };
