import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDate, formatDistance } from "../lib/format";
import type { AthleteSummary, RaceResult, TrainingZoneKey, UserProfile } from "../types";

type ZoneDraft = Record<TrainingZoneKey, { from: string; to: string }>;

type RaceResultForm = {
  title: string;
  distanceKm: string;
  date: string;
  time: string;
};

const ZONE_KEYS: TrainingZoneKey[] = ["Z1", "Z2", "Z3", "Z4", "Z5"];

const EMPTY_ZONE_DRAFT: ZoneDraft = {
  Z1: { from: "", to: "" },
  Z2: { from: "", to: "" },
  Z3: { from: "", to: "" },
  Z4: { from: "", to: "" },
  Z5: { from: "", to: "" },
};

const EMPTY_RACE_RESULT_FORM: RaceResultForm = {
  title: "",
  distanceKm: "",
  date: "",
  time: "",
};

const ZONE_COLORS: Record<TrainingZoneKey, string> = {
  Z1: "#3b82f6",
  Z2: "#22c55e",
  Z3: "#eab308",
  Z4: "#f97316",
  Z5: "#ef4444",
};

const ZONE_NAMES: Record<TrainingZoneKey, string> = {
  Z1: "Zone 1",
  Z2: "Zone 2",
  Z3: "Zone 3",
  Z4: "Zone 4",
  Z5: "Zone 5",
};

const ZONE_LABELS: Record<TrainingZoneKey, string> = {
  Z1: "Recovery",
  Z2: "Easy",
  Z3: "Tempo",
  Z4: "Threshold",
  Z5: "VO2 Max",
};

type PRCategory = { label: string; distanceKm: number; tolerance: number; bgColor: string };

const PR_CATEGORIES: PRCategory[] = [
  { label: "Fastest 5K", distanceKm: 5, tolerance: 0.5, bgColor: "#2a1208" },
  { label: "Fastest 10K", distanceKm: 10, tolerance: 1, bgColor: "#231007" },
  { label: "Fastest Half", distanceKm: 21.1, tolerance: 1.5, bgColor: "#082210" },
  { label: "Fastest Marathon", distanceKm: 42.2, tolerance: 2.5, bgColor: "#120a22" },
];

type PRResult = { category: PRCategory; result: RaceResult; pace: string };

const PACE_PATTERN = /^[0-9]{1,2}:[0-5][0-9]$/;
const RACE_TIME_PATTERN = /^([0-9]+:)?[0-5][0-9]:[0-5][0-9]$/;

function paceToDisplay(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function durationToDisplay(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parsePaceToSeconds(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

function formatZonePaceDisplay(zone: TrainingZoneKey, fromStr: string, toStr: string): string {
  if (zone === "Z1") return `> ${toStr} min/km`;
  if (zone === "Z5") return `< ${fromStr} min/km`;
  return `${fromStr}–${toStr} min/km`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function computePRs(raceResults: RaceResult[]): PRResult[] {
  return PR_CATEGORIES.flatMap((cat) => {
    const matching = raceResults.filter((r) => Math.abs(r.distanceKm - cat.distanceKm) <= cat.tolerance);
    if (!matching.length) return [];
    const best = matching.reduce((min, r) => (r.elapsedTimeSeconds < min.elapsedTimeSeconds ? r : min));
    const paceSeconds = Math.round(best.elapsedTimeSeconds / best.distanceKm);
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = paceSeconds % 60;
    return [{ category: cat, result: best, pace: `${paceMin}:${String(paceSec).padStart(2, "0")} min/km` }];
  });
}

function normalizeZoneDraft(zones: ZoneDraft): ZoneDraft {
  return ZONE_KEYS.reduce((result, zone) => {
    result[zone] = { from: zones[zone].from.trim(), to: zones[zone].to.trim() };
    return result;
  }, {} as ZoneDraft);
}

function getZonesValidationMessage(zones: ZoneDraft) {
  for (const zone of ZONE_KEYS) {
    const from = zones[zone].from;
    const to = zones[zone].to;
    if (!PACE_PATTERN.test(from) || !PACE_PATTERN.test(to)) {
      return `${zone} pace must use mm:ss format, for example 6:30.`;
    }
    if (parsePaceToSeconds(from) > parsePaceToSeconds(to)) {
      return `${zone} pace range is invalid: from pace must be less than or equal to to pace.`;
    }
  }
  return null;
}

function normalizeRaceResultForm(form: RaceResultForm): RaceResultForm {
  return {
    title: form.title.trim(),
    distanceKm: form.distanceKm.trim(),
    date: form.date.trim(),
    time: form.time.trim(),
  };
}

function getRaceTimeValidationMessage(time: string) {
  if (!RACE_TIME_PATTERN.test(time)) {
    return "Race time must use mm:ss or hh:mm:ss format, for example 42:30 or 1:42:30.";
  }
  return null;
}

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
  return (await response.json()) as T;
}

function toZoneDraft(profile: UserProfile): ZoneDraft {
  if (!profile.trainingZones) return EMPTY_ZONE_DRAFT;
  return {
    Z1: { from: paceToDisplay(profile.trainingZones.Z1.fromSecondsPerKm), to: paceToDisplay(profile.trainingZones.Z1.toSecondsPerKm) },
    Z2: { from: paceToDisplay(profile.trainingZones.Z2.fromSecondsPerKm), to: paceToDisplay(profile.trainingZones.Z2.toSecondsPerKm) },
    Z3: { from: paceToDisplay(profile.trainingZones.Z3.fromSecondsPerKm), to: paceToDisplay(profile.trainingZones.Z3.toSecondsPerKm) },
    Z4: { from: paceToDisplay(profile.trainingZones.Z4.fromSecondsPerKm), to: paceToDisplay(profile.trainingZones.Z4.toSecondsPerKm) },
    Z5: { from: paceToDisplay(profile.trainingZones.Z5.fromSecondsPerKm), to: paceToDisplay(profile.trainingZones.Z5.toSecondsPerKm) },
  };
}

/* ── Icons ────────────────────────────────────────────────────────────────── */

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="8 21 12 17 16 21" />
      <line x1="12" y1="17" x2="12" y2="13" />
      <path d="M7 4H4v3a8 8 0 008 8 8 8 0 008-8V4h-3" />
      <line x1="5" y1="4" x2="19" y2="4" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function ProfilePage({ summary }: { summary?: AthleteSummary }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [zones, setZones] = useState<ZoneDraft>(EMPTY_ZONE_DRAFT);
  const [resultForm, setResultForm] = useState<RaceResultForm>(EMPTY_RACE_RESULT_FORM);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<RaceResultForm>(EMPTY_RACE_RESULT_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingZones, setIsSavingZones] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isConfiguringZones, setIsConfiguringZones] = useState(false);
  const [showAddRaceForm, setShowAddRaceForm] = useState(false);

  const sortedRaceResults = useMemo(
    () => [...(profile?.raceResults ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [profile],
  );

  const personalRecords = useMemo(() => computePRs(sortedRaceResults), [sortedRaceResults]);

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await apiRequest<{ profile: UserProfile }>("/api/profile");
      setProfile(payload.profile);
      setZones(toZoneDraft(payload.profile));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleZonesSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const normalizedZones = normalizeZoneDraft(zones);
    const validationMessage = getZonesValidationMessage(normalizedZones);
    if (validationMessage) {
      setZones(normalizedZones);
      setErrorMessage(validationMessage);
      return;
    }
    setIsSavingZones(true);
    try {
      const payload = await apiRequest<{ profile: UserProfile }>("/api/profile/zones", {
        method: "PUT",
        body: JSON.stringify(normalizedZones),
      });
      setProfile(payload.profile);
      setZones(toZoneDraft(payload.profile));
      setSuccessMessage("Training zones saved.");
      setIsConfiguringZones(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save zones.");
    } finally {
      setIsSavingZones(false);
    }
  };

  const handleCreateRaceResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const normalizedForm = normalizeRaceResultForm(resultForm);
    const validationMessage = getRaceTimeValidationMessage(normalizedForm.time);
    if (validationMessage) {
      setResultForm(normalizedForm);
      setErrorMessage(validationMessage);
      return;
    }
    setIsSavingResult(true);
    try {
      const payload = await apiRequest<{ profile: UserProfile }>("/api/profile/race-results", {
        method: "POST",
        body: JSON.stringify({
          title: normalizedForm.title,
          distanceKm: Number(normalizedForm.distanceKm),
          date: normalizedForm.date,
          time: normalizedForm.time,
        }),
      });
      setProfile(payload.profile);
      setResultForm(EMPTY_RACE_RESULT_FORM);
      setSuccessMessage("Race result added.");
      setShowAddRaceForm(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save race result.");
    } finally {
      setIsSavingResult(false);
    }
  };

  const beginEditRaceResult = (result: RaceResult) => {
    setEditingResultId(result.id);
    setEditingForm({
      title: result.title,
      distanceKm: String(result.distanceKm),
      date: result.date,
      time: durationToDisplay(result.elapsedTimeSeconds),
    });
  };

  const handleSaveEditRaceResult = async (resultId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const normalizedForm = normalizeRaceResultForm(editingForm);
    const validationMessage = getRaceTimeValidationMessage(normalizedForm.time);
    if (validationMessage) {
      setEditingForm(normalizedForm);
      setErrorMessage(validationMessage);
      return;
    }
    setIsSavingResult(true);
    try {
      const payload = await apiRequest<{ profile: UserProfile }>(`/api/profile/race-results/${resultId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: normalizedForm.title,
          distanceKm: Number(normalizedForm.distanceKm),
          date: normalizedForm.date,
          time: normalizedForm.time,
        }),
      });
      setProfile(payload.profile);
      setEditingResultId(null);
      setEditingForm(EMPTY_RACE_RESULT_FORM);
      setSuccessMessage("Race result updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update race result.");
    } finally {
      setIsSavingResult(false);
    }
  };

  const handleDeleteRaceResult = async (resultId: string) => {
    setIsSavingResult(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = await apiRequest<{ profile: UserProfile }>(`/api/profile/race-results/${resultId}`, {
        method: "DELETE",
      });
      setProfile(payload.profile);
      if (editingResultId === resultId) {
        setEditingResultId(null);
        setEditingForm(EMPTY_RACE_RESULT_FORM);
      }
      setSuccessMessage("Race result removed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete race result.");
    } finally {
      setIsSavingResult(false);
    }
  };

  if (isLoading) {
    return (
      <main className="profile-page">
        <p className="profile-loading">Loading profile…</p>
      </main>
    );
  }

  const displayName = summary?.athlete.displayName ?? "Runner";

  return (
    <main className="profile-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="profile-header-card">
        <div className="profile-avatar">{getInitials(displayName)}</div>
        <h1 className="profile-display-name">{displayName}</h1>
      </div>

      {/* ── Training Zones ─────────────────────────────────────────────── */}
      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-title">
            <HeartIcon />
            <span>Training Zones</span>
          </div>
          <button
            type="button"
            className="profile-card-btn"
            onClick={() => { setIsConfiguringZones((v) => !v); setErrorMessage(null); }}
          >
            <EditIcon />
            {isConfiguringZones ? "Cancel" : "Configure"}
          </button>
        </div>

        {isConfiguringZones ? (
          <form className="zone-edit-form" onSubmit={(e) => void handleZonesSave(e)}>
            <div className="zone-edit-rows">
              {ZONE_KEYS.map((zone) => (
                <div key={zone} className="zone-edit-row">
                  <div className="zone-edit-name">
                    <span className="zone-dot" style={{ background: ZONE_COLORS[zone] }} />
                    <span>{ZONE_NAMES[zone]}</span>
                    <span className="zone-sub-label">{ZONE_LABELS[zone]}</span>
                  </div>
                  <label className="zone-edit-field">
                    <span>From</span>
                    <input
                      required
                      aria-label={`${zone} from pace`}
                      inputMode="numeric"
                      placeholder="6:30"
                      value={zones[zone].from}
                      onChange={(e) => setZones((cur) => ({ ...cur, [zone]: { ...cur[zone], from: e.target.value } }))}
                    />
                  </label>
                  <label className="zone-edit-field">
                    <span>To</span>
                    <input
                      required
                      aria-label={`${zone} to pace`}
                      inputMode="numeric"
                      placeholder="6:45"
                      value={zones[zone].to}
                      onChange={(e) => setZones((cur) => ({ ...cur, [zone]: { ...cur[zone], to: e.target.value } }))}
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="zone-edit-actions">
              <button type="submit" className="button-primary" disabled={isSavingZones}>
                {isSavingZones ? "Saving…" : "Save zones"}
              </button>
              <button type="button" className="button-secondary" onClick={() => setIsConfiguringZones(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="zone-rows">
            {ZONE_KEYS.map((zone) => {
              const tz = profile?.trainingZones?.[zone];
              const paceDisplay = tz
                ? formatZonePaceDisplay(zone, paceToDisplay(tz.fromSecondsPerKm), paceToDisplay(tz.toSecondsPerKm))
                : "—";
              return (
                <div key={zone} className="zone-row">
                  <div className="zone-row-info">
                    <span className="zone-dot" style={{ background: ZONE_COLORS[zone] }} />
                    <div>
                      <strong>{ZONE_NAMES[zone]}</strong>
                      <span className="zone-sub-label">{ZONE_LABELS[zone]}</span>
                    </div>
                  </div>
                  <div className="zone-row-stat">
                    <span className="zone-stat-label">Pace</span>
                    <span className="zone-stat-value">{paceDisplay}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Race Results ───────────────────────────────────────────────── */}
      <section className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-title">
            <TrophyIcon />
            <span>Race Results</span>
          </div>
          <button
            type="button"
            className="profile-card-btn"
            onClick={() => { setShowAddRaceForm((v) => !v); setErrorMessage(null); }}
          >
            <EditIcon />
            {showAddRaceForm ? "Cancel" : "Add Race"}
          </button>
        </div>

        {showAddRaceForm && (
          <form className="add-race-form" onSubmit={(e) => void handleCreateRaceResult(e)}>
            <label className="profile-form-field">
              Race title
              <input
                required
                aria-label="Race title"
                value={resultForm.title}
                onChange={(e) => setResultForm((cur) => ({ ...cur, title: e.target.value }))}
              />
            </label>
            <label className="profile-form-field">
              Distance (km)
              <input
                required
                aria-label="Distance (km)"
                min="0.1"
                step="0.1"
                type="number"
                value={resultForm.distanceKm}
                onChange={(e) => setResultForm((cur) => ({ ...cur, distanceKm: e.target.value }))}
              />
            </label>
            <label className="profile-form-field">
              Date
              <input
                required
                aria-label="Date"
                type="date"
                value={resultForm.date}
                onChange={(e) => setResultForm((cur) => ({ ...cur, date: e.target.value }))}
              />
            </label>
            <label className="profile-form-field">
              Time (mm:ss or hh:mm:ss)
              <input
                required
                aria-label="Race result time"
                placeholder="1:42:30"
                value={resultForm.time}
                onChange={(e) => setResultForm((cur) => ({ ...cur, time: e.target.value }))}
              />
            </label>
            <div className="add-race-form-actions">
              <button type="submit" className="button-primary" disabled={isSavingResult}>
                {isSavingResult ? "Saving…" : "Add race result"}
              </button>
            </div>
          </form>
        )}

        {sortedRaceResults.length === 0 && !showAddRaceForm ? (
          <p className="profile-empty">No race results yet. Click "Add Race" to add one.</p>
        ) : (
          <div className="race-result-list">
            {sortedRaceResults.map((result) => {
              const isEditing = editingResultId === result.id;
              if (isEditing) {
                return (
                  <div key={result.id} className="race-result-edit-row">
                    <div className="race-result-edit-fields">
                      <label className="profile-form-field">
                        Race title
                        <input
                          aria-label="Edit race title"
                          value={editingForm.title}
                          onChange={(e) => setEditingForm((cur) => ({ ...cur, title: e.target.value }))}
                        />
                      </label>
                      <label className="profile-form-field">
                        Distance (km)
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          aria-label="Edit distance"
                          value={editingForm.distanceKm}
                          onChange={(e) => setEditingForm((cur) => ({ ...cur, distanceKm: e.target.value }))}
                        />
                      </label>
                      <label className="profile-form-field">
                        Date
                        <input
                          type="date"
                          aria-label="Edit date"
                          value={editingForm.date}
                          onChange={(e) => setEditingForm((cur) => ({ ...cur, date: e.target.value }))}
                        />
                      </label>
                      <label className="profile-form-field">
                        Time
                        <input
                          aria-label="Edit race result time"
                          value={editingForm.time}
                          onChange={(e) => setEditingForm((cur) => ({ ...cur, time: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="race-result-edit-actions">
                      <button
                        type="button"
                        className="button-primary"
                        disabled={isSavingResult}
                        onClick={() => void handleSaveEditRaceResult(result.id)}
                      >
                        {isSavingResult ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={isSavingResult}
                        onClick={() => setEditingResultId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={result.id} className="race-result-row">
                  <div className="race-result-info">
                    <div className="race-result-name-row">
                      <span className="race-result-name">{result.title}</span>
                      <span className="race-result-badge">{formatDistance(result.distanceKm)}</span>
                    </div>
                    <span className="race-result-date">{formatDate(result.date)}</span>
                  </div>
                  <div className="race-result-right">
                    <div className="race-result-time-block">
                      <span className="race-result-time-label">Time</span>
                      <span className="race-result-time-value">{durationToDisplay(result.elapsedTimeSeconds)}</span>
                    </div>
                    <div className="race-result-actions">
                      <button
                        type="button"
                        className="race-result-action-btn"
                        disabled={isSavingResult}
                        onClick={() => beginEditRaceResult(result)}
                        aria-label="Edit race result"
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className="race-result-action-btn race-result-action-btn--delete"
                        disabled={isSavingResult}
                        onClick={() => void handleDeleteRaceResult(result.id)}
                        aria-label="Delete race result"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Personal Records ───────────────────────────────────────────── */}
      {personalRecords.length > 0 && (
        <section className="profile-card">
          <div className="profile-card-header">
            <div className="profile-card-title">
              <TrendIcon />
              <span>Personal Records</span>
            </div>
          </div>
          <div className="pr-grid">
            {personalRecords.map((pr) => (
              <div key={pr.category.label} className="pr-card" style={{ background: pr.category.bgColor }}>
                <span className="pr-card-label">{pr.category.label}</span>
                <strong className="pr-card-time">{durationToDisplay(pr.result.elapsedTimeSeconds)}</strong>
                <span className="pr-card-pace">{pr.pace}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Feedback ───────────────────────────────────────────────────── */}
      {(errorMessage ?? successMessage) && (
        <div className="profile-feedback">
          {errorMessage && <p className="profile-error">{errorMessage}</p>}
          {successMessage && <p className="profile-success">{successMessage}</p>}
        </div>
      )}
    </main>
  );
}

