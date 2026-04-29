import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import app from "./app.js";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDistPath = resolve(__dirname, "../../web/dist");

// Serve the React SPA when running as a traditional standalone server.
// On Vercel, the CDN handles static files so this block is not reached.
if (isProduction) {
  app.use(express.static(webDistPath));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(resolve(webDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
