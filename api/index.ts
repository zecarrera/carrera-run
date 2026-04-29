// Vercel serverless entry point.
// Vercel's esbuild bundler follows this import and bundles the full Express app.
// Env vars are injected by Vercel's runtime — dotenv is not needed here.
import app from "../apps/api/src/app.js";

export default app;
