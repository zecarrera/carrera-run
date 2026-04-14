import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate, formatDistance, formatDuration } from "../lib/format";
import type { Activity, AthleteSummary, PlanActivity, TrainingPlan } from "../types";

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
  const [weekActivities, setWeekActivities] = useState<PlanActivity[]>([]);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const after = getMonthStart();
        const before = getMonthEnd();
        const response = await fetch(
          `/api/activities?page=1&perPage=100&after=${encodeURIComponent(after)}&before=${encodeURIComponent(before)}`,
          {
            credentials: "include",
          }
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
        const active =
          payload.plans.find((p) => p.status === "active") ??
          payload.plans.find((p) => p.status === "upcoming");
        if (!active) {
          setWeekActivities([]);
          return;
        }
        const { start, end } = getWeekBounds();
        const thisWeek = active.activities.filter((a) => a.date >= start && a.date <= end);
        thisWeek.sort((a, b) => a.date.localeCompare(b.date));
        setActivePlanName(active.raceName);
        setWeekActivities(thisWeek);
      } finally {
        setIsLoadingWeek(false);
      }
    };
    void load();
  }, []);

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
            <h2>This week</h2>
            {activePlanName && <span className="subtle-label">{activePlanName}</span>}
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
              {weekActivities.map((activity) => (
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
                </li>
              ))}
            </ul>
          )}
          {!isLoadingWeek && !activePlanName && weekActivities.length === 0 && (
            <Link to="/planning" className="button-secondary">
              Create a training plan
            </Link>
          )}
        </section>
      </section>
    </main>
  );
}
