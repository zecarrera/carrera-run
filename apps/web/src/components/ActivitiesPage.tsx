import { useCallback, useEffect, useState } from "react";
import { formatDistance, formatDuration, formatPace } from "../lib/format";
import type { Activity } from "../types";
import { EMPTY_FILTERS } from "./ActivityFilters";
import type { Filters } from "./ActivityFilters";

const PER_PAGE = 30;
type LoadState = "loading" | "ready" | "error";

const ACTIVITY_TYPES = [
  "Run", "TrailRun", "VirtualRun", "Ride", "VirtualRide",
  "Walk", "Hike", "Swim", "Workout", "WeightTraining", "Yoga",
];

function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(isoDate));
}

function formatPaceShort(paceSecondsPerKm: number): string {
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = paceSecondsPerKm % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function computeStats(activities: Activity[]) {
  const totalKm = activities.reduce((sum, a) => sum + a.distanceKm, 0);
  const paced = activities.filter((a) => a.averagePaceSecondsPerKm !== null);
  const avgPaceSeconds = paced.length
    ? Math.round(paced.reduce((sum, a) => sum + (a.averagePaceSecondsPerKm ?? 0), 0) / paced.length)
    : null;
  const totalElevation = Math.round(activities.reduce((sum, a) => sum + a.elevationGainMeters, 0));
  return { totalKm, count: activities.length, avgPaceSeconds, totalElevation };
}

export function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const loadActivities = useCallback(async (nextPage: number, filters: Filters = EMPTY_FILTERS) => {
    setIsLoadingPage(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), perPage: String(PER_PAGE) });
      if (filters.dateFrom) params.set("after", filters.dateFrom);
      if (filters.dateTo) params.set("before", filters.dateTo);
      if (filters.activityType) params.set("type", filters.activityType);
      const response = await fetch(`/api/activities?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to fetch activities.");
      const payload = (await response.json()) as { activities: Activity[] };
      setActivities(payload.activities);
      setIsLastPage(payload.activities.length < PER_PAGE);
      setPage(nextPage);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const handleApplyFilters = useCallback(() => {
    setActiveFilters(filterDraft);
    void loadActivities(1, filterDraft);
    setShowFilters(false);
  }, [filterDraft, loadActivities]);

  const handleResetFilters = useCallback(() => {
    setFilterDraft(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
    void loadActivities(1, EMPTY_FILTERS);
  }, [loadActivities]);

  useEffect(() => {
    const load = async () => {
      try {
        setState("loading");
        setErrorMessage(null);
        const response = await fetch(`/api/activities?page=1&perPage=${PER_PAGE}`, { credentials: "include" });
        if (!response.ok) throw new Error("Unable to fetch activities.");
        const payload = (await response.json()) as { activities: Activity[] };
        setActivities(payload.activities);
        setIsLastPage(payload.activities.length < PER_PAGE);
        setState("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load activities.");
        setState("error");
      }
    };
    void load();
  }, []);

  if (state === "loading") {
    return (
      <main className="activities-page">
        <div className="activities-page-header">
          <h1>Activities</h1>
          <p>Track and manage your runs</p>
        </div>
        <p className="activities-status-msg">Loading your activities…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="activities-page">
        <div className="activities-page-header">
          <h1>Activities</h1>
          <p>Track and manage your runs</p>
        </div>
        <p className="activities-status-msg error">{errorMessage}</p>
      </main>
    );
  }

  const stats = computeStats(activities);
  const hasActiveFilters =
    activeFilters.dateFrom !== "" || activeFilters.dateTo !== "" || activeFilters.activityType !== "";

  return (
    <main className="activities-page">
      <div className="activities-page-header">
        <h1>Activities</h1>
        <p>Track and manage your runs</p>
      </div>

      {/* Stats row */}
      <div className="activities-stats-row">
        <div className="activity-stat-card">
          <span className="activity-stat-value">{stats.totalKm.toFixed(1)}</span>
          <span className="activity-stat-label">Total km</span>
        </div>
        <div className="activity-stat-card">
          <span className="activity-stat-value">{stats.count}</span>
          <span className="activity-stat-label">Activities</span>
        </div>
        <div className="activity-stat-card">
          <span className="activity-stat-value">
            {stats.avgPaceSeconds !== null ? formatPaceShort(stats.avgPaceSeconds) : "—"}
          </span>
          <span className="activity-stat-label">Avg pace</span>
        </div>
        <div className="activity-stat-card">
          <span className="activity-stat-value">{stats.totalElevation}m</span>
          <span className="activity-stat-label">Elevation</span>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="activities-filter-row">
        <button
          type="button"
          className={`activities-filter-toggle${hasActiveFilters ? " active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Toggle filters"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {hasActiveFilters && <span className="filter-active-dot" />}
        </button>
        {isLoadingPage && <span className="activities-loading-inline">Loading…</span>}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <form
          className="activities-filter-panel"
          onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}
        >
          <label className="activities-filter-field">
            <span>From</span>
            <input
              type="date"
              value={filterDraft.dateFrom}
              onChange={(e) => setFilterDraft((p) => ({ ...p, dateFrom: e.target.value }))}
              disabled={isLoadingPage}
            />
          </label>
          <label className="activities-filter-field">
            <span>To</span>
            <input
              type="date"
              value={filterDraft.dateTo}
              onChange={(e) => setFilterDraft((p) => ({ ...p, dateTo: e.target.value }))}
              disabled={isLoadingPage}
            />
          </label>
          <label className="activities-filter-field">
            <span>Type</span>
            <select
              value={filterDraft.activityType}
              onChange={(e) => setFilterDraft((p) => ({ ...p, activityType: e.target.value }))}
              disabled={isLoadingPage}
            >
              <option value="">All types</option>
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <div className="activities-filter-actions">
            <button type="submit" className="button-primary" disabled={isLoadingPage}>
              Apply
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="button-secondary"
                onClick={handleResetFilters}
                disabled={isLoadingPage}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      )}

      {/* Activity list */}
      <div className="activity-list">
        {activities.length === 0 ? (
          <p className="activity-list-empty">No activities found.</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="activity-list-card">
              <div className="activity-list-card-header">
                <div className="activity-list-name-row">
                  <strong className="activity-list-name">{activity.name}</strong>
                  <span className="activity-list-date">{formatShortDate(activity.startDate)}</span>
                </div>
                <a
                  href={`https://www.strava.com/activities/${activity.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="activity-view-btn"
                >
                  View
                </a>
              </div>
              <div className="activity-list-card-meta">
                <span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                  {formatDistance(activity.distanceKm)}
                </span>
                <span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {formatDuration(activity.movingTimeSeconds)}
                </span>
                {activity.averagePaceSecondsPerKm !== null && (
                  <span>Pace: <strong>{formatPace(activity.averagePaceSecondsPerKm)}</strong></span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {(page > 1 || !isLastPage) && (
        <div className="activities-pagination">
          <button
            type="button"
            className="activities-pagination-btn"
            onClick={() => void loadActivities(page - 1, activeFilters)}
            disabled={page <= 1 || isLoadingPage}
          >
            ← Previous
          </button>
          <span className="activities-pagination-page">Page {page}</span>
          <button
            type="button"
            className="activities-pagination-btn"
            onClick={() => void loadActivities(page + 1, activeFilters)}
            disabled={isLastPage || isLoadingPage}
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}
