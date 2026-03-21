import { useCallback, useEffect, useState } from "react";
import { ActivitiesTable } from "./ActivitiesTable";
import { ActivityDetail } from "./ActivityDetail";
import { ActivityFilters, EMPTY_FILTERS } from "./ActivityFilters";
import type { Filters } from "./ActivityFilters";
import type { Activity } from "../types";

const PER_PAGE = 30;
type LoadState = "loading" | "ready" | "error";

export function ActivitiesPage() {
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
        const response = await fetch(`/api/activities?page=1&perPage=${PER_PAGE}`, { credentials: "include" });
        if (!response.ok) throw new Error("Unable to fetch activities.");
        const payload = (await response.json()) as { activities: Activity[] };
        setActivities(payload.activities);
        setSelectedActivity(payload.activities[0]);
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
      <main className="shell centered-state">
        <p>Loading your activities...</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="shell centered-state">
        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell">
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
  );
}
