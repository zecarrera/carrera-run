import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  CoachMessage,
  CoachProposedAction,
  CoachResponse,
  PlanActivity,
  TrainingPlan,
} from "../types";
import { formatDate, formatDistance } from "../lib/format";

interface ProposedPlanPayload {
  raceName: string;
  raceDistanceKm: number;
  startDate: string;
  endDate: string;
  activities: Omit<PlanActivity, "id" | "status">[];
}

interface CoachPlanWizardProps {
  onPlanCreated: (plan: TrainingPlan) => void;
  onClose: () => void;
}

const EXAMPLE_PROMPTS = [
  "5k race in 6 weeks, 3 days/week (Tue/Thu/Sat), target sub-30 min, no injuries",
  "10k race in 10 weeks, 4 days/week, target ~55 min, currently running ~20 km/week",
  "Half marathon in 16 weeks, 4 days/week, first half marathon, base ~30 km/week",
  "Marathon in 20 weeks, 5 days/week, have run halfs before, target finish under 4 h",
];

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? "Request failed.");
  }

  return (await response.json()) as T;
}

function isProposedPlanPayload(payload: unknown): payload is ProposedPlanPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.raceName === "string" &&
    typeof p.raceDistanceKm === "number" &&
    typeof p.startDate === "string" &&
    typeof p.endDate === "string" &&
    Array.isArray(p.activities)
  );
}

function getPlanProposal(actions: CoachProposedAction[]): ProposedPlanPayload | null {
  const action = actions.find((a) => a.type === "create_plan" && a.payload);
  if (!action?.payload) return null;
  return isProposedPlanPayload(action.payload) ? action.payload : null;
}

function formatPaceMinPerKm(paceMinPerKm: number): string {
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}


export function CoachPlanWizard({ onPlanCreated, onClose }: CoachPlanWizardProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestResponse, setLatestResponse] = useState<CoachResponse | null>(null);
  const [proposedPlan, setProposedPlan] = useState<ProposedPlanPayload | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, latestResponse]);

  const sendMessage = async (userContent: string) => {
    if (!userContent.trim() || isLoading) return;

    const updatedMessages: CoachMessage[] = [
      ...messages,
      { role: "user", content: userContent.trim() },
    ];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { coach } = await apiRequest<{ coach: CoachResponse }>("/api/coach/chat", {
        method: "POST",
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const assistantMessage: CoachMessage = {
        role: "assistant",
        content: coach.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLatestResponse(coach);

      const proposal = getPlanProposal(coach.proposedActions);
      if (proposal) {
        setProposedPlan(proposal);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Coach request failed.");
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleQuickReply = (question: string) => {
    void sendMessage(question);
  };

  const handleAcceptPlan = async () => {
    if (!proposedPlan) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { plan } = await apiRequest<{ plan: TrainingPlan }>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          raceName: proposedPlan.raceName,
          raceDistanceKm: proposedPlan.raceDistanceKm,
          startDate: proposedPlan.startDate,
          endDate: proposedPlan.endDate,
        }),
      });

      // Add activities sequentially to preserve order
      let updatedPlan = plan;
      for (const activity of proposedPlan.activities) {
        const { plan: withActivity } = await apiRequest<{ plan: TrainingPlan }>(
          `/api/plans/${plan.id}/activities`,
          {
            method: "POST",
            body: JSON.stringify(activity),
          },
        );
        updatedPlan = withActivity;
      }

      onPlanCreated(updatedPlan);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save plan.");
      setIsSaving(false);
    }
  };

  const handleRequestChanges = () => {
    setProposedPlan(null);
    void sendMessage("I'd like to make some changes to this plan.");
  };

  const followUpQuestions = latestResponse?.followUpQuestions ?? [];
  const safetyNotes = latestResponse?.safetyNotes ?? [];
  const hasStarted = messages.length > 0;

  return (
    <div className="panel coach-wizard">
      <div className="panel-header">
        <h2>🤖 Coach</h2>
        <button type="button" className="button-secondary coach-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="coach-messages">
        {/* Static greeting — shown before any API call to save a full LLM round-trip */}
        {!hasStarted && (
          <div className="coach-bubble coach-bubble--assistant">
            <span className="coach-bubble-label">Coach</span>
            <p>
              Hey! I'm your running coach. Tell me about your race goal and I'll build a personalised
              training plan for you. Include your race distance, target date, how many days per week
              you can train, and any target pace or finish time — the more you share upfront, the
              faster we can get to your plan.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`coach-bubble coach-bubble--${msg.role}`}>
            {msg.role === "assistant" && <span className="coach-bubble-label">Coach</span>}
            <p>{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="coach-bubble coach-bubble--assistant coach-bubble--loading">
            <span className="coach-bubble-label">Coach</span>
            <p>Thinking…</p>
          </div>
        )}

        {safetyNotes.length > 0 && (
          <div className="coach-safety-notes">
            {safetyNotes.map((note, i) => (
              <p key={i}>⚠️ {note}</p>
            ))}
          </div>
        )}

        {proposedPlan && (
          <div className="coach-plan-proposal">
            <h3>Proposed Plan</h3>
            <div className="coach-plan-meta">
              <span>
                <strong>{proposedPlan.raceName}</strong>
              </span>
              <span>{formatDistance(proposedPlan.raceDistanceKm)}</span>
              <span>
                {formatDate(proposedPlan.startDate)} → {formatDate(proposedPlan.endDate)}
              </span>
            </div>
            <div className="coach-plan-activities">
              {proposedPlan.activities.map((activity, i) => (
                <div key={i} className="coach-plan-activity">
                  <span className="coach-plan-activity-date">{formatDate(activity.date)}</span>
                  <span className={`coach-activity-badge coach-activity-badge--${activity.type.toLowerCase()}`}>
                    {activity.type}
                  </span>
                  <span className="coach-plan-activity-detail">
                    {"distanceKm" in activity && activity.distanceKm != null
                      ? `${formatDistance(activity.distanceKm as number)}`
                      : ""}
                    {"paceMinPerKm" in activity && activity.paceMinPerKm != null
                      ? ` @ ${formatPaceMinPerKm(activity.paceMinPerKm as number)}`
                      : ""}
                    {"durationMinutes" in activity && activity.durationMinutes != null
                      ? `${String(activity.durationMinutes)} min`
                      : ""}
                  </span>
                  {activity.notes && (
                    <span className="coach-plan-activity-notes">{activity.notes}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="coach-plan-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => void handleAcceptPlan()}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Accept Plan"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleRequestChanges}
                disabled={isSaving}
              >
                Request Changes
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Example prompts — shown only before the first message to save tokens */}
      {!hasStarted && !isLoading && (
        <div className="coach-examples">
          <p className="coach-examples-label">Quick start — click to use:</p>
          <div className="coach-quick-replies">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="coach-quick-reply"
                onClick={() => handleQuickReply(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up suggestions — shown after the coach responds */}
      {hasStarted && followUpQuestions.length > 0 && !isLoading && (
        <div className="coach-quick-replies">
          {followUpQuestions.map((question, i) => (
            <button
              key={i}
              type="button"
              className="coach-quick-reply"
              onClick={() => handleQuickReply(question)}
              disabled={isLoading}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {errorMessage && <p className="coach-error">{errorMessage}</p>}

      <form className="coach-input-row" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="coach-input"
          placeholder="Tell your coach about your goal…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || isSaving}
        />
        <button
          type="submit"
          className="button-primary coach-send-btn"
          disabled={!input.trim() || isLoading || isSaving}
        >
          Send
        </button>
      </form>
    </div>
  );
}
