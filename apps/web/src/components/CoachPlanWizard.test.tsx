import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachPlanWizard } from "./CoachPlanWizard";
import type { CoachResponse } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeCoachResponse(overrides: Partial<CoachResponse> = {}): CoachResponse {
  return {
    answer: "Great! Tell me your race goal.",
    followUpQuestions: [],
    proposedActions: [{ type: "none", reason: "Gathering information." }],
    safetyNotes: [],
    ...overrides,
  };
}

const noop = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoachPlanWizard", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    noop.mockReset();
  });

  // ── Static greeting ───────────────────────────────────────────────────────

  it("renders the static greeting immediately without making an API call", () => {
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    expect(
      screen.getByText(/tell me about your race goal/i),
    ).toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ── Example prompts ───────────────────────────────────────────────────────

  it("shows example prompts before the first message is sent", () => {
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    expect(screen.getByText(/quick start/i)).toBeInTheDocument();
    // At least the first example prompt is visible
    expect(screen.getByText(/5k race in 6 weeks/i)).toBeInTheDocument();
  });

  it("hides example prompts after the user sends a message", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ coach: makeCoachResponse() }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    const input = screen.getByPlaceholderText(/tell your coach/i);
    await user.type(input, "I want to run a 10k{Enter}");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(screen.queryByText(/quick start/i)).not.toBeInTheDocument();
  });

  it("sends the correct API request when an example prompt is clicked", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ coach: makeCoachResponse() }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    const exampleBtn = screen.getByText(/5k race in 6 weeks/i);
    await user.click(exampleBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/coach/chat");
    const body = JSON.parse(String(init.body)) as { messages: { role: string; content: string }[] };
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toMatch(/5k race in 6 weeks/i);
  });

  // ── Response rendering ────────────────────────────────────────────────────

  it("displays the coach answer in a chat bubble after a response", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ coach: makeCoachResponse({ answer: "How many days can you train?" }) }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    await user.type(screen.getByPlaceholderText(/tell your coach/i), "Hello{Enter}");

    expect(await screen.findByText("How many days can you train?")).toBeInTheDocument();
  });

  it("displays follow-up question chips after a response", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        coach: makeCoachResponse({
          answer: "What is your target finish time?",
          followUpQuestions: ["Under 30 minutes", "Around 35 minutes"],
        }),
      }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    await user.type(screen.getByPlaceholderText(/tell your coach/i), "Ready{Enter}");

    expect(await screen.findByRole("button", { name: "Under 30 minutes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Around 35 minutes" })).toBeInTheDocument();
  });

  it("sanitizes raw JSON leaked into the coach answer field", async () => {
    // Simulate the model returning a full JSON blob as the answer string
    const rawJson = JSON.stringify({
      answer: "Here is your personalised plan summary.",
      followUpQuestions: [],
      proposedActions: [{ type: "none", reason: "test" }],
      safetyNotes: [],
    });

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        coach: makeCoachResponse({ answer: rawJson }),
      }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    await user.type(screen.getByPlaceholderText(/tell your coach/i), "Hi{Enter}");

    // Should show the clean extracted text, not raw JSON
    expect(await screen.findByText("Here is your personalised plan summary.")).toBeInTheDocument();
    expect(screen.queryByText(/followUpQuestions/)).not.toBeInTheDocument();
  });

  // ── Plan proposal ─────────────────────────────────────────────────────────

  it("renders the proposed plan card when the coach returns a create_plan action", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        coach: makeCoachResponse({
          answer: "Here's your 10k plan!",
          proposedActions: [
            {
              type: "create_plan",
              reason: "All info gathered.",
              payload: {
                raceName: "City 10K",
                raceDistanceKm: 10,
                startDate: "2026-05-01",
                endDate: "2026-07-01",
                activities: [
                  { date: "2026-05-03", type: "Run", distanceKm: 5, paceMinPerKm: 6.0, notes: "Easy run" },
                ],
              },
            },
          ],
        }),
      }),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    await user.type(screen.getByPlaceholderText(/tell your coach/i), "Go{Enter}");

    expect(await screen.findByText("Proposed Plan")).toBeInTheDocument();
    expect(screen.getByText("City 10K")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Changes" })).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it("shows an error message when the API call fails", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ message: "Coach unavailable." }, false),
    );

    const user = userEvent.setup();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={noop} />);

    await user.type(screen.getByPlaceholderText(/tell your coach/i), "Hello{Enter}");

    expect(await screen.findByText("Coach unavailable.")).toBeInTheDocument();
  });

  // ── Close button ──────────────────────────────────────────────────────────

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(<CoachPlanWizard onPlanCreated={noop} onClose={onClose} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "✕" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
