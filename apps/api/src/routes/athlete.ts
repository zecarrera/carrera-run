import { Router } from "express";
import { buildAthleteSummary, ensureFreshToken, fetchActivities, fetchAthlete, normalizeActivity } from "../services/strava.js";
import { isMockSession } from "../services/strava-mock.js";

const athleteRouter = Router();

athleteRouter.get("/summary", async (request, response, next) => {
  try {
    const stravaSession = request.session.strava;

    if (!stravaSession) {
      response.status(401).json({ message: "Connect your Strava account first." });
      return;
    }

    // Dev mock: return a fake summary without hitting Strava
    if (process.env.NODE_ENV !== "production" && isMockSession(stravaSession.tokens.access_token)) {
      response.json({
        connected: true,
        summary: buildAthleteSummary(stravaSession.athlete, []),
      });
      return;
    }

    const freshTokens = await ensureFreshToken(stravaSession.tokens);
    const athlete = stravaSession.athlete ?? (await fetchAthlete(freshTokens.access_token));
    const activities = await fetchActivities(freshTokens.access_token, 1, 20);
    const normalized = activities.map(normalizeActivity);

    request.session.strava = {
      athlete,
      tokens: freshTokens,
    };

    response.json({
      connected: true,
      summary: buildAthleteSummary(athlete, normalized),
    });
  } catch (error) {
    next(error);
  }
});

export { athleteRouter };
