import { formatDate, formatDistance, formatDuration, formatPace } from "../lib/format";
import type { Activity } from "../types";

type ActivitiesTableProps = {
  activities: Activity[];
  selectedActivityId?: number;
  onSelect: (activity: Activity) => void;
  page: number;
  isLastPage: boolean;
  isLoadingPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function ActivitiesTable({ activities, onSelect, selectedActivityId, page, isLastPage, isLoadingPage, onPrevPage, onNextPage }: ActivitiesTableProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Recent activities</h2>
        <span>{isLoadingPage ? "Loading…" : `${activities.length} loaded`}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Distance</th>
              <th>Pace</th>
              <th>Time</th>
              <th>Elevation</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr
                key={activity.id}
                className={activity.id === selectedActivityId ? "selected" : undefined}
                onClick={() => onSelect(activity)}
              >
                <td>{formatDate(activity.startDate)}</td>
                <td>
                  <strong>{activity.name}</strong>
                  <div className="subtle">{activity.type}</div>
                </td>
                <td>{formatDistance(activity.distanceKm)}</td>
                <td>{formatPace(activity.averagePaceSecondsPerKm)}</td>
                <td>{formatDuration(activity.movingTimeSeconds)}</td>
                <td>{Math.round(activity.elevationGainMeters)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button
          className="button-secondary pagination-btn"
          disabled={page <= 1 || isLoadingPage}
          onClick={onPrevPage}
        >
          ← Previous
        </button>
        <span className="pagination-page">Page {page}</span>
        <button
          className="button-secondary pagination-btn"
          disabled={isLastPage || isLoadingPage}
          onClick={onNextPage}
        >
          Next →
        </button>
      </div>
    </section>
  );
}
