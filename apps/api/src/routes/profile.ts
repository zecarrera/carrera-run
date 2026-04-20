import { Router } from "express";
import {
  createRaceResultSchema,
  updateRaceResultSchema,
  updateVideoChannelsSchema,
  updateZonesSchema,
} from "../schemas/profile.js";
import {
  createRaceResult,
  deleteRaceResult,
  getProfile,
  updateRaceResult,
  updateTrainingZones,
  updateVideoChannels,
} from "../services/profile.js";

const profileRouter = Router();

profileRouter.use((request, response, next) => {
  const athleteId = request.session.strava?.athlete?.id;

  if (!athleteId) {
    response.status(401).json({ message: "Connect your Strava account first." });
    return;
  }

  request.planUserId = String(athleteId);
  next();
});

profileRouter.get("/", async (request, response, next) => {
  try {
    const profile = await getProfile(request.planUserId!);
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.put("/zones", async (request, response, next) => {
  try {
    const zones = updateZonesSchema.parse(request.body);
    const profile = await updateTrainingZones(request.planUserId!, zones);
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.post("/race-results", async (request, response, next) => {
  try {
    const body = createRaceResultSchema.parse(request.body);
    const profile = await createRaceResult(request.planUserId!, body);
    response.status(201).json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.patch("/race-results/:resultId", async (request, response, next) => {
  try {
    const body = updateRaceResultSchema.parse(request.body);
    const profile = await updateRaceResult(request.planUserId!, request.params.resultId, body);

    if (!profile) {
      response.status(404).json({ message: "Race result not found." });
      return;
    }

    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.delete("/race-results/:resultId", async (request, response, next) => {
  try {
    const profile = await deleteRaceResult(request.planUserId!, request.params.resultId);

    if (!profile) {
      response.status(404).json({ message: "Race result not found." });
      return;
    }

    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

profileRouter.put("/video-channels", async (request, response, next) => {
  try {
    const body = updateVideoChannelsSchema.parse(request.body);
    const profile = await updateVideoChannels(request.planUserId!, body.preferredChannels, body.allowOtherChannels);
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

export { profileRouter };