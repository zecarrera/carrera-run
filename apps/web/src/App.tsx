import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ActivitiesTable } from "./components/ActivitiesTable";
import { ActivityDetail } from "./components/ActivityDetail";
import { ActivityFilters, EMPTY_FILTERS } from "./components/ActivityFilters";
import type { Filters } from "./components/ActivityFilters";
import { Header } from "./components/Header";
import { SummaryCards } from "./components/SummaryCards";
import { UnderConstruction } from "./components/UnderConstruction";
import { formatDate, formatDistance } from "./lib/format";
import type { Activity, AthleteSummary } from "./types";
import "./styles.css";

const PER_PAGE = 30;
type LoadState = "idle" | "loading" | "ready" | "error";

export default function App() {
  const [summary, setSummary] = useState<AthleteSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | undefined>();
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Filters>(EMPTY_FILTERS);

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
      setSelectedActivity(payload.activities[0]);
      setIsLastPage(payload.activities.length < PER_PAGE);
      setPage(nextPage);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const handleApplyFilters = useCallback(
    (filters: Filters) => {
      setActiveFilters(filters);
      void loadActivities(1, filters);
    },
    [loadActivities],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setState("loading");
        setErrorMessage(null);

        const [summaryResponse, activitiesResponse] = await Promise.all([
          fetch("/api/athlete/summary", { credentials: "include" }),
          fetch(`/api/activities?page=1&perPage=${PER_PAGE}`, { credentials: "include" }),
        ]);

        if (summaryResponse.status === 401 || activitiesResponse.status === 401) {
          setState("idle");
          return;
        }

        if (!summaryResponse.ok || !activitiesResponse.ok) {
          throw new Error("Unable to load Strava data.");
        }

        const summaryPayload = (await summaryResponse.json()) as { summary: AthleteSummary };
        const activitiesPayload = (await activitiesResponse.json()) as { activities: Activity[] };

        setSummary(summaryPayload.summary);
        setActivities(activitiesPayload.activities);
        setSelectedActivity(activitiesPayload.activities[0]);
        setIsLastPage(activitiesPayload.activities.length < PER_PAGE);
        setState("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load data.");
        setState("error");
      }
    };

    void load();
  }, []);

  if (state === "idle") {
    return (
      <main className="shell auth-shell">
        <section className="hero-card">
          <img src="/logo.png" alt="Carrera Run logo" className="hero-logo" />
          <p className="eyebrow">Strava dashboard</p>
          <h1>Connect your runs and review every session in one place.</h1>
          <p>
            Sign in with Strava to load your running history, totals, and recent activity details.
          </p>
          <a className="button-primary" href="/api/auth/strava/login">
            Connect with Strava
          </a>
        </section>
      </main>
    );
  }

  if (state === "loading") {
    return (
      <main className="shell centered-state">
        <p>Loading your activities...</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="shell centered-state">
        <p>{errorMessage}</p>
        <a className="button-secondary" href="/api/auth/strava/login">
          Retry with Strava
        </a>
      </main>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route
          path="/"
          element={
            <main className="shell dashboard-shell">
              <section className="hero-card compact">
                <div>
                  <p className="eyebrow">Welcome back</p>
                  <h1>{summary.athlete.displayName}</h1>
                  <p>
                    {summary.recentRun
                      ? `Last run: ${summary.recentRun.name} on ${formatDate(summary.recentRun.startDate)} for ${formatDistance(summary.recentRun.distanceKm)}.`
                      : "Your runs will appear here once Strava returns activity data."}
                  </p>
                </div>
              </section>

              <SummaryCards summary={summary} />

              <ActivityFilters
                activeFilters={activeFilters}
                onApply={handleApplyFilters}
                disabled={isLoadingPage}
              />

              <section className="content-grid">
                <ActivitiesTable
                  activities={activities}
                  selectedActivityId={selectedActivity?.id}
                  onSelect={setSelectedActivity}
                  page={page}
                  isLastPage={isLastPage}
                  isLoadingPage={isLoadingPage}
                  onPrevPage={() => void loadActivities(page - 1, activeFilters)}
                  onNextPage={() => void loadActivities(page + 1, activeFilters)}
                />
                <ActivityDetail activity={selectedActivity} />
              </section>
            </main>
          }
        />
        <Route path="/planning" element={<UnderConstruction />} />
        <Route path="/profile" element={<UnderConstruction />} />
      </Routes>
    </BrowserRouter>
  );
}
