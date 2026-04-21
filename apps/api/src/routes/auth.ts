import { Router } from "express";
import { z } from "zod";
import { buildAuthorizationUrl, exchangeCodeForToken } from "../services/strava.js";
import { MOCK_ACCESS_TOKEN } from "../services/strava-mock.js";

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

// Dev-only route: bypass Strava OAuth with a mock session for local testing.
// Never available in production.
if (process.env.NODE_ENV !== "production") {
  authRouter.get("/dev-login", (request, response) => {
    request.session.strava = {
      tokens: {
        access_token: MOCK_ACCESS_TOKEN,
        refresh_token: "dev-mock-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "Bearer",
      },
      athlete: {
        id: 99999999,
        firstname: "Dev",
        lastname: "Runner",
        username: "dev_runner",
        profile: undefined,
      },
    };

    // Allow an explicit redirect param, fall back to CLIENT_ORIGIN env var, then show a
    // clickable page so the developer can navigate to whatever port Vite started on.
    const redirectTo =
      typeof request.query.redirect === "string"
        ? request.query.redirect
        : (process.env.CLIENT_ORIGIN ?? null);

    if (redirectTo) {
      response.redirect(redirectTo);
      return;
    }

    response.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Dev login</title></head>
<body style="font-family:sans-serif;padding:2rem">
  <h2>✅ Dev session created</h2>
  <p>Navigate to your Vite dev server, e.g.:</p>
  <ul>
    <li><a href="http://localhost:5173">http://localhost:5173</a></li>
    <li><a href="http://localhost:5174">http://localhost:5174</a></li>
    <li><a href="http://localhost:5175">http://localhost:5175</a></li>
  </ul>
  <p>Or go directly: <code>http://localhost:4000/api/auth/dev-login?redirect=http://localhost:5174</code></p>
</body>
</html>`);
  });
}

authRouter.post("/logout", (request, response) => {
  request.session.destroy(() => {
    response.status(204).send();
  });
});

export { authRouter };
