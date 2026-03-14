import dotenv from "dotenv";
import { resolve } from "node:path";
import express from "express";
import session from "express-session";
import cors from "cors";
import { ZodError } from "zod";
import { activitiesRouter } from "./routes/activities.js";
import { athleteRouter } from "./routes/athlete.js";
import { authRouter } from "./routes/auth.js";
import { plansRouter } from "./routes/plans.js";
import { profileRouter } from "./routes/profile.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
    name: "carrera-run.sid",
    secret: process.env.SESSION_SECRET ?? "development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/activities", activitiesRouter);
app.use("/api/athlete", athleteRouter);
app.use("/api/plans", plansRouter);
app.use("/api/profile", profileRouter);

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
  console.log(`API listening on http://localhost:${port}`);
});
