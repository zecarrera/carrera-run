import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Activity, ActivityStatus, AthleteSummary, PlanActivity, TrainingPlan, VideoRecommendation } from "../types";
import { LoadingScreen } from "./LoadingScreen";

type HomePageProps = {
  summary: AthleteSummary;
};

type WeekTotals = {
  runs: number;
  distanceKm: number;
  movingTimeSeconds: number;
  elevationGainMeters: number;
};

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function getNextWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToNextMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToNextMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function isLastDayOfWeek(): boolean {
  return new Date().getDay() === 0; // Sunday
}

function computeWeekTotals(activities: Activity[]): WeekTotals {
  const runs = activities.filter((a) => a.type.toLowerCase().includes("run"));
  return runs.reduce(
    (acc, run) => ({
      runs: acc.runs + 1,
      distanceKm: acc.distanceKm + run.distanceKm,
      movingTimeSeconds: acc.movingTimeSeconds + run.movingTimeSeconds,
      elevationGainMeters: acc.elevationGainMeters + run.elevationGainMeters,
    }),
    { runs: 0, distanceKm: 0, movingTimeSeconds: 0, elevationGainMeters: 0 },
  );
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString("default", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("default", { weekday: "long" });
}

/** Parse notes into title + description.
 *  If notes has " - " or ": " split there, otherwise use type as title. */
function parseActivityLabel(activity: PlanActivity): { title: string; desc: string } {
  const notes = activity.notes ?? "";
  const colonIdx = notes.indexOf(": ");
  const dashIdx = notes.indexOf(" - ");
  const splitIdx = colonIdx !== -1 ? colonIdx : dashIdx !== -1 ? dashIdx : -1;
  if (splitIdx !== -1) {
    return {
      title: notes.slice(0, splitIdx).trim(),
      desc: notes.slice(splitIdx + (colonIdx !== -1 ? 2 : 3)).trim(),
    };
  }
  return { title: activity.type, desc: notes };
}

/* ── Icon components ──────────────────────────────────────────────────────── */

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DistanceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

/* ── Activity card ────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  "warm-up": "Pre-run Warm-up",
  "cool-down": "Post-run Cool-down",
  general: "Recommended",
};

function VideoCardWithRefresh({
  activityType,
  durationMinutes,
  initialVideo,
  initialRemaining,
}: {
  activityType: string;
  durationMinutes?: number;
  initialVideo: VideoRecommendation;
  initialRemaining: number | null;
}) {
  const [video, setVideo] = useState(initialVideo);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  // null = unlimited (YouTube API); number = total unique options for this role
  const [total] = useState<number | null>(
    initialRemaining !== null ? 1 + initialRemaining : null,
  );
  const seenIds = useRef<string[]>([initialVideo.videoId]);

  const handleShowDifferent = async () => {
    setLoading(true);
    try {
      let url = `/api/videos/recommendation?activityType=${encodeURIComponent(activityType)}&role=${encodeURIComponent(initialVideo.role)}`;
      if (durationMinutes != null) url += `&durationMinutes=${durationMinutes}`;
      url += `&exclude=${seenIds.current.join(",")}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const payload = (await res.json()) as { recommendations: VideoRecommendation[]; remainingByRole: Record<string, number> | null };
      const next = payload.recommendations[0];
      if (next) {
        seenIds.current = [...seenIds.current, next.videoId];
        setVideo(next);
        setPage((p) => p + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const isAtEnd = total !== null && page >= total;
  const showButton = total === null || total > 1;

  return (
    <div className="video-card-wrap">
      <a
        href={`https://www.youtube.com/watch?v=${video.videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="video-card"
      >
        <div className="video-thumbnail-wrap">
          <img
            src={`https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`}
            alt={video.title}
            className="video-thumbnail"
            loading="lazy"
          />
          <span className="video-ext-icon"><ExternalLinkIcon /></span>
          {video.role !== "general" && (
            <span className="video-role-badge">{ROLE_LABEL[video.role]}</span>
          )}
        </div>
        <p className="video-title">{video.title}</p>
        <p className="video-channel">{video.channelName}</p>
      </a>
      {showButton && (
        <button
          type="button"
          className={`video-rec-refresh${isAtEnd ? " video-rec-refresh--exhausted" : ""}`}
          onClick={isAtEnd || loading ? undefined : () => void handleShowDifferent()}
          disabled={isAtEnd || loading}
        >
          <RefreshIcon />
          {isAtEnd ? `Recommendation ${page} of ${total}` : loading ? "Loading…" : "Show Different Video"}
          {!isAtEnd && !loading && total !== null && (
            <span className="video-rec-counter">{page} of {total}</span>
          )}
        </button>
      )}
    </div>
  );
}

export function VideoRecommendationPanel({ activityType, durationMinutes }: { activityType: string; durationMinutes?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [videos, setVideos] = useState<VideoRecommendation[]>([]);
  const [remainingByRole, setRemainingByRole] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (videos.length > 0) return; // already fetched
    setLoading(true);
    setError(null);
    try {
      let url = `/api/videos/recommendation?activityType=${encodeURIComponent(activityType)}`;
      if (durationMinutes != null) url += `&durationMinutes=${durationMinutes}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        setError("Could not load recommendation.");
        return;
      }
      const payload = (await res.json()) as { recommendations: VideoRecommendation[]; remainingByRole: Record<string, number> | null };
      setVideos(payload.recommendations);
      setRemainingByRole(payload.remainingByRole);
    } catch {
      setError("Could not load recommendation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-rec-section">
      <div className="video-rec-header">
        <span className="video-rec-label">
          <YoutubeIcon /> Recommended Video
        </span>
      </div>
      <button
        type="button"
        className="video-rec-toggle"
        onClick={() => void handleExpand()}
        aria-expanded={expanded}
      >
        <YoutubeIcon />
        {expanded ? "Hide Recommendation" : "View Recommendation"}
      </button>
      {expanded && (
        <div className="video-rec-content">
          {loading && <p className="subtle" style={{ padding: "0.5rem 0" }}>Loading…</p>}
          {error && <p className="subtle" style={{ padding: "0.5rem 0", color: "var(--color-error)" }}>{error}</p>}
          {!loading && !error && videos.length === 0 && (
            <p className="subtle" style={{ padding: "0.5rem 0" }}>No recommendation available.</p>
          )}
          {videos.map((video) => (
            <VideoCardWithRefresh
              key={video.videoId}
              activityType={activityType}
              durationMinutes={durationMinutes}
              initialVideo={video}
              initialRemaining={remainingByRole !== null ? (remainingByRole[video.role] ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  isNext,
  isToday,
  isBusy,
  showComment,
  commentDraft,
  onDone,
  onSkip,
  onPartial,
  onCommentChange,
  onCommentSave,
  onCommentCancel,
}: {
  activity: PlanActivity;
  isNext: boolean;
  isToday: boolean;
  isBusy: boolean;
  showComment: boolean;
  commentDraft: string;
  onDone: () => void;
  onSkip: () => void;
  onPartial: () => void;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  onCommentCancel: () => void;
}) {
  const { title, desc } = parseActivityLabel(activity);
  const isActioned = activity.status !== "not_started";
  const isCompleted =
    activity.status === "completed" || activity.status === "completed_with_changes";

  const metaItems = [
    { icon: <CalendarIcon />, label: getDayName(activity.date) },
    ...(activity.distanceKm != null
      ? [{ icon: <DistanceIcon />, label: `${activity.distanceKm.toFixed(0)} km` }]
      : []),
    ...(activity.durationMinutes != null
      ? [{ icon: <ClockIcon />, label: `${activity.durationMinutes} min` }]
      : []),
  ];

  const actionButtons = !isActioned && (
    <>
      <button type="button" className="card-action-btn card-action-btn--done" disabled={isBusy} onClick={onDone}>
        <CheckCircleIcon /> Done
      </button>
      <button type="button" className="card-action-btn card-action-btn--skip" disabled={isBusy} onClick={onSkip}>
        <XIcon /> Skip
      </button>
      <button type="button" className="card-action-btn card-action-btn--partial" disabled={isBusy} onClick={onPartial}>
        <EditIcon /> Partially Done
      </button>
    </>
  );

  return (
    <div className={`plan-activity-card${isNext ? " is-next" : ""}`}>
      <div className="plan-activity-card-top">
        <div className="plan-activity-card-title-row">
          {isNext && <span className="badge-next">Next Activity</span>}
          {isCompleted && (
            <span className="badge-completed">
              <CheckCircleIcon /> Completed
            </span>
          )}
          <h3 className="plan-activity-card-title">{title}</h3>
        </div>
        {/* Desktop actions — stacked column on right */}
        {!isActioned && <div className="card-actions">{actionButtons}</div>}
      </div>

      {desc && <p className="plan-activity-card-desc">{desc}</p>}

      <div className="plan-activity-card-meta">
        {metaItems.map((item, i) => (
          <span key={i} className="plan-activity-card-meta-item">
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>

      {/* Mobile actions — row below meta */}
      {!isActioned && <div className="card-actions-row">{actionButtons}</div>}

      {/* Video recommendation — shown for today's non-skipped activities */}
      {isToday && activity.status !== "skipped" && (
        <VideoRecommendationPanel activityType={activity.type} durationMinutes={activity.durationMinutes} />
      )}

      {/* Comment input for Partially Done */}
      {showComment && (
        <div className="card-comment-row">
          <input
            type="text"
            placeholder="What changed? (required)"
            value={commentDraft}
            onChange={(e) => onCommentChange(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="card-action-btn card-action-btn--done"
            disabled={isBusy || !commentDraft.trim()}
            onClick={onCommentSave}
          >
            {isBusy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="card-action-btn card-action-btn--skip" onClick={onCommentCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Week Complete Banner ─────────────────────────────────────────────────── */

function WeekCompleteBanner() {
  return (
    <div className="week-complete-banner" role="status" aria-label="Week complete">
      <div className="week-complete-icon">
        <span aria-hidden="true">🎉</span>
      </div>
      <div className="week-complete-text">
        <strong>Week Complete! 🎉</strong>
        <p>Congratulations! You've completed all activities for this week. Keep up the great work!</p>
      </div>
    </div>
  );
}

/* ── Next Week Preview Card ───────────────────────────────────────────────── */

function NextWeekPreviewCard({ activity, isFirst }: { activity: PlanActivity; isFirst: boolean }) {
  const { title, desc } = parseActivityLabel(activity);
  const metaItems = [
    { icon: <CalendarIcon />, label: getDayName(activity.date) },
    ...(activity.distanceKm != null
      ? [{ icon: <DistanceIcon />, label: `${activity.distanceKm.toFixed(0)} km` }]
      : []),
    ...(activity.durationMinutes != null
      ? [{ icon: <ClockIcon />, label: `${activity.durationMinutes} min` }]
      : []),
  ];

  return (
    <div className="plan-activity-card next-week-preview-card">
      <div className="plan-activity-card-title-row">
        {isFirst && <span className="badge-first-activity">First Activity</span>}
        <h3 className="plan-activity-card-title">{title}</h3>
      </div>
      {desc && <p className="plan-activity-card-desc">{desc}</p>}
      <div className="plan-activity-card-meta">
        {metaItems.map((item, i) => (
          <span key={i} className="plan-activity-card-meta-item">
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */

export function HomePage(_props: HomePageProps) {
  const [weekTotals, setWeekTotals] = useState<WeekTotals | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [weekActivities, setWeekActivities] = useState<PlanActivity[]>([]);
  const [nextWeekActivities, setNextWeekActivities] = useState<PlanActivity[]>([]);
  const [isLoadingWeek, setIsLoadingWeek] = useState(true);
  const [updatingActivityId, setUpdatingActivityId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);

  // Fetch this week's Strava activities for progress bars + stats
  useEffect(() => {
    const load = async () => {
      try {
        const { start, end } = getWeekBounds();
        const res = await fetch(
          `/api/activities?page=1&perPage=100&after=${encodeURIComponent(start)}&before=${encodeURIComponent(end)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as { activities: Activity[] };
        setWeekTotals(computeWeekTotals(payload.activities));
      } catch {
        // non-critical
      }
    };
    void load();
  }, []);

  // Fetch plan + week activities
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/plans", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json()) as { plans: TrainingPlan[] };
        const plan =
          payload.plans.find((p) => p.status === "active") ??
          payload.plans.find((p) => p.status === "upcoming");
        if (!plan) return;
        const { start, end } = getWeekBounds();
        const thisWeek = [...plan.activities]
          .filter((a) => a.date >= start && a.date <= end)
          .sort((a, b) => a.date.localeCompare(b.date));
        const { start: nextStart, end: nextEnd } = getNextWeekBounds();
        const nextWeek = [...plan.activities]
          .filter((a) => a.date >= nextStart && a.date <= nextEnd)
          .sort((a, b) => a.date.localeCompare(b.date));
        setActivePlan(plan);
        setWeekActivities(thisWeek);
        setNextWeekActivities(nextWeek);
      } finally {
        setIsLoadingWeek(false);
      }
    };
    void load();
  }, []);

  const updateActivityStatus = async (
    activity: PlanActivity,
    status: ActivityStatus,
    comment?: string,
  ) => {
    if (!activePlan) return;
    setUpdatingActivityId(activity.id);
    try {
      const res = await fetch(`/api/plans/${activePlan.id}/activities/${activity.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: comment ?? "" }),
      });
      if (!res.ok) return;
      const result = (await res.json()) as { plan: TrainingPlan };
      const { start, end } = getWeekBounds();
      setWeekActivities(
        [...result.plan.activities]
          .filter((a) => a.date >= start && a.date <= end)
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
      const { start: nextStart, end: nextEnd } = getNextWeekBounds();
      setNextWeekActivities(
        [...result.plan.activities]
          .filter((a) => a.date >= nextStart && a.date <= nextEnd)
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
      setActivePlan(result.plan);
      setShowCommentFor(null);
      setCommentDrafts((d) => {
        const next = { ...d };
        delete next[activity.id];
        return next;
      });
    } finally {
      setUpdatingActivityId(null);
    }
  };

  // Compute plan-based progress targets (planned run activities this week)
  const plannedRuns = weekActivities.filter((a) => a.type === "Run");
  const targetDistanceKm = plannedRuns.reduce((s, a) => s + (a.distanceKm ?? 0), 0);
  const targetRuns = plannedRuns.length;

  const actualDistanceKm = weekTotals?.distanceKm ?? 0;
  const actualRuns = weekTotals?.runs ?? 0;

  const distancePct =
    targetDistanceKm > 0 ? Math.min(100, (actualDistanceKm / targetDistanceKm) * 100) : 0;
  const runsPct = targetRuns > 0 ? Math.min(100, (actualRuns / targetRuns) * 100) : 0;

  const nextIdx = weekActivities.findIndex((a) => a.status === "not_started");

  const isWeekComplete =
    weekActivities.length > 0 && weekActivities.every((a) => a.status !== "not_started");
  const showNextWeekPreview =
    (isWeekComplete || isLastDayOfWeek()) && nextWeekActivities.length > 0;

  if (isLoadingWeek) {
    return <LoadingScreen message="Loading your dashboard" />;
  }

  return (
    <div className="dashboard">
      {/* Page title */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-date">{getTodayLabel()}</p>
      </div>

      {/* Week Complete Banner */}
      {isWeekComplete && <WeekCompleteBanner />}

      {/* This Week's Progress */}
      {(targetDistanceKm > 0 || targetRuns > 0) && (
        <section className="progress-card">
          <h2>This Week&apos;s Progress</h2>
          {targetDistanceKm > 0 && (
            <>
              <div className="progress-row">
                <span>Distance</span>
                <span>
                  {actualDistanceKm.toFixed(1)} / {targetDistanceKm.toFixed(0)} km
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${distancePct}%` }} />
              </div>
            </>
          )}
          {targetRuns > 0 && (
            <>
              <div className="progress-row">
                <span>Runs</span>
                <span>
                  {actualRuns} / {targetRuns}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${runsPct}%` }} />
              </div>
            </>
          )}
        </section>
      )}

      {/* This Week's Plan */}
      <section>
        <div className="section-header">
          <h2>This Week&apos;s Plan</h2>
          <Link to="/planning" className="view-all-link">
            View All
          </Link>
        </div>

        {weekActivities.length === 0 ? (
          <div style={{ marginBottom: "1.5rem" }}>
            <p className="subtle" style={{ marginBottom: "0.75rem" }}>
              No activities planned for this week.
            </p>
            <Link to="/planning" className="button-secondary">
              {activePlan ? "View plan" : "Create a training plan"}
            </Link>
          </div>
        ) : (
          <div className="plan-activity-list">
            {weekActivities.map((activity, index) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isNext={index === nextIdx}
                isToday={activity.date === getTodayString()}
                isBusy={updatingActivityId === activity.id}
                showComment={showCommentFor === activity.id}
                commentDraft={commentDrafts[activity.id] ?? ""}
                onDone={() => void updateActivityStatus(activity, "completed")}
                onSkip={() => void updateActivityStatus(activity, "skipped")}
                onPartial={() =>
                  setShowCommentFor((c) => (c === activity.id ? null : activity.id))
                }
                onCommentChange={(v) =>
                  setCommentDrafts((d) => ({ ...d, [activity.id]: v }))
                }
                onCommentSave={() =>
                  void updateActivityStatus(
                    activity,
                    "completed_with_changes",
                    commentDrafts[activity.id],
                  )
                }
                onCommentCancel={() => setShowCommentFor(null)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Next Week Preview */}
      {showNextWeekPreview && (
        <section>
          <div className="section-header">
            <h2>Next Week Preview</h2>
            <Link to="/planning" className="view-all-link">
              View All <span aria-hidden="true">›</span>
            </Link>
          </div>
          <div className="plan-activity-list">
            {nextWeekActivities.map((activity, index) => (
              <NextWeekPreviewCard key={activity.id} activity={activity} isFirst={index === 0} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

