import { formatDate, formatDistance, formatDuration, formatPace } from "../lib/format";
import type { Activity } from "../types";

type ActivityDetailProps = {
  activity?: Activity;
};

export function ActivityDetail({ activity }: ActivityDetailProps) {
  if (!activity) {
    return (
      <aside className="panel detail-panel empty-detail">
        <h2>Activity detail</h2>
        <p>Select a run to inspect the session metrics.</p>
      </aside>
    );
  }

  return (
    <aside className="panel detail-panel">
      <div className="panel-header">
        <h2>{activity.name}</h2>
        <span>{formatDate(activity.startDate)}</span>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Type</dt>
          <dd>{activity.type}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{formatDistance(activity.distanceKm)}</dd>
        </div>
        <div>
          <dt>Moving time</dt>
          <dd>{formatDuration(activity.movingTimeSeconds)}</dd>
        </div>
        <div>
          <dt>Elapsed time</dt>
          <dd>{formatDuration(activity.elapsedTimeSeconds)}</dd>
        </div>
        <div>
          <dt>Average pace</dt>
          <dd>{formatPace(activity.averagePaceSecondsPerKm)}</dd>
        </div>
        <div>
          <dt>Elevation gain</dt>
          <dd>{Math.round(activity.elevationGainMeters)} m</dd>
        </div>
        <div>
          <dt>Average HR</dt>
          <dd>{activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm` : "-"}</dd>
        </div>
        <div>
          <dt>Kudos</dt>
          <dd>{activity.kudosCount ?? 0}</dd>
        </div>
      </dl>
    </aside>
  );
}
