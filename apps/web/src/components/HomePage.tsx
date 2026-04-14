import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate, formatDistance, formatDuration } from "../lib/format";
import type { Activity, ActivityStatus, AthleteSummary, PlanActivity, TrainingPlan } from "../types";

type HomePageProps = {
  summary: AthleteSummary;
};

type MonthTotals = {
  runs: number;
  distanceKm: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  completed: "Completed",
  completed_with_changes: "Modified",
  skipped: "Skipped",
};

function getMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function getMonthEnd(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function computeMonthTotals(activities: Activity[]): MonthTotals {
  const runs = activities.filter((a) => a.type.toLowerCase().includes("run"));
  return runs.reduce(
    (acc, run) => ({
      runs: acc.runs + 1,
      distanceKm: acc.distanceKm + run.distanceKm,
      movingTimeSeconds: acc.movingTimeSeconds + run.movingTimeSeconds,
      elevationGainMeters: acc.elevationGainMeters + run.elevationGainMeters,
    }),
    { runs: 0, distanceKm: 0, movingTimeSeconds: 0, elevationGainMeters: 0 },
  );
}

function getMonthLabel(): string {
  return new Date().toLocaleString("default", { month: "long", year: "numeric" });
}

export function HomePage({ summary }: HomePageProps) {
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [weekActivities, setWeekActivities] = useState<PlanActivity[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);
  const [updatingActivityId, setUpdatingActivityId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const after = getMonthStart();
        const before = getMonthEnd();
        const response = await fetch(
          `/api/activities?page=1&perPage=100&after=${encodeURIComponent(after)}&before=${encodeURIComponent(before)}`,
          { credentials: "include" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { activities: Activity[] };
        setMonthTotals(computeMonthTotals(payload.activities));
      } finally {
        setIsLoadingMonth(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/plans", { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as { plans: TrainingPlan[] };
        const plan =
          payload.plans.find((p) => p.status === "active") ??
          payload.plans.find((p) => p.status === "upcoming");
        if (!plan) return;
        const { start, end } = getWeekBounds();
        const thisWeek = [...plan.activities]
          .filter((a) => a.date >= start && a.date <= end)
          .sort((a, b) => a.date.localeCompare(b.date));
        setActivePlan(plan);
        setWeekActivities(thisWeek);
      } finally {
        setIsLoadingWeek(false);
      }
    };
    void load();
  }, []);

  const updateActivityStatus = async (
    activity: PlanActivity,
    status: ActivityStatus,
    comment?: string,
  ) => {
    if (!activePlan) return;
    setUpdatingActivityId(activity.id);
    try {
      const response = await fetch(
        `/api/plans/${activePlan.id}/activities/${activity.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, comment: comment ?? "" }),
        },
      );
      if (!response.ok) return;
      const result = (await response.json()) as { plan: TrainingPlan };
      // Refresh the week activities from the updated plan
      const { start, end } = getWeekBounds();
      const updated = [...result.plan.activities]
        .filter((a) => a.date >= start && a.date <= end)
        .sort((a, b) => a.date.localeCompare(b.date));
      setWeekActivities(updated);
      setShowCommentFor(null);
      setCommentDrafts((d) => { const next = { ...d }; delete next[activity.id]; return next; });
    } finally {
      setUpdatingActivityId(null);
    }
  };

  const { recentRun, athlete } = summary;

  return (
    <main className="shell dashboard-shell">
      <section className="hero-card compact">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>{athlete.displayName}</h1>
          <p>
            {recentRun
              ? `Last run: ${recentRun.name} on ${formatDate(recentRun.startDate)} for ${formatDistance(recentRun.distanceKm)}.`
              : "Your runs will appear here once Strava returns activity data."}
          </p>
        </div>
      </section>

      <section className="home-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>{getMonthLabel()}</h2>
          </div>
          {isLoadingMonth ? (
            <p className="subtle">Loading...</p>
          ) : !monthTotals || monthTotals.runs === 0 ? (
            <p className="subtle">No runs recorded this month yet.</p>
          ) : (
            <div className="month-stats-grid">
              <article className="summary-card">
                <span>Runs</span>
                <strong>{monthTotals.runs}</strong>
              </article>
              <article className="summary-card">
                <span>Distance</span>
                <strong>{formatDistance(monthTotals.distanceKm)}</strong>
              </article>
              <article className="summary-card">
                <span>Moving time</span>
                <strong>{formatDuration(monthTotals.movingTimeSeconds)}</strong>
              </article>
              <article className="summary-card">
                <span>Elevation</span>
                <strong>{Math.round(monthTotals.elevationGainMeters)} m</strong>
              </article>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Your Planning</h2>
            {activePlan && (
              <Link to="/planning" className="subtle-label subtle-label-link">
                {activePlan.raceName}
              </Link>
            )}
          </div>
          {isLoadingWeek ? (
            <p className="subtle">Loading...</p>
          ) : weekActivities.length === 0 ? (
            <div className="empty-week">
              <p className="subtle">No activities planned for this week.</p>
              <Link to="/planning" className="button-secondary">
                Go to planning
              </Link>
            </div>
          ) : (
            <ul className="week-activity-list">
              {weekActivities.map((activity) => {
                const isActioned = activity.status !== "not_started";
                const isBusy = updatingActivityId === activity.id;
                const isShowingComment = showCommentFor === activity.id;

                return (
                  <li key={activity.id} className="week-activity-item">
                    <div className="week-activity-meta">
                      <span className="week-activity-date">{formatDate(activity.date)}</span>
                      <span className={`status-pill ${activity.status}`}>
                        {STATUS_LABELS[activity.status] ?? activity.status}
                      </span>
                    </div>
                    <div className="week-activity-details">
                      <strong>{activity.type}</strong>
                      {activity.distanceKm != null && (
                        <span>{formatDistance(activity.distanceKm)}</span>
                      )}
                      {activity.durationMinutes != null && (
                        <span>{activity.durationMinutes} min</span>
                      )}
                      {activity.notes && <p className="week-activity-notes">{activity.notes}</p>}
                    </div>

                    {!isActioned && (
                      <div className="week-activity-actions">
                        <button
                          type="button"
                          className="action-btn action-btn--done"
                          disabled={isBusy}
                          onClick={() => void updateActivityStatus(activity, "completed")}
                        >
                          ✓ Done
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn--modified"
                          disabled={isBusy}
                          onClick={() =>
                            setShowCommentFor((c) => (c === activity.id ? null : activity.id))
                          }
                        >
                          ✎ Modified
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn--skip"
                          disabled={isBusy}
                          onClick={() => void updateActivityStatus(activity, "skipped")}
                        >
                          ✕ Skip
                        </button>
                      </div>
                    )}

                    {isShowingComment && (
                      <div className="week-activity-comment">
                        <input
                          type="text"
                          placeholder="What changed? (required)"
                          value={commentDrafts[activity.id] ?? ""}
                          onChange={(e) =>
                            setCommentDrafts((d) => ({ ...d, [activity.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="action-btn action-btn--done"
                          disabled={isBusy || !(commentDrafts[activity.id] ?? "").trim()}
                          onClick={() =>
                            void updateActivityStatus(
                              activity,
                              "completed_with_changes",
                              commentDrafts[activity.id],
                            )
                          }
                        >
                          {isBusy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn--skip"
                          onClick={() => setShowCommentFor(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!isLoadingWeek && !activePlan && weekActivities.length === 0 && (
            <Link to="/planning" className="button-secondary">
              Create a training plan
            </Link>
          )}
        </section>
      </section>
    </main>
  );
}

