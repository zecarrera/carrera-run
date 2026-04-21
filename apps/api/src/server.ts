import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import { ZodError } from "zod";
import { activitiesRouter } from "./routes/activities.js";
import { athleteRouter } from "./routes/athlete.js";
import { authRouter } from "./routes/auth.js";
import { coachRouter } from "./routes/coach.js";
import { plansRouter } from "./routes/plans.js";
import { profileRouter } from "./routes/profile.js";
import { videosRouter } from "./routes/videos.js";
import { MOCK_ACCESS_TOKEN } from "./services/strava-mock.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDistPath = resolve(__dirname, "../../web/dist");

if (isProduction) {
  app.set("trust proxy", 1);
}

if (!isProduction || process.env.CLIENT_ORIGIN) {
  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    }),
  );
}
app.use(express.json());
app.use(
  session({
    name: "carrera-run.sid",
    secret: process.env.SESSION_SECRET ?? "development-session-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME ?? "carrera_run",
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 7, // 7 days, matches cookie maxAge
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

// When STRAVA_MOCK=true, auto-inject a mock Strava session so the app starts
// pre-authenticated without needing to visit /api/auth/dev-login.
if (!isProduction && process.env.STRAVA_MOCK === "true") {
  console.log("[dev] STRAVA_MOCK=true — all requests will use mock Strava data");
  app.use((request, _response, next) => {
    if (!request.session.strava) {
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
    }
    next();
  });
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/athlete", athleteRouter);
app.use("/api/coach", coachRouter);
app.use("/api/plans", plansRouter);
app.use("/api/profile", profileRouter);
app.use("/api/videos", videosRouter);

if (isProduction) {
  app.use(express.static(webDistPath));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(resolve(webDistPath, "index.html"));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Invalid request payload.",
      issues: error.issues,
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const statusCode = error instanceof Error && message.toLowerCase().includes("invalid") ? 400 : 500;
  response.status(statusCode).json({ message });
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
