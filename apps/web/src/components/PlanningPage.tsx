import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatDate, formatDistance } from "../lib/format";
import type { ActivityStatus, PlanActivity, PlanActivityType, TrainingPlan } from "../types";
import { CoachPlanWizard } from "./CoachPlanWizard";

type CreatePlanForm = {
  raceName: string;
  raceDistanceKm: string;
  startDate: string;
  endDate: string;
};

type CreateActivityForm = {
  date: string;
  type: PlanActivityType;
  distanceKm: string;
  paceMinPerKm: string;
  durationMinutes: string;
  notes: string;
};

type ActivityUpdateDraft = {
  status: ActivityStatus;
  comment: string;
};

const EMPTY_PLAN_FORM: CreatePlanForm = {
  raceName: "",
  raceDistanceKm: "",
  startDate: "",
  endDate: "",
};

const EMPTY_ACTIVITY_FORM: CreateActivityForm = {
  date: "",
  type: "Run",
  distanceKm: "",
  paceMinPerKm: "",
  durationMinutes: "",
  notes: "",
};

const STATUS_OPTIONS: ActivityStatus[] = ["not_started", "completed", "completed_with_changes", "skipped"];

const STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not started",
  completed: "Completed",
  completed_with_changes: "Completed with changes",
  skipped: "Skipped",
};

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

function sortPlans(plans: TrainingPlan[]) {
  return [...plans].sort((first, second) => {
    const statusOrder = { active: 0, upcoming: 1, completed: 2 } as const;
    const statusDelta = statusOrder[first.status] - statusOrder[second.status];

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return second.startDate.localeCompare(first.startDate);
  });
}

export function PlanningPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [showCoachWizard, setShowCoachWizard] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingActivityId, setIsUpdatingActivityId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<CreatePlanForm>(EMPTY_PLAN_FORM);
  const [activityForm, setActivityForm] = useState<CreateActivityForm>(EMPTY_ACTIVITY_FORM);
  const [activityDrafts, setActivityDrafts] = useState<Record<string, ActivityUpdateDraft>>({});
  const importFileRef = useRef<HTMLInputElement>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const loadPlans = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await apiRequest<{ plans: TrainingPlan[] }>("/api/plans");
      const sortedPlans = sortPlans(payload.plans);
      setPlans(sortedPlans);

      if (!sortedPlans.length) {
        setSelectedPlanId(null);
      } else {
        setSelectedPlanId((current) => {
          if (current && sortedPlans.some((plan) => plan.id === current)) {
            return current;
          }
          return sortedPlans[0].id;
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load planning data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const handleCoachPlanCreated = (plan: TrainingPlan) => {
    const updatedPlans = sortPlans([plan, ...plans]);
    setPlans(updatedPlans);
    setSelectedPlanId(plan.id);
    setShowCoachWizard(false);
    setSuccessMessage("Training plan created by coach.");
  };

  const handleImportPlan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setErrorMessage("Could not read file. Make sure it is a valid JSON file.");
      setIsImporting(false);
      return;
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("raceName" in parsed) ||
      !("startDate" in parsed) ||
      !("endDate" in parsed) ||
      !("activities" in parsed)
    ) {
      setErrorMessage(
        'Invalid import file. Expected JSON with "raceName", "raceDistanceKm", "startDate", "endDate", and "activities".',
      );
      setIsImporting(false);
      return;
    }

    try {
      const payload = await apiRequest<{ plan: TrainingPlan }>("/api/plans/import", {
        method: "POST",
        body: JSON.stringify(parsed),
      });

      const updatedPlans = sortPlans([payload.plan, ...plans]);
      setPlans(updatedPlans);
      setSelectedPlanId(payload.plan.id);
      setSuccessMessage(`Plan "${payload.plan.raceName}" imported successfully.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import plan.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingPlan(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = await apiRequest<{ plan: TrainingPlan }>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          raceName: planForm.raceName.trim(),
          raceDistanceKm: Number(planForm.raceDistanceKm),
          startDate: planForm.startDate,
          endDate: planForm.endDate,
        }),
      });

      const updatedPlans = sortPlans([payload.plan, ...plans]);
      setPlans(updatedPlans);
      setSelectedPlanId(payload.plan.id);
      setPlanForm(EMPTY_PLAN_FORM);
      setSuccessMessage("Training plan created.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create plan.");
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleAddActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPlan) {
      return;
    }

    setIsSubmittingActivity(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body: Record<string, string | number> = {
        date: activityForm.date,
        type: activityForm.type,
      };

      if (activityForm.notes.trim()) {
        body.notes = activityForm.notes.trim();
      }

      if (activityForm.type === "Run") {
        body.distanceKm = Number(activityForm.distanceKm);
        body.paceMinPerKm = Number(activityForm.paceMinPerKm);
      } else {
        body.durationMinutes = Number(activityForm.durationMinutes);
      }

      const payload = await apiRequest<{ plan: TrainingPlan }>(`/api/plans/${selectedPlan.id}/activities`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setPlans((current) =>
        sortPlans(current.map((plan) => (plan.id === payload.plan.id ? payload.plan : plan))),
      );
      setActivityForm(EMPTY_ACTIVITY_FORM);
      setSuccessMessage("Activity added to plan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add activity.");
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  const handleActivityDraftChange = (
    activity: PlanActivity,
    patch: Partial<ActivityUpdateDraft>,
  ) => {
    setActivityDrafts((current) => ({
      ...current,
      [activity.id]: {
        status: patch.status ?? current[activity.id]?.status ?? activity.status,
        comment: patch.comment ?? current[activity.id]?.comment ?? activity.comment ?? "",
      },
    }));
  };

  const handleActivityStatusSave = async (activity: PlanActivity) => {
    if (!selectedPlan) {
      return;
    }

    const draft = activityDrafts[activity.id] ?? {
      status: activity.status,
      comment: activity.comment ?? "",
    };

    setIsUpdatingActivityId(activity.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = await apiRequest<{ plan: TrainingPlan }>(
        `/api/plans/${selectedPlan.id}/activities/${activity.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: draft.status,
            comment: draft.comment,
          }),
        },
      );

      setPlans((current) =>
        sortPlans(current.map((plan) => (plan.id === payload.plan.id ? payload.plan : plan))),
      );

      setActivityDrafts((current) => {
        const next = { ...current };
        delete next[activity.id];
        return next;
      });
      setSuccessMessage("Activity updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update activity.");
    } finally {
      setIsUpdatingActivityId(null);
    }
  };

  if (isLoading) {
    return (
      <main className="shell centered-state">
        <p>Loading planning data...</p>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell planning-shell">
      <section className="hero-card compact">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Build your training plan.</h1>
          <p>Create a race-focused plan, then track each activity as not started, completed, changed, or skipped.</p>
        </div>
      </section>

      <section className="planning-grid">
        <section className="panel planning-form-panel">
          <div className="panel-header">
            <h2>Create plan</h2>
            <div className="panel-header-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? "Importing…" : "⬆ Import JSON"}
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleImportPlan}
                aria-label="Import plan from JSON file"
              />
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowCoachWizard((v) => !v)}
              >
                {showCoachWizard ? "Manual form" : "🤖 Build with Coach"}
              </button>
            </div>
          </div>

          {showCoachWizard ? (
            <CoachPlanWizard
              onPlanCreated={handleCoachPlanCreated}
              onClose={() => setShowCoachWizard(false)}
            />
          ) : (
          <form className="planning-form" onSubmit={handleCreatePlan}>
            <label className="filter-field">
              Race name
              <input
                required
                value={planForm.raceName}
                onChange={(event) => setPlanForm((current) => ({ ...current, raceName: event.target.value }))}
              />
            </label>
            <label className="filter-field">
              Race distance (km)
              <input
                required
                type="number"
                min="0.1"
                step="0.1"
                value={planForm.raceDistanceKm}
                onChange={(event) => setPlanForm((current) => ({ ...current, raceDistanceKm: event.target.value }))}
              />
            </label>
            <label className="filter-field">
              Start date
              <input
                required
                type="date"
                value={planForm.startDate}
                onChange={(event) => setPlanForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label className="filter-field">
              Race date (end date)
              <input
                required
                type="date"
                value={planForm.endDate}
                onChange={(event) => setPlanForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
            <button className="button-primary" type="submit" disabled={isSubmittingPlan}>
              {isSubmittingPlan ? "Creating..." : "Create plan"}
            </button>
          </form>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Plans</h2>
          </div>
          {!plans.length ? (
            <p className="subtle">No training plans yet. Create your first one.</p>
          ) : (
            <ul className="plan-list">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    className={`plan-list-item${plan.id === selectedPlanId ? " active" : ""}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div>
                      <strong>{plan.raceName}</strong>
                      <p>
                        {formatDistance(plan.raceDistanceKm)} • {formatDate(plan.startDate)} to {formatDate(plan.endDate)}
                      </p>
                    </div>
                    <span className={`status-pill ${plan.status}`}>{plan.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {selectedPlan && (
        <>
          <section className="panel planning-form-panel">
            <div className="panel-header">
              <h2>Add activity to {selectedPlan.raceName}</h2>
            </div>
            <form className="planning-form planning-form-wide" onSubmit={handleAddActivity}>
              <label className="filter-field">
                Date
                <input
                  required
                  type="date"
                  value={activityForm.date}
                  onChange={(event) => setActivityForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>

              <label className="filter-field">
                Type
                <select
                  value={activityForm.type}
                  onChange={(event) =>
                    setActivityForm((current) => ({
                      ...current,
                      type: event.target.value as PlanActivityType,
                    }))
                  }
                >
                  <option value="Run">Run</option>
                  <option value="Strength">Strength</option>
                  <option value="Flexibility">Flexibility</option>
                </select>
              </label>

              {activityForm.type === "Run" ? (
                <>
                  <label className="filter-field">
                    Distance (km)
                    <input
                      required
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={activityForm.distanceKm}
                      onChange={(event) =>
                        setActivityForm((current) => ({ ...current, distanceKm: event.target.value }))
                      }
                    />
                  </label>

                  <label className="filter-field">
                    Pace (min/km)
                    <input
                      required
                      type="number"
                      min="0.1"
                      step="0.01"
                      value={activityForm.paceMinPerKm}
                      onChange={(event) =>
                        setActivityForm((current) => ({ ...current, paceMinPerKm: event.target.value }))
                      }
                    />
                  </label>
                </>
              ) : (
                <label className="filter-field">
                  Duration (minutes)
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={activityForm.durationMinutes}
                    onChange={(event) =>
                      setActivityForm((current) => ({ ...current, durationMinutes: event.target.value }))
                    }
                  />
                </label>
              )}

              <label className="filter-field">
                Notes (optional)
                <input
                  value={activityForm.notes}
                  onChange={(event) => setActivityForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <button className="button-primary" type="submit" disabled={isSubmittingActivity}>
                {isSubmittingActivity ? "Adding..." : "Add activity"}
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Activities ({selectedPlan.activities.length})</h2>
              <p className="subtle">Race day: {formatDate(selectedPlan.endDate)}</p>
            </div>

            {!selectedPlan.activities.length ? (
              <p className="subtle">No activities in this plan yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Status</th>
                      <th>Comment</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedPlan.activities]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((activity) => {
                        const draft = activityDrafts[activity.id] ?? {
                          status: activity.status,
                          comment: activity.comment ?? "",
                        };

                        return (
                          <tr key={activity.id}>
                            <td>{formatDate(activity.date)}</td>
                            <td>{activity.type}</td>
                            <td>
                              {activity.type === "Run"
                                ? `${activity.distanceKm?.toFixed(1) ?? "-"} km • ${activity.paceMinPerKm?.toFixed(2) ?? "-"} min/km`
                                : `${activity.durationMinutes ?? "-"} min`}
                            </td>
                            <td>
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  handleActivityDraftChange(activity, {
                                    status: event.target.value as ActivityStatus,
                                  })
                                }
                              >
                                {STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={draft.comment}
                                placeholder={
                                  draft.status === "completed_with_changes"
                                    ? "Required when completed with changes"
                                    : "Optional"
                                }
                                onChange={(event) =>
                                  handleActivityDraftChange(activity, { comment: event.target.value })
                                }
                              />
                            </td>
                            <td>
                              <button
                                className="button-secondary planning-action-btn"
                                type="button"
                                disabled={isUpdatingActivityId === activity.id}
                                onClick={() => void handleActivityStatusSave(activity)}
                              >
                                {isUpdatingActivityId === activity.id ? "Saving..." : "Save"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {(errorMessage || successMessage) && (
        <section className="panel planning-feedback">
          {errorMessage && <p className="planning-error">{errorMessage}</p>}
          {successMessage && <p className="planning-success">{successMessage}</p>}
        </section>
      )}
    </main>
  );
}
