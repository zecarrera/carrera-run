import { Router } from "express";
import { getProfile } from "../services/profile.js";
import { getVideoRecommendations } from "../services/videos.js";
import type { ActivityType, VideoRole } from "../services/videos.js";

const videosRouter = Router();

const VALID_ACTIVITY_TYPES: ActivityType[] = ["Run", "Strength", "Flexibility"];
const VALID_ROLES: VideoRole[] = ["warm-up", "cool-down", "general"];

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

    const excludeRaw = request.query.exclude;
    const excludeIds =
      typeof excludeRaw === "string" && excludeRaw !== ""
        ? excludeRaw.split(",").map((id) => id.trim()).filter(Boolean)
        : [];

    const roleRaw = request.query.role as string | undefined;
    const roleFilter = roleRaw && VALID_ROLES.includes(roleRaw as VideoRole)
      ? (roleRaw as VideoRole)
      : undefined;

    const userId = String(athleteId);
    const profile = await getProfile(userId);

    const { recommendations, remainingByRole } = await getVideoRecommendations(
      activityType as ActivityType,
      profile.preferredChannels,
      profile.allowOtherChannels,
      activityDurationMinutes,
      excludeIds,
      roleFilter,
    );

    response.json({ recommendations, remainingByRole });
  } catch (error) {
    next(error);
  }
});

export { videosRouter };
