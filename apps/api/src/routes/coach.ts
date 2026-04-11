import { Router } from "express";
import { z } from "zod";
import { runCoachChat } from "../services/coach.js";

const coachRouter = Router();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
});

coachRouter.use((request, response, next) => {
  const athleteId = request.session.strava?.athlete?.id;

  if (!athleteId) {
    response.status(401).json({ message: "Connect your Strava account first." });
    return;
  }

  request.planUserId = String(athleteId);
  next();
});

coachRouter.post("/chat", async (request, response, next) => {
  try {
    const { messages } = chatSchema.parse(request.body);
    const stravaAccessToken = request.session.strava?.tokens?.access_token;

    const coach = await runCoachChat({
      userId: request.planUserId!,
      messages,
      stravaAccessToken,
    });

    response.json({ coach });
  } catch (error) {
    next(error);
  }
});

export { coachRouter };
