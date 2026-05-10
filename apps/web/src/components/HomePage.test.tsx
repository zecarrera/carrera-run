import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VideoRecommendationPanel, HomePage } from "./HomePage";
import type { ActivityStatus, AthleteSummary, PlanActivity, TrainingPlan, VideoRecommendation } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const warmUpVideo: VideoRecommendation = {
  videoId: "warmup-1",
  title: "10-Minute Pre-Run Warm Up Routine",
  channelName: "The Run Experience",
  role: "warm-up",
};

const coolDownVideo: VideoRecommendation = {
  videoId: "cooldown-1",
  title: "Post-Run Cool Down Stretching Routine",
  channelName: "Sage Running",
  role: "cool-down",
};

const generalVideo: VideoRecommendation = {
  videoId: "general-1",
  title: "Strength Training for Runners",
  channelName: "Strength Running",
  role: "general",
};

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Expand the panel by clicking the toggle button. */
async function expandPanel(user: ReturnType<typeof userEvent.setup>) {
  const toggle = screen.getByRole("button", { name: /view recommendation/i });
  await user.click(toggle);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VideoRecommendationPanel", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders the collapsed toggle button without fetching", () => {
    render(<VideoRecommendationPanel activityType="Run" />);

    expect(screen.getByRole("button", { name: /view recommendation/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading state while fetching, then shows videos", async () => {
    let resolveFetch!: (r: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    fetchMock.mockReturnValueOnce(pendingFetch);

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);

    // Loading text visible while fetch is pending
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    // Resolve the fetch and confirm videos appear
    resolveFetch(createJsonResponse({
      recommendations: [warmUpVideo, coolDownVideo],
      remainingByRole: null,
    }));

    expect(await screen.findByText(warmUpVideo.title)).toBeInTheDocument();
    expect(screen.getByText(coolDownVideo.title)).toBeInTheDocument();
  });

  it("fetches with correct activityType and durationMinutes params", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ recommendations: [generalVideo], remainingByRole: null }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" durationMinutes={30} />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("activityType=Strength"),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("durationMinutes=30"),
      expect.any(Object),
    );
  });

  it("shows an error when fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, false));

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);

    expect(await screen.findByText("Could not load recommendation.")).toBeInTheDocument();
  });

  it("shows an error when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);

    expect(await screen.findByText("Could not load recommendation.")).toBeInTheDocument();
  });

  it("does not re-fetch when collapsed and re-expanded", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ recommendations: [generalVideo], remainingByRole: null }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    // Collapse then expand again
    await user.click(screen.getByRole("button", { name: /hide recommendation/i }));
    await user.click(screen.getByRole("button", { name: /view recommendation/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Show Different Video button (YouTube API — unlimited) ──────────────────

  it("shows a 'Show Different Video' button per card when unlimited (remainingByRole: null)", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        recommendations: [warmUpVideo, coolDownVideo],
        remainingByRole: null,
      }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);
    await screen.findByText(warmUpVideo.title);

    const buttons = screen.getAllByRole("button", { name: /show different video/i });
    expect(buttons).toHaveLength(2);
  });

  it("clicking 'Show Different Video' calls API with correct role and exclude params", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          recommendations: [warmUpVideo, coolDownVideo],
          remainingByRole: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          recommendations: [{ ...warmUpVideo, videoId: "warmup-2", title: "New Warm Up" }],
          remainingByRole: null,
        }),
      );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);
    await screen.findByText(warmUpVideo.title);

    // Click the first card's button (warm-up)
    const [warmUpBtn] = screen.getAllByRole("button", { name: /show different video/i });
    await user.click(warmUpBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const secondCall = fetchMock.mock.calls[1][0] as string;
    expect(secondCall).toContain("role=warm-up");
    expect(secondCall).toContain("exclude=warmup-1");
  });

  it("replaces only the clicked card's video on refresh", async () => {
    const newWarmUp = { ...warmUpVideo, videoId: "warmup-2", title: "New Warm Up Video" };

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          recommendations: [warmUpVideo, coolDownVideo],
          remainingByRole: null,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [newWarmUp], remainingByRole: null }),
      );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);
    await screen.findByText(warmUpVideo.title);

    const [warmUpBtn] = screen.getAllByRole("button", { name: /show different video/i });
    await user.click(warmUpBtn);

    // New warm-up appears; cool-down stays unchanged
    expect(await screen.findByText(newWarmUp.title)).toBeInTheDocument();
    expect(screen.getByText(coolDownVideo.title)).toBeInTheDocument();
  });

  // ── Counter and disabled state (curated list) ─────────────────────────────

  it("shows '1 of 3' counter when remainingByRole is 2", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        recommendations: [generalVideo],
        remainingByRole: { general: 2 },
      }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("disables button and shows exhausted text when on last recommendation", async () => {
    // total = 1 + 1 = 2; after one click page reaches 2 = total → disabled
    const video2 = { ...generalVideo, videoId: "general-2", title: "Video 2" };

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [generalVideo], remainingByRole: { general: 1 } }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [video2], remainingByRole: { general: 0 } }),
      );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    // Click once to reach page 2 of 2
    await user.click(screen.getByRole("button", { name: /show different video/i }));
    await screen.findByText(video2.title);

    const btn = screen.getByRole("button", { name: /recommendation 2 of 2/i });
    expect(btn).toBeDisabled();
  });

  it("hides the button entirely when only 1 recommendation exists", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        recommendations: [generalVideo],
        remainingByRole: { general: 0 },
      }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    // total = 1, showButton = (total > 1) = false
    expect(screen.queryByRole("button", { name: /show different video/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recommendation \d+ of \d+/i })).not.toBeInTheDocument();
  });

  it("accumulates seen IDs across multiple refreshes", async () => {
    const video2 = { ...generalVideo, videoId: "general-2", title: "Video 2" };
    const video3 = { ...generalVideo, videoId: "general-3", title: "Video 3" };

    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [generalVideo], remainingByRole: { general: 2 } }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [video2], remainingByRole: { general: 1 } }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ recommendations: [video3], remainingByRole: { general: 0 } }),
      );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Strength" />);

    await expandPanel(user);
    await screen.findByText(generalVideo.title);

    // Click 1 — sees general-1 excluded
    await user.click(screen.getByRole("button", { name: /show different video/i }));
    await screen.findByText(video2.title);
    expect(fetchMock.mock.calls[1][0] as string).toContain("exclude=general-1");

    // Click 2 — sees general-1 AND general-2 excluded
    await user.click(screen.getByRole("button", { name: /show different video/i }));
    await screen.findByText(video3.title);
    const thirdCall = fetchMock.mock.calls[2][0] as string;
    expect(thirdCall).toContain("general-1");
    expect(thirdCall).toContain("general-2");
  });

  it("shows no recommendation message when API returns empty", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ recommendations: [], remainingByRole: null }),
    );

    const user = userEvent.setup();
    render(<VideoRecommendationPanel activityType="Run" />);

    await expandPanel(user);

    expect(await screen.findByText("No recommendation available.")).toBeInTheDocument();
  });
});

// ── WeekCompleteBanner ────────────────────────────────────────────────────────

const mockSummary: AthleteSummary = {
  athlete: { id: 1, displayName: "Test Runner" },
  totals: { runs: 0, distanceKm: 0, movingTimeSeconds: 0, elevationGainMeters: 0 },
};

const today = new Date().toISOString().slice(0, 10);

function makePlan(statuses: ActivityStatus[]): TrainingPlan {
  return {
    id: "plan-1",
    userId: "user-1",
    raceName: "Test Race",
    raceDistanceKm: 42,
    startDate: today,
    endDate: today,
    status: "active",
    activities: statuses.map((status, i): PlanActivity => ({
      id: `activity-${i}`,
      date: today,
      type: "Run",
      status,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mockFetchWithPlan(plan?: TrainingPlan) {
  return vi.fn().mockImplementation((url: string) => {
    const isPlans = typeof url === "string" && url.includes("/api/plans");
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          isPlans ? { plans: plan ? [plan] : [] } : { activities: [] },
        ),
    } as unknown as Response);
  });
}

function renderHomePage(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  return render(
    <MemoryRouter>
      <HomePage summary={mockSummary} />
    </MemoryRouter>,
  );
}

describe("WeekCompleteBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is not shown when there are no activities this week", async () => {
    renderHomePage(mockFetchWithPlan(/* no plan */));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/week complete/i)).not.toBeInTheDocument();
  });

  it("is not shown when all activities are not_started", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["not_started", "not_started"])));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/week complete/i)).not.toBeInTheDocument();
  });

  it("is not shown when all activities are skipped (regression)", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["skipped", "skipped"])));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/week complete/i)).not.toBeInTheDocument();
  });

  it("is not shown when some activities are skipped and some are completed", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed", "skipped"])));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/week complete/i)).not.toBeInTheDocument();
  });

  it("is not shown when some activities remain not_started", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed", "not_started"])));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/week complete/i)).not.toBeInTheDocument();
  });

  it("is shown when all activities are completed", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed", "completed"])));
    expect(await screen.findByText(/week complete/i)).toBeInTheDocument();
  });

  it("is shown when all activities are completed_with_changes", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed_with_changes", "completed_with_changes"])));
    expect(await screen.findByText(/week complete/i)).toBeInTheDocument();
  });

  it("is shown when activities mix completed and completed_with_changes", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed", "completed_with_changes"])));
    expect(await screen.findByText(/week complete/i)).toBeInTheDocument();
  });
});

// ── Next Week Preview ─────────────────────────────────────────────────────────

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function makePlanWithNextWeek(
  thisWeekStatuses: ActivityStatus[],
  nextWeekNotes: string[],
): TrainingPlan {
  const nextMonday = getNextMonday();
  const thisWeekActivities: PlanActivity[] = thisWeekStatuses.map((status, i) => ({
    id: `this-${i}`,
    date: today,
    type: "Run",
    status,
  }));
  const nextWeekActivities: PlanActivity[] = nextWeekNotes.map((notes, i) => ({
    id: `next-${i}`,
    date: nextMonday,
    type: "Run",
    status: "not_started",
    notes,
  }));
  return {
    id: "plan-1",
    userId: "user-1",
    raceName: "Test Race",
    raceDistanceKm: 42,
    startDate: today,
    endDate: nextMonday,
    status: "active",
    activities: [...thisWeekActivities, ...nextWeekActivities],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Next Week Preview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("is not shown when the week is incomplete (on a non-Sunday)", async () => {
    // Pin to a Tuesday so isLastDayOfWeek() is false — preview must not show
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-05-05T12:00:00") });
    const plan: TrainingPlan = {
      id: "plan-1", userId: "user-1", raceName: "Test Race", raceDistanceKm: 42,
      startDate: "2026-05-05", endDate: "2026-05-11", status: "active",
      activities: [
        { id: "this-0", date: "2026-05-05", type: "Run", status: "not_started" },
        { id: "next-0", date: "2026-05-11", type: "Run", status: "not_started", notes: "Long Run" },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    renderHomePage(mockFetchWithPlan(plan));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/next week preview/i)).not.toBeInTheDocument();
  });

  it("is not shown when week is complete but there are no next-week activities", async () => {
    renderHomePage(mockFetchWithPlan(makePlan(["completed"])));
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/next week preview/i)).not.toBeInTheDocument();
  });

  it("shows the preview section when week is complete and next-week activities exist", async () => {
    const plan = makePlanWithNextWeek(["completed"], ["Easy Run"]);
    renderHomePage(mockFetchWithPlan(plan));
    expect(await screen.findByText(/next week preview/i)).toBeInTheDocument();
  });

  it("shows only the first next-week activity even when multiple exist", async () => {
    const plan = makePlanWithNextWeek(["completed"], ["Easy Run", "Tempo Run", "Long Run"]);
    renderHomePage(mockFetchWithPlan(plan));
    await screen.findByText(/next week preview/i);
    expect(screen.getByText("Easy Run")).toBeInTheDocument();
    expect(screen.queryByText("Tempo Run")).not.toBeInTheDocument();
    expect(screen.queryByText("Long Run")).not.toBeInTheDocument();
  });

  it("labels the single preview card as the first activity", async () => {
    const plan = makePlanWithNextWeek(["completed"], ["Recovery Run"]);
    renderHomePage(mockFetchWithPlan(plan));
    await screen.findByText(/next week preview/i);
    expect(screen.getByText(/first activity/i)).toBeInTheDocument();
  });
});
