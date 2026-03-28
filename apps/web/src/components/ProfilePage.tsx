import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDate, formatDistance } from "../lib/format";
import type { RaceResult, TrainingZoneKey, UserProfile } from "../types";

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

function normalizeZoneDraft(zones: ZoneDraft): ZoneDraft {
  return ZONE_KEYS.reduce((result, zone) => {
    result[zone] = {
      from: zones[zone].from.trim(),
      to: zones[zone].to.trim(),
    };

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

function toZoneDraft(profile: UserProfile): ZoneDraft {
  if (!profile.trainingZones) {
    return EMPTY_ZONE_DRAFT;
  }

  return {
    Z1: {
      from: paceToDisplay(profile.trainingZones.Z1.fromSecondsPerKm),
      to: paceToDisplay(profile.trainingZones.Z1.toSecondsPerKm),
    },
    Z2: {
      from: paceToDisplay(profile.trainingZones.Z2.fromSecondsPerKm),
      to: paceToDisplay(profile.trainingZones.Z2.toSecondsPerKm),
    },
    Z3: {
      from: paceToDisplay(profile.trainingZones.Z3.fromSecondsPerKm),
      to: paceToDisplay(profile.trainingZones.Z3.toSecondsPerKm),
    },
    Z4: {
      from: paceToDisplay(profile.trainingZones.Z4.fromSecondsPerKm),
      to: paceToDisplay(profile.trainingZones.Z4.toSecondsPerKm),
    },
    Z5: {
      from: paceToDisplay(profile.trainingZones.Z5.fromSecondsPerKm),
      to: paceToDisplay(profile.trainingZones.Z5.toSecondsPerKm),
    },
  };
}

export function ProfilePage() {
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

  const sortedRaceResults = useMemo(
    () => [...(profile?.raceResults ?? [])].sort((first, second) => second.date.localeCompare(first.date)),
    [profile],
  );

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
      <main className="shell centered-state">
        <p>Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="shell dashboard-shell planning-shell">
      <section className="hero-card compact">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Training zones and race history.</h1>
          <p>Set your pace zones from Z1 to Z5 and keep your race results in one place.</p>
        </div>
      </section>

      <section className="panel planning-form-panel">
        <div className="panel-header">
          <h2>Training zones (min/km)</h2>
        </div>
        <form className="planning-form" onSubmit={handleZonesSave}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>From pace</th>
                  <th>To pace</th>
                </tr>
              </thead>
              <tbody>
                {ZONE_KEYS.map((zone) => (
                  <tr key={zone}>
                    <td>{zone}</td>
                    <td>
                      <input
                        required
                        aria-label={`${zone} from pace`}
                        inputMode="numeric"
                        placeholder="6:30"
                        value={zones[zone].from}
                        onChange={(event) =>
                          setZones((current) => ({
                            ...current,
                            [zone]: {
                              ...current[zone],
                              from: event.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        required
                        aria-label={`${zone} to pace`}
                        inputMode="numeric"
                        placeholder="6:45"
                        value={zones[zone].to}
                        onChange={(event) =>
                          setZones((current) => ({
                            ...current,
                            [zone]: {
                              ...current[zone],
                              to: event.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="button-primary" type="submit" disabled={isSavingZones}>
            {isSavingZones ? "Saving..." : "Save zones"}
          </button>
        </form>
      </section>

      <section className="panel planning-form-panel">
        <div className="panel-header">
          <h2>Add race result</h2>
        </div>
        <form className="planning-form planning-form-wide" onSubmit={handleCreateRaceResult}>
          <label className="filter-field">
            Race title
            <input
              required
              value={resultForm.title}
              onChange={(event) => setResultForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="filter-field">
            Distance (km)
            <input
              required
              min="0.1"
              step="0.1"
              type="number"
              value={resultForm.distanceKm}
              onChange={(event) => setResultForm((current) => ({ ...current, distanceKm: event.target.value }))}
            />
          </label>
          <label className="filter-field">
            Date
            <input
              required
              type="date"
              value={resultForm.date}
              onChange={(event) => setResultForm((current) => ({ ...current, date: event.target.value }))}
            />
          </label>
          <label className="filter-field">
            Time (mm:ss or hh:mm:ss)
            <input
              required
              aria-label="Race result time"
              placeholder="1:42:30"
              value={resultForm.time}
              onChange={(event) => setResultForm((current) => ({ ...current, time: event.target.value }))}
            />
          </label>
          <button className="button-primary" type="submit" disabled={isSavingResult}>
            {isSavingResult ? "Saving..." : "Add race result"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Race results ({sortedRaceResults.length})</h2>
        </div>

        {!sortedRaceResults.length ? (
          <p className="subtle">No race results yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Race</th>
                  <th>Distance</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRaceResults.map((result) => {
                  const isEditing = editingResultId === result.id;

                  if (isEditing) {
                    return (
                      <tr key={result.id}>
                        <td>
                          <input
                            value={editingForm.title}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, title: event.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={editingForm.distanceKm}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, distanceKm: event.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={editingForm.date}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, date: event.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Edit race result time"
                            value={editingForm.time}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, time: event.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="button-secondary planning-action-btn"
                            type="button"
                            disabled={isSavingResult}
                            onClick={() => void handleSaveEditRaceResult(result.id)}
                          >
                            Save
                          </button>{" "}
                          <button
                            className="button-secondary planning-action-btn"
                            type="button"
                            disabled={isSavingResult}
                            onClick={() => setEditingResultId(null)}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={result.id}>
                      <td>{result.title}</td>
                      <td>{formatDistance(result.distanceKm)}</td>
                      <td>{formatDate(result.date)}</td>
                      <td>{durationToDisplay(result.elapsedTimeSeconds)}</td>
                      <td>
                        <button
                          className="button-secondary planning-action-btn"
                          type="button"
                          disabled={isSavingResult}
                          onClick={() => beginEditRaceResult(result)}
                        >
                          Edit
                        </button>{" "}
                        <button
                          className="button-secondary planning-action-btn"
                          type="button"
                          disabled={isSavingResult}
                          onClick={() => void handleDeleteRaceResult(result.id)}
                        >
                          Delete
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

      {(errorMessage || successMessage) && (
        <section className="panel planning-feedback">
          {errorMessage && <p className="planning-error">{errorMessage}</p>}
          {successMessage && <p className="planning-success">{successMessage}</p>}
        </section>
      )}
    </main>
  );
}