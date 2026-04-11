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
  const sixMonthsAgo = Math.floor(Date.now() / 1000) - 6 * 30 * 24 * 60 * 60;
  const allActivities: NormalizedActivity[] = [];

  // Fetch up to 2 pages of 200 activities each (400 total) covering ~6 months
  for (let page = 1; page <= 2; page++) {
    const batch = await fetchActivities(accessToken, page, 200, sixMonthsAgo);
    const normalized = batch.map(normalizeActivity);
    allActivities.push(...normalized);
    if (batch.length < 200) break; // no more pages
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

async function queryOllama(systemPrompt: string, messages: CoachMessage[]): Promise<string> {
  const model = process.env.COACH_MODEL?.trim() || DEFAULT_COACH_MODEL;
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

  const sendChatRequest = async (modelName: string) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        stream: false,
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    const responseText = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    return { ok: response.ok, status: response.status, responseText, payload };
  };

  const getAvailableModels = async (): Promise<string[]> => {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { models?: { name: string }[] };
    if (!Array.isArray(payload.models)) return [];
    return payload.models
      .map((entry) => entry.name)
      .filter((value) => typeof value === "string" && value.length > 0);
  };

  const firstAttempt = await sendChatRequest(model);

  if (firstAttempt.ok) {
    return (firstAttempt.payload as Record<string, { content?: string }>)?.message?.content ?? "";
  }

  const firstErrorMessage =
    (firstAttempt.payload as Record<string, string>)?.error ?? firstAttempt.responseText;
  const missingModel = /not found/i.test(firstErrorMessage);

  if (missingModel) {
    const availableModels = await getAvailableModels();
    const alternateModel = availableModels.find((name) => name !== model);

    if (alternateModel) {
      const fallbackAttempt = await sendChatRequest(alternateModel);
      if (fallbackAttempt.ok) {
        return (fallbackAttempt.payload as Record<string, { content?: string }>)?.message?.content ?? "";
      }
    }

    const installedText =
      availableModels.length > 0
        ? `Installed models: ${availableModels.slice(0, 5).join(", ")}`
        : "No Ollama models are installed.";

    throw new Error(
      `Coach model request failed: model '${model}' was not found. ${installedText} Pull one with 'npm run ollama:pull' or set COACH_MODEL to an installed model.`,
    );
  }

  throw new Error(`Coach model request failed: ${firstErrorMessage}`);
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

  const modelText = await queryOllama(systemPrompt, messagesWithContext);
  return normalizeCoachResponse(modelText);
}
