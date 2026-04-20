import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { formatDate, formatDistance } from "../lib/format";
import type { ActivityStatus, PlanActivity, PlanActivityType, TrainingPlan } from "../types";
import { CoachPlanWizard } from "./CoachPlanWizard";

// ---- Types ----

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

type WeekInfo = {
  weekNum: number;
  startDate: string;
  endDate: string;
  activities: PlanActivity[];
  isCurrent: boolean;
};

type CalendarCell = {
  date: string | null;
  day: number | null;
  isToday: boolean;
  hasActivities: boolean;
};

// ---- Constants ----

const EMPTY_PLAN_FORM: CreatePlanForm = { raceName: "", raceDistanceKm: "", startDate: "", endDate: "" };

const EMPTY_ACTIVITY_FORM: CreateActivityForm = {
  date: "", type: "Run", distanceKm: "", paceMinPerKm: "", durationMinutes: "", notes: "",
};

const STATUS_OPTIONS: ActivityStatus[] = ["not_started", "completed", "completed_with_changes", "skipped"];

const STATUS_LABELS: Record<ActivityStatus, string> = {
  not_started: "Not started",
  completed: "Completed",
  completed_with_changes: "Completed with changes",
  skipped: "Skipped",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ---- API ----

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? "Request failed.");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---- Helpers ----

function sortPlans(plans: TrainingPlan[]) {
  return [...plans].sort((a, b) => {
    const order = { active: 0, upcoming: 1, completed: 2 } as const;
    const delta = order[a.status] - order[b.status];
    return delta !== 0 ? delta : b.startDate.localeCompare(a.startDate);
  });
}

function getPlanProgress(plan: TrainingPlan) {
  const start = new Date(plan.startDate + "T12:00:00");
  const end = new Date(plan.endDate + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const elapsedDays = Math.round((today.getTime() - start.getTime()) / 86400000);
  const currentWeek = Math.max(1, Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1));
  const pct = Math.min(100, Math.round((currentWeek / totalWeeks) * 100));
  return { currentWeek, totalWeeks, pct };
}

function getPlanWeeks(plan: TrainingPlan): WeekInfo[] {
  const planStart = new Date(plan.startDate + "T12:00:00");
  const planEnd = new Date(plan.endDate + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weeks: WeekInfo[] = [];

  // Snap the first week start back to the preceding Sunday (getDay() === 0)
  const weekStart = new Date(planStart);
  weekStart.setDate(planStart.getDate() - planStart.getDay());

  let weekNum = 1;
  while (weekStart <= planEnd) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday
    const wsStr = weekStart.toISOString().slice(0, 10);
    const weStr = weekEnd.toISOString().slice(0, 10);
    const weekActivities = plan.activities.filter((a) => a.date >= wsStr && a.date <= weStr);
    const isCurrent = today >= weekStart && today <= weekEnd;
    weeks.push({ weekNum, startDate: wsStr, endDate: weStr, activities: weekActivities, isCurrent });
    weekStart.setDate(weekStart.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

function getDaysInWeek(week: WeekInfo) {
  const start = new Date(week.startDate + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    return { dateStr, dayName: DAY_NAMES[d.getDay()], activity: week.activities.find((a) => a.date === dateStr) ?? null };
  });
}

function getCalendarCells(year: number, month: number, activities: PlanActivity[]): CalendarCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const activityDates = new Set(activities.map((a) => a.date));
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ date: null, day: null, isToday: false, hasActivities: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d, isToday: dateStr === todayStr, hasActivities: activityDates.has(dateStr) });
  }
  return cells;
}

function getActivityMeta(activity: PlanActivity): string {
  if (activity.type === "Run") {
    const parts: string[] = [];
    if (activity.distanceKm) parts.push(`${activity.distanceKm} km`);
    if (activity.paceMinPerKm) parts.push(`${activity.paceMinPerKm} min/km`);
    return parts.join(" · ");
  }
  if (activity.durationMinutes) return `${activity.durationMinutes} min`;
  return "";
}

// ---- Icons ----

function ArrowLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function DistanceIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ---- Main Component ----

export function PlanningPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Modals / panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCoachWizard, setShowCoachWizard] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  // Forms
  const [planForm, setPlanForm] = useState<CreatePlanForm>(EMPTY_PLAN_FORM);
  const [activityForm, setActivityForm] = useState<CreateActivityForm>(EMPTY_ACTIVITY_FORM);
  const [activityDrafts, setActivityDrafts] = useState<Record<string, ActivityUpdateDraft>>({});

  // Loading states
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [isDeletingPlanId, setIsDeletingPlanId] = useState<string | null>(null);
  const [isUpdatingActivityId, setIsUpdatingActivityId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // UI state
  const [loggingActivityId, setLoggingActivityId] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const expandedInitRef = useRef<string | null>(null);

  // Auto-expand current week when a plan is first opened
  useEffect(() => {
    if (expandedInitRef.current === selectedPlanId) return;
    expandedInitRef.current = selectedPlanId;
    if (!selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    const weeks = getPlanWeeks(plan);
    const current = weeks.find((w) => w.isCurrent);
    setExpandedWeeks(new Set(current ? [current.weekNum] : weeks.length ? [1] : []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId, plans]);

  const loadPlans = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await apiRequest<{ plans: TrainingPlan[] }>("/api/plans");
      setPlans(sortPlans(payload.plans));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load planning data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadPlans(); }, []);

  const handleCoachPlanCreated = (plan: TrainingPlan) => {
    setPlans((cur) => sortPlans([plan, ...cur]));
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
      parsed = JSON.parse(await file.text());
    } catch {
      setErrorMessage("Could not read file. Make sure it is a valid JSON file.");
      setIsImporting(false);
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("raceName" in parsed) || !("startDate" in parsed) || !("endDate" in parsed) || !("activities" in parsed)) {
      setErrorMessage('Invalid import file. Expected JSON with "raceName", "raceDistanceKm", "startDate", "endDate", and "activities".');
      setIsImporting(false);
      return;
    }
    try {
      const payload = await apiRequest<{ plan: TrainingPlan }>("/api/plans/import", { method: "POST", body: JSON.stringify(parsed) });
      setPlans((cur) => sortPlans([payload.plan, ...cur]));
      setSelectedPlanId(payload.plan.id);
      setSuccessMessage(`Plan "${payload.plan.raceName}" imported successfully.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import plan.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeletePlan = async (plan: TrainingPlan) => {
    if (!window.confirm(`Delete "${plan.raceName}"? This cannot be undone.`)) return;
    setIsDeletingPlanId(plan.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiRequest<void>(`/api/plans/${plan.id}`, { method: "DELETE" });
      setPlans((cur) => sortPlans(cur.filter((p) => p.id !== plan.id)));
      setSelectedPlanId(null);
      setSuccessMessage(`Plan "${plan.raceName}" deleted.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete plan.");
    } finally {
      setIsDeletingPlanId(null);
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
        body: JSON.stringify({ raceName: planForm.raceName.trim(), raceDistanceKm: Number(planForm.raceDistanceKm), startDate: planForm.startDate, endDate: planForm.endDate }),
      });
      setPlans((cur) => sortPlans([payload.plan, ...cur]));
      setSelectedPlanId(payload.plan.id);
      setPlanForm(EMPTY_PLAN_FORM);
      setShowCreateModal(false);
      setSuccessMessage("Training plan created.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create plan.");
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleAddActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlanId) return;
    setIsSubmittingActivity(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const body: Record<string, string | number> = { date: activityForm.date, type: activityForm.type };
      if (activityForm.notes.trim()) body.notes = activityForm.notes.trim();
      if (activityForm.type === "Run") {
        body.distanceKm = Number(activityForm.distanceKm);
        body.paceMinPerKm = Number(activityForm.paceMinPerKm);
      } else {
        body.durationMinutes = Number(activityForm.durationMinutes);
      }
      const payload = await apiRequest<{ plan: TrainingPlan }>(`/api/plans/${selectedPlanId}/activities`, { method: "POST", body: JSON.stringify(body) });
      setPlans((cur) => sortPlans(cur.map((p) => (p.id === payload.plan.id ? payload.plan : p))));
      setActivityForm(EMPTY_ACTIVITY_FORM);
      setShowAddActivity(false);
      setSuccessMessage("Activity added to plan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add activity.");
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  const handleActivityDraftChange = (activity: PlanActivity, patch: Partial<ActivityUpdateDraft>) => {
    setActivityDrafts((cur) => ({
      ...cur,
      [activity.id]: {
        status: patch.status ?? cur[activity.id]?.status ?? activity.status,
        comment: patch.comment ?? cur[activity.id]?.comment ?? activity.comment ?? "",
      },
    }));
  };

  const handleActivityStatusSave = async (activity: PlanActivity) => {
    if (!selectedPlanId) return;
    const draft = activityDrafts[activity.id] ?? { status: activity.status, comment: activity.comment ?? "" };
    setIsUpdatingActivityId(activity.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = await apiRequest<{ plan: TrainingPlan }>(
        `/api/plans/${selectedPlanId}/activities/${activity.id}`,
        { method: "PATCH", body: JSON.stringify({ status: draft.status, comment: draft.comment }) },
      );
      setPlans((cur) => sortPlans(cur.map((p) => (p.id === payload.plan.id ? payload.plan : p))));
      setActivityDrafts((cur) => { const next = { ...cur }; delete next[activity.id]; return next; });
      setLoggingActivityId(null);
      setSuccessMessage("Activity updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update activity.");
    } finally {
      setIsUpdatingActivityId(null);
    }
  };

  const toggleWeek = (weekNum: number) =>
    setExpandedWeeks((cur) => { const next = new Set(cur); next.has(weekNum) ? next.delete(weekNum) : next.add(weekNum); return next; });

  const prevCalendarMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1); }
    else setCalendarMonth((m) => m - 1);
  };
  const nextCalendarMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1); }
    else setCalendarMonth((m) => m + 1);
  };

  if (isLoading) {
    return <main className="shell centered-state"><p>Loading planning data...</p></main>;
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const activePlans = plans.filter((p) => p.status === "active");
  const upcomingPlans = plans.filter((p) => p.status === "upcoming");
  const completedPlans = plans.filter((p) => p.status === "completed");

  const createPlanModal = showCreateModal && (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2 className="modal-title">Create Training Plan</h2>
          <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>&#x2715;</button>
        </div>
        <form className="modal-form" onSubmit={handleCreatePlan}>
          <label>Race name<input required value={planForm.raceName} onChange={(e) => setPlanForm((c) => ({ ...c, raceName: e.target.value }))} /></label>
          <label>Race distance (km)<input required type="number" min="0.1" step="0.1" value={planForm.raceDistanceKm} onChange={(e) => setPlanForm((c) => ({ ...c, raceDistanceKm: e.target.value }))} /></label>
          <label>Start date<input required type="date" value={planForm.startDate} onChange={(e) => setPlanForm((c) => ({ ...c, startDate: e.target.value }))} /></label>
          <label>Race date (end date)<input required type="date" value={planForm.endDate} onChange={(e) => setPlanForm((c) => ({ ...c, endDate: e.target.value }))} /></label>
          {errorMessage && <p className="modal-error">{errorMessage}</p>}
          <div className="modal-form-actions">
            <button type="button" className="plans-action-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button type="submit" className="plans-action-btn primary" disabled={isSubmittingPlan}>{isSubmittingPlan ? "Creating..." : "Create Plan"}</button>
          </div>
        </form>
      </div>
    </div>
  );

  const coachWizardModal = showCoachWizard && (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCoachWizard(false); }}>
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <h2 className="modal-title">Build with Coach</h2>
          <button type="button" className="modal-close-btn" onClick={() => setShowCoachWizard(false)}>&#x2715;</button>
        </div>
        <CoachPlanWizard onPlanCreated={handleCoachPlanCreated} onClose={() => setShowCoachWizard(false)} />
      </div>
    </div>
  );

  // LIST VIEW
  if (!selectedPlan) {
    return (
      <main className="plans-page">
        <div className="plans-list-header">
          <div>
            <h1 className="plans-list-title">Training Plans</h1>
            <p className="plans-subtitle">Manage your training schedules</p>
          </div>
          <div className="plans-header-actions">
            <button type="button" className="plans-action-btn" onClick={() => importFileRef.current?.click()} disabled={isImporting}>
              <UploadIcon />{isImporting ? "Importing..." : "Import Plan"}
            </button>
            <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImportPlan} aria-label="Import plan from JSON file" />
            <button type="button" className="plans-action-btn" onClick={() => setShowCoachWizard(true)}><SparklesIcon />Build with Coach</button>
            <button type="button" className="plans-action-btn primary" onClick={() => setShowCreateModal(true)}><PlusIcon />Create Plan</button>
          </div>
        </div>

        {errorMessage && <p className="plans-feedback error">{errorMessage}</p>}
        {successMessage && <p className="plans-feedback success">{successMessage}</p>}

        {!plans.length && (
          <div className="plans-empty-state">
            <p>No training plans yet. Create your first one to get started.</p>
          </div>
        )}

        {activePlans.length > 0 && (
          <section className="plans-section">
            <h2 className="plans-section-title">Active Plans</h2>
            <div className="plan-card-grid">
              {activePlans.map((plan) => {
                const { currentWeek, totalWeeks, pct } = getPlanProgress(plan);
                return (
                  <div key={plan.id} className="plan-card" role="button" tabIndex={0}
                    onClick={() => setSelectedPlanId(plan.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedPlanId(plan.id)}>
                    <div className="plan-card-header">
                      <div><h3 className="plan-card-name">{plan.raceName}</h3><p className="plan-card-subtitle">{formatDistance(plan.raceDistanceKm)}</p></div>
                      <span className="plan-status-badge active">Active</span>
                    </div>
                    <div className="plan-card-progress-label"><span>Progress</span><span>Week {currentWeek} of {totalWeeks}</span></div>
                    <div className="plan-card-progress-bar"><div className="plan-card-progress-fill" style={{ width: `${pct}%` }} /></div>
                    <div className="plan-card-meta"><span><CalendarIcon /> {plan.startDate}</span><span><DistanceIcon /> {plan.raceDistanceKm} km</span></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {upcomingPlans.length > 0 && (
          <section className="plans-section">
            <h2 className="plans-section-title">Upcoming Plans</h2>
            <div className="plan-card-grid">
              {upcomingPlans.map((plan) => (
                <div key={plan.id} className="plan-card" role="button" tabIndex={0}
                  onClick={() => setSelectedPlanId(plan.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedPlanId(plan.id)}>
                  <div className="plan-card-header">
                    <div><h3 className="plan-card-name">{plan.raceName}</h3><p className="plan-card-subtitle">{formatDistance(plan.raceDistanceKm)}</p></div>
                    <span className="plan-status-badge upcoming">Upcoming</span>
                  </div>
                  <div className="plan-card-meta"><span><CalendarIcon /> {plan.startDate}</span><span><DistanceIcon /> {plan.raceDistanceKm} km</span></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {completedPlans.length > 0 && (
          <section className="plans-section">
            <h2 className="plans-section-title">Completed Plans</h2>
            <div className="plan-card-grid">
              {completedPlans.map((plan) => {
                const { totalWeeks } = getPlanProgress(plan);
                return (
                  <div key={plan.id} className="plan-card" role="button" tabIndex={0}
                    onClick={() => setSelectedPlanId(plan.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedPlanId(plan.id)}>
                    <div className="plan-card-header">
                      <div><h3 className="plan-card-name">{plan.raceName}</h3><p className="plan-card-subtitle">{formatDistance(plan.raceDistanceKm)}</p></div>
                      <span className="plan-status-badge completed">Completed</span>
                    </div>
                    <div className="plan-card-meta"><span><CalendarIcon /> {plan.startDate}</span><span><ClockIcon /> {totalWeeks} weeks</span></div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {createPlanModal}
        {coachWizardModal}
      </main>
    );
  }

  // DETAIL VIEW
  const { currentWeek, totalWeeks, pct } = getPlanProgress(selectedPlan);
  const weeks = getPlanWeeks(selectedPlan);
  const calendarCells = getCalendarCells(calendarYear, calendarMonth, selectedPlan.activities);
  const selectedDateActivities = selectedCalendarDate
    ? selectedPlan.activities.filter((a) => a.date === selectedCalendarDate)
    : [];

  return (
    <main className="plans-page">
      <div className="plan-detail-header">
        <button type="button" className="plan-detail-back" onClick={() => { setSelectedPlanId(null); setSelectedCalendarDate(null); }}>
          <ArrowLeftIcon />
        </button>
        <div className="plan-detail-title-wrap">
          <div className="plan-detail-title-row">
            <h1 className="plan-detail-title">{selectedPlan.raceName}</h1>
            <span className={`plan-status-badge ${selectedPlan.status}`}>{selectedPlan.status}</span>
          </div>
          <p className="plan-detail-subtitle">{formatDistance(selectedPlan.raceDistanceKm)} race &middot; {formatDate(selectedPlan.endDate)}</p>
        </div>
        <div className="plan-detail-icon-actions">
          <button type="button" className="plan-icon-btn" title="Add activity" onClick={() => setShowAddActivity((v) => !v)}>
            <EditIcon />
          </button>
          <button type="button" className="plan-icon-btn danger" title="Delete plan"
            aria-label={`Delete ${selectedPlan.raceName}`}
            disabled={isDeletingPlanId === selectedPlan.id} onClick={() => void handleDeletePlan(selectedPlan)}>
            <TrashIcon />
          </button>
        </div>
      </div>

      {errorMessage && <p className="plans-feedback error">{errorMessage}</p>}
      {successMessage && <p className="plans-feedback success">{successMessage}</p>}

      {showAddActivity && (
        <div className="add-activity-section">
          <h3 className="add-activity-title">Add Activity to {selectedPlan.raceName}</h3>
          <form className="add-activity-form" onSubmit={handleAddActivity}>
            <label className="add-activity-field">Date<input required type="date" value={activityForm.date} onChange={(e) => setActivityForm((c) => ({ ...c, date: e.target.value }))} /></label>
            <label className="add-activity-field">Type
              <select value={activityForm.type} onChange={(e) => setActivityForm((c) => ({ ...c, type: e.target.value as PlanActivityType }))}>
                <option value="Run">Run</option>
                <option value="Strength">Strength</option>
                <option value="Flexibility">Flexibility</option>
              </select>
            </label>
            {activityForm.type === "Run" ? (
              <>
                <label className="add-activity-field">Distance (km)<input required type="number" min="0.1" step="0.1" value={activityForm.distanceKm} onChange={(e) => setActivityForm((c) => ({ ...c, distanceKm: e.target.value }))} /></label>
                <label className="add-activity-field">Pace (min/km)<input required type="number" min="0.1" step="0.01" value={activityForm.paceMinPerKm} onChange={(e) => setActivityForm((c) => ({ ...c, paceMinPerKm: e.target.value }))} /></label>
              </>
            ) : (
              <label className="add-activity-field">Duration (min)<input required type="number" min="1" value={activityForm.durationMinutes} onChange={(e) => setActivityForm((c) => ({ ...c, durationMinutes: e.target.value }))} /></label>
            )}
            <label className="add-activity-field">Notes<input value={activityForm.notes} placeholder="Optional" onChange={(e) => setActivityForm((c) => ({ ...c, notes: e.target.value }))} /></label>
            <div className="add-activity-actions">
              <button type="submit" className="plans-action-btn primary" disabled={isSubmittingActivity}>{isSubmittingActivity ? "Adding..." : "Add Activity"}</button>
              <button type="button" className="plans-action-btn" onClick={() => setShowAddActivity(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="plan-progress-section">
        <h3>Progress</h3>
        <div className="plan-progress-week-row">
          <span>Week {currentWeek} of {totalWeeks}</span>
          <span className="plan-progress-pct">{pct}%</span>
        </div>
        <div className="plan-progress-bar-track">
          <div className="plan-progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="plan-progress-meta-grid">
          <div className="plan-progress-meta-item"><span className="plan-progress-meta-label">Start Date</span><strong className="plan-progress-meta-value">{formatDate(selectedPlan.startDate)}</strong></div>
          <div className="plan-progress-meta-item"><span className="plan-progress-meta-label">End Date</span><strong className="plan-progress-meta-value">{formatDate(selectedPlan.endDate)}</strong></div>
          <div className="plan-progress-meta-item"><span className="plan-progress-meta-label">Goal Distance</span><strong className="plan-progress-meta-value">{selectedPlan.raceDistanceKm} km</strong></div>
          <div className="plan-progress-meta-item"><span className="plan-progress-meta-label">Duration</span><strong className="plan-progress-meta-value">{totalWeeks} weeks</strong></div>
        </div>
      </div>

      <div className="plan-detail-layout">
        <div className="plan-calendar-section">
          <h3>Calendar</h3>
          <div className="mini-calendar">
            <div className="mini-calendar-nav">
              <button type="button" className="mini-calendar-nav-btn" onClick={prevCalendarMonth}>&#8249;</button>
              <span className="mini-calendar-month-label">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
              <button type="button" className="mini-calendar-nav-btn" onClick={nextCalendarMonth}>&#8250;</button>
            </div>
            <div className="mini-calendar-grid">
              {DAY_SHORT.map((d) => <div key={d} className="mini-calendar-day-header">{d}</div>)}
              {calendarCells.map((cell, i) =>
                cell.day === null ? (
                  <div key={`e-${i}`} />
                ) : (
                  <button key={cell.date} type="button"
                    className={["mini-calendar-day", cell.isToday ? "today" : "", cell.date === selectedCalendarDate ? "selected" : "", cell.hasActivities ? "has-activity" : ""].filter(Boolean).join(" ")}
                    onClick={() => setSelectedCalendarDate(cell.date === selectedCalendarDate ? null : cell.date)}>
                    {cell.day}
                  </button>
                ),
              )}
            </div>
          </div>
          {selectedCalendarDate && (
            <div className="calendar-day-activities">
              <h4 className="calendar-day-title">{formatDate(selectedCalendarDate)}</h4>
              {selectedDateActivities.length ? (
                selectedDateActivities.map((a) => (
                  <div key={a.id} className="calendar-day-activity-item">
                    <div className="calendar-day-activity-info">
                      <strong>{a.type}</strong>
                      {getActivityMeta(a) && <span>{getActivityMeta(a)}</span>}
                      {a.notes && <span>{a.notes}</span>}
                    </div>
                    <span className={`plan-status-badge ${a.status}`}>{STATUS_LABELS[a.status]}</span>
                  </div>
                ))
              ) : (
                <p className="calendar-day-rest">Rest day</p>
              )}
            </div>
          )}
        </div>

        <div className="weekly-schedule-section">
          <h3>Weekly Schedule</h3>
          {weeks.map((week) => {
            const isExpanded = expandedWeeks.has(week.weekNum);
            const completedCount = week.activities.filter((a) => a.status === "completed" || a.status === "completed_with_changes").length;
            const daysInWeek = getDaysInWeek(week);
            return (
              <div key={week.weekNum} className={`week-accordion${week.isCurrent ? " current-week" : ""}`}>
                <button type="button" className="week-accordion-header" onClick={() => toggleWeek(week.weekNum)}>
                  <div className="week-accordion-left">
                    <span className="week-accordion-name">Week {week.weekNum}</span>
                    <span className="week-accordion-dates">{formatDate(week.startDate)} &ndash; {formatDate(week.endDate)}</span>
                  </div>
                  <div className="week-accordion-right">
                    {week.activities.length > 0 && <span className="week-completed-count">{completedCount}/{week.activities.length} completed</span>}
                    {week.isCurrent && <span className="current-week-badge">Current</span>}
                    <span className="week-chevron">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="week-accordion-body">
                    {daysInWeek.map(({ dateStr, dayName, activity }) =>
                      activity ? (
                        <div key={dateStr} className="plan-activity-row-wrap">
                          <div className="plan-activity-row">
                            <div className={`activity-status-circle ${activity.status}`} />
                            <div className="plan-activity-row-info">
                              <p className="plan-activity-day">{dayName} · {activity.type}</p>
                              {getActivityMeta(activity) && <p className="plan-activity-meta">{getActivityMeta(activity)}</p>}
                              {activity.notes && <p className="plan-activity-desc">{activity.notes}</p>}
                            </div>
                            {activity.status === "not_started" ? (
                              <button type="button" className="log-activity-btn"
                                onClick={() => setLoggingActivityId((cur) => cur === activity.id ? null : activity.id)}>
                                Log
                              </button>
                            ) : (
                              <span className={`plan-status-badge ${activity.status}`}>{STATUS_LABELS[activity.status]}</span>
                            )}
                          </div>
                          {loggingActivityId === activity.id && (
                            <div className="activity-log-form">
                              <select value={activityDrafts[activity.id]?.status ?? "completed"}
                                onChange={(e) => handleActivityDraftChange(activity, { status: e.target.value as ActivityStatus })}>
                                {STATUS_OPTIONS.filter((s) => s !== "not_started").map((s) => (
                                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <input value={activityDrafts[activity.id]?.comment ?? ""} placeholder="Comment (optional)"
                                onChange={(e) => handleActivityDraftChange(activity, { comment: e.target.value })} />
                              <div className="activity-log-form-actions">
                                <button type="button" className="activity-log-save-btn" disabled={isUpdatingActivityId === activity.id}
                                  onClick={() => void handleActivityStatusSave(activity)}>
                                  {isUpdatingActivityId === activity.id ? "Saving..." : "Save"}
                                </button>
                                <button type="button" className="activity-log-cancel-btn" onClick={() => setLoggingActivityId(null)}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div key={dateStr} className="rest-day-row">
                          <span className="rest-day-name">{dayName}</span>
                          <span className="rest-day-label">Rest</span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {createPlanModal}
      {coachWizardModal}
    </main>
  );
}
