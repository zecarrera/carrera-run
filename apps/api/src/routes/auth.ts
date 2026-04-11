import { Router } from "express";
import { z } from "zod";
import { buildAuthorizationUrl, exchangeCodeForToken } from "../services/strava.js";

const authRouter = Router();

authRouter.get("/strava/login", (_request, response, next) => {
  try {
    response.redirect(buildAuthorizationUrl());
  } catch (error) {
    next(error);
  }
});

authRouter.get("/strava/callback", async (request, response, next) => {
  const querySchema = z.object({
    code: z.string(),
  });

  try {
    const { code } = querySchema.parse(request.query);
    const result = await exchangeCodeForToken(code);

    request.session.strava = {
      tokens: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
        expires_in: result.expires_in,
        token_type: result.token_type,
      },
      athlete: result.athlete,
    };

    response.redirect(process.env.CLIENT_ORIGIN ?? "/");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (request, response) => {
  request.session.destroy(() => {
    response.status(204).send();
  });
});

export { authRouter };
