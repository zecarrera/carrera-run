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
- **AI Coach**: conversational plan builder — asks questions, uses your Strava history, proposes a full training plan, and saves it on acceptance
- **Plan import**: upload a JSON file to create a plan with all activities in one step (see [Import format](#plan-import-format))
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

If your Strava app's callback domain is set to production, you can still test locally with a mock session:

```
http://localhost:4000/api/auth/dev-login
```

This sets a fake "Dev Runner" session and shows clickable links to common Vite ports. You can also redirect explicitly:

```
http://localhost:4000/api/auth/dev-login?redirect=http://localhost:5174
```

> This route is **only available when `NODE_ENV !== production`** and is never exposed in deployed builds.

### Helper scripts

| Script | Description |
|---|---|
| `npm run dev:local` | Start Mongo + Ollama + API + Web |
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
| `NODE_ENV` | `development` locally, `production` on Render |
| `PORT` | API port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | MongoDB database name (default `carrera_run`) |
| `LLM_BASE_URL` | OpenAI-compatible LLM base URL (default: `http://localhost:11434/v1` for Ollama) |
| `LLM_API_KEY` | API key for cloud LLM providers (leave empty for local Ollama) |
| `COACH_MODEL` | LLM model name (default: `llama3.1:8b`) |

### AI Coach — production LLM options

The coach works with any OpenAI-compatible provider. Set `LLM_BASE_URL`, `LLM_API_KEY`, and `COACH_MODEL` in your environment:

| Provider | `LLM_BASE_URL` | `COACH_MODEL` example |
|---|---|---|
| Local Ollama | `http://localhost:11434/v1` | `llama3.1:8b` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq (free tier) | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| Any OpenAI-compat | your URL | model name |

## Deploy to Render (Free) + Mongo Atlas (Free)

Recommended setup for this project:

- **Render Web Service (free)** for API + built frontend in a single service
- **MongoDB Atlas M0 (free)** for managed MongoDB

Why this is the best free combination now:

- Atlas M0 is a true managed MongoDB free tier
- Render free works well for Node apps but does not provide a native free MongoDB product
- Single service deployment avoids cross-site cookie/session issues

### 1) Create MongoDB Atlas free cluster (M0)

1. Create an Atlas project and an **M0 free cluster**.
2. In **Database Access**, create an app user and password.
3. In **Network Access**, add `0.0.0.0/0` for quick start (tighten later if needed).
4. Copy the connection string, for example:

	`mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app>`

5. Use database name `carrera_run` (or your preferred value).

### 2) Create Render web service

1. Push this repo to GitHub.
2. In Render, create a **Web Service** from the repo (or use Blueprint with `render.yaml`).
3. Set plan to **Free**.
4. Ensure build/start commands are:
	- Build: `npm ci && npm run build`
	- Start: `npm run start`
5. Set environment variables in Render:
	- `NODE_ENV=production`
	- `SESSION_SECRET=<long-random-secret>`
	- `STRAVA_CLIENT_ID=<value>`
	- `STRAVA_CLIENT_SECRET=<value>`
	- `STRAVA_SCOPES=read,activity:read_all`
	- `STRAVA_REDIRECT_URI=https://<your-render-service>.onrender.com/api/auth/strava/callback`
	- `MONGODB_URI=<your-atlas-uri>`
	- `MONGODB_DB_NAME=carrera_run`
	- `LLM_BASE_URL=<your-llm-endpoint>` (e.g. Groq or OpenAI)
	- `LLM_API_KEY=<your-api-key>`
	- `COACH_MODEL=<model-name>` (e.g. `gpt-4o-mini` or `llama-3.1-8b-instant`)

### 3) Update Strava app callback

In Strava developer settings, set **Authorization Callback Domain** to:

- `<your-render-service>.onrender.com` (domain only, no `https://` or trailing slash)

> **Note:** Strava only allows one app and one callback domain per account. This means you can only have local dev **or** production active at a time — not both simultaneously. To switch: update the callback domain in the Strava developer portal to `localhost` for local dev, or back to your Render domain for production. The switch takes ~10 seconds.

### 4) Validate deployment

- Health check: `https://<your-render-service>.onrender.com/api/health`
- Open app root URL and test Strava login
- Create/read a plan to verify Atlas persistence
- Go to Planning → "🤖 Build with Coach" to test the AI coach

### Free-tier notes

- Render free instances sleep when idle (cold starts are expected).
- Atlas M0 has shared resources and storage limits.
- Keep logs/usage under free-tier quotas.

## Planning API (MongoDB-backed)

- `GET /api/plans`
- `POST /api/plans`
- `POST /api/plans/import` — create a plan from a JSON file (see below)
- `GET /api/plans/:id`
- `PATCH /api/plans/:id`
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
- `POST /api/profile/race-results`
- `PATCH /api/profile/race-results/:resultId`
- `DELETE /api/profile/race-results/:resultId`

## Notes

- The app stores tokens in the server session for local development.
- Secrets remain on the backend; the browser never sees the Strava client secret.
- The current UI focuses on runs. Other activity types are filtered out of the dashboard metrics.

