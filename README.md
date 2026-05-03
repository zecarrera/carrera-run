# Carrera Run Strava Dashboard

<img src="apps/web/public/logo.png" alt="Carrera Run logo" width="96" />

A small full-stack starter for connecting to the Strava API and displaying running activities in a React UI.

## Stack

- Node.js + Express API in `apps/api`
- React + TypeScript + Vite frontend in `apps/web`
- Strava OAuth 2.0 authorization code flow handled on the backend
- MongoDB for training plan persistence
- OpenAI-compatible LLM (Ollama locally, any cloud provider in production) for the AI coach

## Features

- Sign in with Strava
- Backend token exchange and refresh support
- Dashboard summary for recent running activity
- Activities table with date, distance, moving time, elevation, and pace
- Activity detail panel in the UI
- Planning page for race-focused training plans and activity tracking
- **YouTube video recommendations**: today's activity card on the dashboard shows a "Recommended Video" section — Run activities get warm-up + cool-down suggestions; Strength/Flexibility get a relevant training video. Each video card has a **"Show Different Video"** button that refreshes only that card independently. With the YouTube API the button is always available (unlimited variety); with the curated fallback it shows a **"X of Y"** counter and disables when all options are exhausted. Powered by YouTube Data API v3 when `YOUTUBE_API_KEY` is set (fetches up to 10 results per search and skips already-seen videos), or a static curated list as fallback
- **Channel preferences** on the Profile page — manage preferred YouTube channels and an "allow other channels" fallback toggle
- **AI Coach**: conversational plan builder — asks questions, uses your Strava history, proposes a full training plan, and saves it on acceptance
- **Plan import**: upload a JSON file to create a plan with all activities in one step (see [Import format](#plan-import-format))
- **Plan delete**: remove a training plan (with confirmation) from the Plans list
- Profile page for training zones (Z1-Z5 pace ranges) and race-results history

## Local Setup

1. Create a Strava application in the Strava developer portal.
2. Configure the authorization callback URL as `http://localhost:4000/api/auth/strava/callback`.
3. Copy `.env.example` to `.env` and fill in your Strava credentials.
4. Install dependencies with `npm install` from the repository root.
5. Start the app with `npm run dev`.

For a one-command local setup with MongoDB **and** Ollama in Docker, use:

```
npm run dev:local
```

Then pull the default model (first time only):

```
npm run ollama:pull
```

Frontend runs on `http://localhost:5173` and proxies API requests to `http://localhost:4000`.

### Dev bypass login (no Strava OAuth needed locally)

When using `npm run dev:local`, **Strava is mocked automatically** — no login or OAuth flow required. The API injects a fake "Dev Runner" session on every request, and all Strava activity calls return realistic mock data anchored to the current week, so the dashboard progress bars populate immediately.

If you start the app with `npm run dev` (without mocks), or need to trigger the session manually, visit:

```
http://localhost:4000/api/auth/dev-login
```

This sets a fake session and shows clickable links to common Vite ports. You can also redirect explicitly:

```
http://localhost:4000/api/auth/dev-login?redirect=http://localhost:5174
```

> This route and the `STRAVA_MOCK` auto-session are available whenever `STRAVA_MOCK=true` — locally and on Vercel preview. Never set `STRAVA_MOCK` in production.

### Helper scripts

| Script | Description |
|---|---|
| `npm run dev:local` | Start Mongo + Ollama + API + Web (Strava mocked automatically) |
| `npm run dev:kill-port` | Kill any process holding port 4000 |
| `npm run mongo:start` | Start MongoDB Docker container |
| `npm run mongo:stop` | Stop MongoDB Docker container |
| `npm run mongo:logs` | Tail MongoDB logs |
| `npm run ollama:start` | Start Ollama Docker container |
| `npm run ollama:stop` | Stop Ollama Docker container |
| `npm run ollama:pull` | Pull `llama3.1:8b` into Ollama |
| `npm run ollama:logs` | Tail Ollama logs |

## Environment Variables

| Variable | Description |
|---|---|
| `STRAVA_CLIENT_ID` | Strava application client ID |
| `STRAVA_CLIENT_SECRET` | Strava application client secret |
| `STRAVA_REDIRECT_URI` | Backend OAuth callback endpoint |
| `STRAVA_SCOPES` | Requested Strava scopes |
| `SESSION_SECRET` | Session signing secret |
| `CLIENT_ORIGIN` | Frontend origin (dev only — set to Vite's port) |
| `NODE_ENV` | `development` locally, `production` on Vercel |
| `PORT` | API port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | MongoDB database name (default `carrera_run`) |
| `LLM_BASE_URL` | OpenAI-compatible LLM base URL (default: `http://localhost:11434/v1` for Ollama) |
| `LLM_API_KEY` | API key for cloud LLM providers (leave empty for local Ollama) |
| `COACH_MODEL` | LLM model name (default: `llama3.1:8b`) |
| `STRAVA_MOCK` | Set to `true` to auto-inject a mock Strava session (auto-set by `dev:local`) |
| `YOUTUBE_API_KEY` | Google Cloud API key for YouTube Data API v3. When set, video recommendations are fetched dynamically from YouTube. When unset, a static curated list is used as fallback. |

### AI Coach — production LLM options

The coach works with any OpenAI-compatible provider. Set `LLM_BASE_URL`, `LLM_API_KEY`, and `COACH_MODEL` in your environment:

| Provider | `LLM_BASE_URL` | `COACH_MODEL` example |
|---|---|---|
| Local Ollama | `http://localhost:11434/v1` | `llama3.1:8b` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq (free tier) | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| Any OpenAI-compat | your URL | model name |

## Deploy to Vercel (Free) + Mongo Atlas (Free)

Recommended setup:

- **Vercel Hobby (free)** — React SPA on Vercel's CDN, Express API as a serverless function. No sleep/cold-start penalty (functions spin up in ~100–500ms vs. the 30–60s wake-up of some platforms).
- **MongoDB Atlas M0 (free)** — managed MongoDB.

The repo uses a single Vercel project. `vercel.json` at the root configures the build and routes all `/api/*` requests to the Express serverless function while everything else is served from the static React build.

### 1) Create MongoDB Atlas free cluster (M0)

1. Create an Atlas project and an **M0 free cluster**.
2. In **Database Access**, create an app user and password.
3. In **Network Access**, add `0.0.0.0/0` — Vercel functions run from dynamic IPs so all-IP access is required.
4. Copy the connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
5. Use database name `carrera_run` (or your preferred value).

### 2) Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, create a **New Project** and import the repo.
3. Vercel will detect `vercel.json` automatically — no framework preset needed; leave build settings as-is.
4. Set the following **Environment Variables** (Production):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | _(generate a long random value)_ |
| `STRAVA_CLIENT_ID` | _(from Strava API settings)_ |
| `STRAVA_CLIENT_SECRET` | _(from Strava API settings)_ |
| `STRAVA_REDIRECT_URI` | `https://<your-vercel-domain>/api/auth/strava/callback` |
| `STRAVA_SCOPES` | `read,activity:read_all` |
| `MONGODB_URI` | _(your Atlas connection string)_ |
| `MONGODB_DB_NAME` | `carrera_run` |
| `LLM_BASE_URL` | e.g. `https://api.groq.com/openai/v1` |
| `LLM_API_KEY` | _(Groq or OpenAI API key)_ |
| `COACH_MODEL` | e.g. `llama-3.1-8b-instant` |

### 2b) Vercel preview environment (optional)

To use mock Strava data on preview deployments (no real Strava credentials needed):

1. In Vercel → Project Settings → **Environment Variables**
2. Add `STRAVA_MOCK` = `true`, scoped to **Preview** only (not Production)

Preview deployments will then auto-inject a fake "Dev Runner" session and return mock activity data. All other env vars (`MONGODB_URI`, `SESSION_SECRET`, `LLM_*`) still apply.

> **Note:** `CLIENT_ORIGIN` is not needed on Vercel — the web and API share the same domain, so CORS is not required.

### 3) Update Strava app callback

In Strava developer settings, set **Authorization Callback Domain** to your Vercel domain (domain only, no `https://` or trailing slash), e.g. `carrera-run.vercel.app`.

> Strava only allows one callback domain per app. To switch between local and production, update this field in the Strava developer portal (takes ~10 seconds).

### 4) Validate deployment

- Health check: `https://<your-vercel-domain>/api/health`
- Open the app and test Strava login
- Create/read a plan to verify Atlas persistence
- Go to Planning → "🤖 Build with Coach" to test the AI coach

### Free-tier notes

- Vercel Hobby serverless functions have a **10-second execution limit**. The AI coach uses Groq (typically 2–5s) which is well within the limit.
- Atlas M0 has shared resources and storage limits.
- Sessions are persisted to MongoDB, so users stay logged in across function cold starts.

## Planning API (MongoDB-backed)

- `GET /api/plans`
- `POST /api/plans`
- `POST /api/plans/import` — create a plan from a JSON file (see below)
- `GET /api/plans/:id`
- `PATCH /api/plans/:id`
- `DELETE /api/plans/:id`
- `POST /api/plans/:id/activities`
- `PATCH /api/plans/:id/activities/:activityId`
- `DELETE /api/plans/:id/activities/:activityId`

### Plan import format

Upload a `.json` file via the **⬆ Import JSON** button on the Planning page, or POST directly to `/api/plans/import`:

```json
{
  "raceName": "Boston Marathon",
  "raceDistanceKm": 42.2,
  "startDate": "2024-01-01",
  "endDate": "2024-04-15",
  "activities": [
    { "date": "2024-01-02", "type": "Run", "distanceKm": 10, "paceMinPerKm": 5.5, "notes": "Easy run" },
    { "date": "2024-01-03", "type": "Strength", "durationMinutes": 45 },
    { "date": "2024-01-04", "type": "Flexibility", "durationMinutes": 20 }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `raceName` | string | ✅ | Max 160 chars |
| `raceDistanceKm` | number | ✅ | Positive, max 500 |
| `startDate` | string | ✅ | `YYYY-MM-DD` |
| `endDate` | string | ✅ | `YYYY-MM-DD`, ≥ startDate |
| `activities` | array | ✅ | Can be empty `[]` |

**Run activity**: requires `distanceKm` (number) and `paceMinPerKm` (number).  
**Strength / Flexibility activity**: requires `durationMinutes` (number).  
All activity `date` values must fall within the plan window. `id`, `userId`, `createdAt`, `updatedAt` are ignored — generated server-side. `status` defaults to `not_started`.

## Coach API

- `POST /api/coach/chat` — body: `{ messages: [{ role, content }] }` — multi-turn conversation with the AI coach

## Profile API (MongoDB-backed)

- `GET /api/profile`
- `PUT /api/profile/zones`
- `PUT /api/profile/video-channels` — body: `{ preferredChannels: string[], allowOtherChannels: boolean }`
- `POST /api/profile/race-results`
- `PATCH /api/profile/race-results/:resultId`
- `DELETE /api/profile/race-results/:resultId`

## Videos API

- `GET /api/videos/recommendation?activityType=Run|Strength|Flexibility` — returns 1–2 `VideoRecommendation` objects filtered by the user's preferred channels. Uses YouTube Data API v3 when `YOUTUBE_API_KEY` is set; falls back to a static curated list otherwise.

## Notes
- The app stores tokens in the server session for local development.
- Secrets remain on the backend; the browser never sees the Strava client secret.
- The current UI focuses on runs. Other activity types are filtered out of the dashboard metrics.

