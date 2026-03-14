import { useState } from "react";

export type Filters = {
  dateFrom: string;
  dateTo: string;
  activityType: string;
};

export const EMPTY_FILTERS: Filters = { dateFrom: "", dateTo: "", activityType: "" };

const ACTIVITY_TYPES = [
  "Run",
  "TrailRun",
  "VirtualRun",
  "Ride",
  "VirtualRide",
  "Walk",
  "Hike",
  "Swim",
  "Workout",
  "WeightTraining",
  "Yoga",
];

type ActivityFiltersProps = {
  activeFilters: Filters;
  onApply: (filters: Filters) => void;
  disabled?: boolean;
};

export function ActivityFilters({ activeFilters, onApply, disabled }: ActivityFiltersProps) {
  const [draft, setDraft] = useState<Filters>(activeFilters);

  const hasActiveFilters =
    activeFilters.dateFrom !== "" || activeFilters.dateTo !== "" || activeFilters.activityType !== "";

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    onApply(EMPTY_FILTERS);
  };

  return (
    <form
      className="filter-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <span className="filter-label">Filter</span>
      <div className="filter-fields">
        <label className="filter-field">
          <span>From</span>
          <input
            type="date"
            value={draft.dateFrom}
            onChange={(e) => setDraft((prev) => ({ ...prev, dateFrom: e.target.value }))}
            disabled={disabled}
          />
        </label>
        <label className="filter-field">
          <span>To</span>
          <input
            type="date"
            value={draft.dateTo}
            onChange={(e) => setDraft((prev) => ({ ...prev, dateTo: e.target.value }))}
            disabled={disabled}
          />
        </label>
        <label className="filter-field">
          <span>Type</span>
          <select
            value={draft.activityType}
            onChange={(e) => setDraft((prev) => ({ ...prev, activityType: e.target.value }))}
            disabled={disabled}
          >
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="button-primary filter-apply-btn" type="submit" disabled={disabled}>
        Apply
      </button>
      {hasActiveFilters && (
        <button
          className="button-secondary filter-clear-btn"
          type="button"
          onClick={handleReset}
          disabled={disabled}
        >
          Clear
        </button>
      )}
    </form>
  );
}
