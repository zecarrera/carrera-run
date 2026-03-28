# Carrera Run Strava Dashboard

<img src="apps/web/public/logo.png" alt="Carrera Run logo" width="96" />

A small full-stack starter for connecting to the Strava API and displaying running activities in a React UI.

## Stack

- Node.js + Express API in `apps/api`
- React + TypeScript + Vite frontend in `apps/web`
- Strava OAuth 2.0 authorization code flow handled on the backend
- MongoDB for training plan persistence

## Features

- Sign in with Strava
- Backend token exchange and refresh support
- Dashboard summary for recent running activity
- Activities table with date, distance, moving time, elevation, and pace
- Activity detail panel in the UI
- Planning page for race-focused training plans and activity tracking
- Profile page for training zones (Z1-Z5 pace ranges) and race-results history

## Local Setup

1. Create a Strava application in the Strava developer portal.
2. Configure the authorization callback URL as `http://localhost:4000/api/auth/strava/callback`.
3. Copy `.env.example` to `.env` and fill in your Strava credentials.
4. Install dependencies with `npm install` from the repository root.
5. Start the app with `npm run dev`.

If you want a one-command local setup with MongoDB in Docker, use:

- `npm run dev:local`

Useful Mongo helper scripts:

- `npm run mongo:start`
- `npm run mongo:stop`
- `npm run mongo:logs`

Frontend runs on `http://localhost:5173` and proxies API requests to `http://localhost:4000`.

## Environment Variables

- `STRAVA_CLIENT_ID`: Strava application client ID
- `STRAVA_CLIENT_SECRET`: Strava application client secret
- `STRAVA_REDIRECT_URI`: Backend callback endpoint
- `STRAVA_SCOPES`: Requested Strava scopes
- `SESSION_SECRET`: Session signing secret for local development
- `CLIENT_ORIGIN`: Frontend origin allowed by the API
- `NODE_ENV`: Runtime mode (`development` locally, `production` in Render)
- `PORT`: API port
- `MONGODB_URI`: MongoDB connection string used by planning endpoints
- `MONGODB_DB_NAME`: MongoDB database name (default `carrera_run`)

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

### 3) Update Strava app callback

In Strava developer settings, set **Authorization Callback Domain** to:

- `<your-render-service>.onrender.com` (domain only, no `https://` or trailing slash)

> **Note:** Strava only allows one app and one callback domain per account. This means you can only have local dev **or** production active at a time — not both simultaneously. To switch: update the callback domain in the Strava developer portal to `localhost` for local dev, or back to your Render domain for production. The switch takes ~10 seconds.

### 4) Validate deployment

- Health check: `https://<your-render-service>.onrender.com/api/health`
- Open app root URL and test Strava login
- Create/read a plan to verify Atlas persistence

### Free-tier notes

- Render free instances sleep when idle (cold starts are expected).
- Atlas M0 has shared resources and storage limits.
- Keep logs/usage under free-tier quotas.

## Planning API (MongoDB-backed)

- `GET /api/plans`
- `POST /api/plans`
- `GET /api/plans/:id`
- `PATCH /api/plans/:id`
- `POST /api/plans/:id/activities`
- `PATCH /api/plans/:id/activities/:activityId`
- `DELETE /api/plans/:id/activities/:activityId`

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
