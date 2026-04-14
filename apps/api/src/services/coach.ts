import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listPlans } from "./planning.js";
import { getProfile } from "./profile.js";
import { fetchActivities, normalizeActivity } from "./strava.js";
import type { NormalizedActivity } from "../types/strava.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cachedSystemPrompt: string | null = null;

const DEFAULT_COACH_MODEL = "llama3.1:8b";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachProposedAction {
  type: "create_plan" | "modify_plan" | "add_activity" | "none";
  reason: string;
  payload?: Record<string, unknown>;
}

export interface CoachResponse {
  answer: string;
  followUpQuestions: string[];
  proposedActions: CoachProposedAction[];
  safetyNotes: string[];
}

export interface RunCoachChatInput {
  userId: string;
  messages: CoachMessage[];
  stravaAccessToken?: string;
}

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  // Try cwd-relative path first (production), then relative to this file (development/tests)
  const cwdPath = resolve(process.cwd(), "prompts/coach-system.md");
  const srcRelPath = resolve(__dirname, "../../../prompts/coach-system.md");

  for (const promptPath of [cwdPath, srcRelPath]) {
    try {
      cachedSystemPrompt = await readFile(promptPath, "utf8");
      return cachedSystemPrompt;
    } catch {
      // try next path
    }
  }

  throw new Error("Could not find prompts/coach-system.md");
}

interface WeekSummary {
  weekStart: string;
  runCount: number;
  totalDistanceKm: number;
  longestRunKm: number;
  avgPaceMinPerKm: number | null;
  otherActivityTypes: string[];
}

function summarizeActivitiesByWeek(activities: NormalizedActivity[]): WeekSummary[] {
  const weeks = new Map<string, WeekSummary>();

  for (const activity of activities) {
    const date = new Date(activity.startDate);
    // Get Monday of the week
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday
    const daysToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - daysToMonday);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, {
        weekStart: weekKey,
        runCount: 0,
        totalDistanceKm: 0,
        longestRunKm: 0,
        avgPaceMinPerKm: null,
        otherActivityTypes: [],
      });
    }

    const week = weeks.get(weekKey)!;

    if (activity.type.toLowerCase() === "run") {
      week.runCount += 1;
      week.totalDistanceKm = Math.round((week.totalDistanceKm + activity.distanceKm) * 10) / 10;
      if (activity.distanceKm > week.longestRunKm) {
        week.longestRunKm = Math.round(activity.distanceKm * 10) / 10;
      }
      if (activity.averagePaceSecondsPerKm) {
        const paceMin = activity.averagePaceSecondsPerKm / 60;
        week.avgPaceMinPerKm =
          week.avgPaceMinPerKm === null
            ? Math.round(paceMin * 100) / 100
            : Math.round(((week.avgPaceMinPerKm + paceMin) / 2) * 100) / 100;
      }
    } else {
      if (!week.otherActivityTypes.includes(activity.type)) {
        week.otherActivityTypes.push(activity.type);
      }
    }
  }

  return Array.from(weeks.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

async function fetchActivityHistory(accessToken: string): Promise<WeekSummary[]> {
  if (accessToken === "dev-mock-token") {
    return [];
  }

  const sixMonthsAgo = Math.floor(Date.now() / 1000) - 6 * 30 * 24 * 60 * 60;
  const allActivities: NormalizedActivity[] = [];

  try {
    // Fetch up to 2 pages of 200 activities each (400 total) covering ~6 months
    for (let page = 1; page <= 2; page++) {
      const batch = await fetchActivities(accessToken, page, 200, sixMonthsAgo);
      const normalized = batch.map(normalizeActivity);
      allActivities.push(...normalized);
      if (batch.length < 200) break; // no more pages
    }
  } catch {
    // If activity fetch fails, continue without history rather than failing the whole chat
    console.warn("Coach: could not fetch Strava activity history, proceeding without it.");
  }

  return summarizeActivitiesByWeek(allActivities);
}

function normalizeCoachResponse(rawText: string): CoachResponse {
  const fallback: CoachResponse = {
    answer: rawText.trim() || "I can help with plan creation or plan updates.",
    followUpQuestions: [],
    proposedActions: [{ type: "none", reason: "Could not parse structured response from model." }],
    safetyNotes: [],
  };

  const trimmed = rawText.trim();

  try {
    const parsed = JSON.parse(trimmed);

    if (!parsed || typeof parsed.answer !== "string") {
      return fallback;
    }

    return {
      answer: parsed.answer,
      followUpQuestions: Array.isArray(parsed.followUpQuestions)
        ? parsed.followUpQuestions.filter((value: unknown) => typeof value === "string")
        : [],
      proposedActions: Array.isArray(parsed.proposedActions)
        ? parsed.proposedActions
            .filter((value: unknown) => typeof value === "object" && value !== null)
            .map((value: unknown) => {
              const action = value as Record<string, unknown>;
              const type =
                action.type === "create_plan" ||
                action.type === "modify_plan" ||
                action.type === "add_activity" ||
                action.type === "none"
                  ? action.type
                  : "none";
              return {
                type,
                reason: typeof action.reason === "string" ? action.reason : "No reason provided.",
                payload:
                  typeof action.payload === "object" && action.payload !== null
                    ? (action.payload as Record<string, unknown>)
                    : undefined,
              };
            })
        : [{ type: "none" as const, reason: "No structured actions were provided." }],
      safetyNotes: Array.isArray(parsed.safetyNotes)
        ? parsed.safetyNotes.filter((value: unknown) => typeof value === "string")
        : [],
    };
  } catch {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const maybeJson = trimmed.slice(jsonStart, jsonEnd + 1);
      try {
        return normalizeCoachResponse(maybeJson);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

// LLM backend — uses the OpenAI-compatible /v1/chat/completions API.
// Works with Ollama (default, local), OpenAI, Groq, Together AI, or any
// OpenAI-compatible endpoint. Configure via:
//   LLM_BASE_URL  — e.g. https://api.openai.com/v1 (default: http://localhost:11434/v1)
//   LLM_API_KEY   — required for cloud providers, omit for local Ollama
//   COACH_MODEL   — e.g. gpt-4o-mini or llama-3.1-8b-instant (default: llama3.1:8b for local Ollama)

// Cache for available models: fetched once per process, refreshed after MODELS_CACHE_TTL_MS.
const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let modelsCacheTime = 0;
let cachedModelIds: Set<string> | null = null;

/**
 * Validates that the configured COACH_MODEL is available on the provider.
 * Uses the OpenAI-compatible GET /models endpoint (supported by Groq, OpenAI, etc.).
 * Results are cached for 24 hours to stay well within free-tier rate limits.
 * Logs a warning on mismatch but never throws — chat should still be attempted.
 */
async function validateConfiguredModel(baseUrl: string, apiKey: string, model: string): Promise<void> {
  const now = Date.now();
  if (cachedModelIds && now - modelsCacheTime < MODELS_CACHE_TTL_MS) {
    // Use cached list
    if (!cachedModelIds.has(model)) {
      console.warn(
        `[Coach] Warning: COACH_MODEL '${model}' was not found in the provider's model list. ` +
        `The model may be deprecated or misspelled. Check available models at your provider ` +
        `(e.g. https://console.groq.com/docs/models for Groq).`,
      );
    }
    return;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl}/models`, { method: "GET", headers });
    if (!response.ok) {
      console.warn(`[Coach] Could not fetch model list from provider (${response.status}) — skipping model validation.`);
      return;
    }

    const payload = (await response.json()) as { data?: { id: string }[] };
    const ids = (payload.data ?? []).map((m) => m.id);
    cachedModelIds = new Set(ids);
    modelsCacheTime = now;

    if (!cachedModelIds.has(model)) {
      console.warn(
        `[Coach] Warning: COACH_MODEL '${model}' was not found in the provider's model list ` +
        `(available: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}). ` +
        `The model may be deprecated or misspelled. Check https://console.groq.com/docs/models for Groq.`,
      );
    }
  } catch {
    console.warn("[Coach] Could not reach provider models endpoint — skipping model validation.");
  }
}

async function queryLLM(systemPrompt: string, messages: CoachMessage[]): Promise<string> {
  const isLocalOllama = !process.env.LLM_BASE_URL;
  const model = process.env.COACH_MODEL?.trim() || DEFAULT_COACH_MODEL;
  const baseUrl = (process.env.LLM_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "");
  const apiKey = process.env.LLM_API_KEY ?? "";

  // Warn loudly when a cloud URL is configured but model is still the Ollama default
  if (!isLocalOllama && model === DEFAULT_COACH_MODEL) {
    throw new Error(
      `Coach misconfigured: LLM_BASE_URL is set to a cloud provider but COACH_MODEL is still '${DEFAULT_COACH_MODEL}' (the Ollama default). Set COACH_MODEL to a model supported by your provider, e.g. 'gpt-4o-mini' for OpenAI or 'llama-3.1-8b-instant' for Groq.`,
    );
  }

  // Validate the configured model against the provider's list (cloud only; cached 24h).
  if (!isLocalOllama) {
    await validateConfiguredModel(baseUrl, apiKey, model);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });
  } catch {
    const hint = isLocalOllama
      ? "at localhost:11434 — is Ollama running? Try: npm run ollama:start"
      : `at ${baseUrl} — check LLM_BASE_URL`;
    throw new Error(`Coach unavailable: could not reach LLM ${hint}`);
  }

  if (!response.ok) {
    const text = await response.text();
    let errorMsg: string;
    try {
      errorMsg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {
      errorMsg = text;
    }
    const modelHint = response.status === 404 || response.status === 400
      ? ` — set COACH_MODEL to a model supported by your LLM provider (currently '${model}'). See https://console.groq.com/docs/models for Groq.`
      : "";
    throw new Error(`Coach model request failed (${response.status}): ${errorMsg}${modelHint}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return payload.choices?.[0]?.message?.content ?? "";
}


export async function runCoachChat(input: RunCoachChatInput): Promise<CoachResponse> {
  const [systemPrompt, plans, profile, activityWeeks] = await Promise.all([
    loadSystemPrompt(),
    listPlans(input.userId),
    getProfile(input.userId),
    input.stravaAccessToken ? fetchActivityHistory(input.stravaAccessToken) : Promise.resolve([]),
  ]);

  const context = {
    userId: input.userId,
    plans,
    profile,
    activityHistory: {
      note: "Weekly summaries of the runner's Strava activity over the last ~6 months (most recent first).",
      weeks: activityWeeks,
    },
  };

  // Inject context into the first user message so every turn has full awareness
  const messagesWithContext: CoachMessage[] = input.messages.map((msg, index) => {
    if (index === 0 && msg.role === "user") {
      return {
        role: "user",
        content: [
          "App context (use this to understand the runner's history and current plans):",
          "",
          JSON.stringify(context, null, 2),
          "",
          "Runner message:",
          msg.content,
        ].join("\n"),
      };
    }
    return msg;
  });

  const modelText = await queryLLM(systemPrompt, messagesWithContext);
  return normalizeCoachResponse(modelText);
}
