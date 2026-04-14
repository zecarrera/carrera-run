import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanningPage } from "./PlanningPage";
import type { TrainingPlan } from "../types";

const createdPlanFixture: TrainingPlan = {
  id: "plan-1",
  userId: "athlete-1",
  raceName: "Spring Marathon",
  raceDistanceKm: 42.2,
  startDate: "2026-04-01",
  endDate: "2026-08-01",
  status: "upcoming",
  activities: [],
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("PlanningPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("creates a plan successfully", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ plans: [] }))
      .mockResolvedValueOnce(createJsonResponse({ plan: createdPlanFixture }));

    const user = userEvent.setup();
    render(<PlanningPage />);

    await screen.findByText("Build your training plan.");

    await user.type(screen.getByLabelText("Race name"), "  Spring Marathon  ");
    await user.type(screen.getByLabelText("Race distance (km)"), "42.2");
    await user.type(screen.getByLabelText("Start date"), "2026-04-01");
    await user.type(screen.getByLabelText("Race date (end date)"), "2026-08-01");

    const createPlanButton = screen.getByRole("button", { name: "Create plan" });
    const createPlanForm = createPlanButton.closest("form");
    expect(createPlanForm).not.toBeNull();
    fireEvent.submit(createPlanForm!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe("/api/plans");

    const init = postCall[1] as RequestInit;
    expect(init.method).toBe("POST");

    const body = JSON.parse(String(init.body)) as {
      raceName: string;
      raceDistanceKm: number;
      startDate: string;
      endDate: string;
    };

    expect(body).toEqual({
      raceName: "Spring Marathon",
      raceDistanceKm: 42.2,
      startDate: "2026-04-01",
      endDate: "2026-08-01",
    });

    expect(await screen.findByText("Training plan created.")).toBeInTheDocument();
    expect(await screen.findByText("Spring Marathon")).toBeInTheDocument();
  });

  it("shows backend error when plan creation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ plans: [] }))
      .mockResolvedValueOnce(createJsonResponse({ message: "Race date must be after start date." }, false));

    const user = userEvent.setup();
    render(<PlanningPage />);

    await screen.findByText("Build your training plan.");

    await user.type(screen.getByLabelText("Race name"), "Spring Marathon");
    await user.type(screen.getByLabelText("Race distance (km)"), "42.2");
    await user.type(screen.getByLabelText("Start date"), "2026-08-01");
    await user.type(screen.getByLabelText("Race date (end date)"), "2026-04-01");

    const createPlanButton = screen.getByRole("button", { name: "Create plan" });
    const createPlanForm = createPlanButton.closest("form");
    expect(createPlanForm).not.toBeNull();
    fireEvent.submit(createPlanForm!);

    expect(await screen.findByText("Race date must be after start date.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── Import plan ───────────────────────────────────────────────────────────

  it("shows the import button on the page", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ plans: [] }));
    render(<PlanningPage />);
    await screen.findByText("Build your training plan.");
    expect(screen.getByRole("button", { name: /import json/i })).toBeInTheDocument();
  });

  it("imports a plan successfully from a JSON file", async () => {
    const importedPlan: TrainingPlan = {
      ...createdPlanFixture,
      id: "plan-imported",
      raceName: "Imported Marathon",
    };

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ plans: [] }))
      .mockResolvedValueOnce(createJsonResponse({ plan: importedPlan }));

    render(<PlanningPage />);
    await screen.findByText("Build your training plan.");

    const jsonContent = JSON.stringify({
      raceName: "Imported Marathon",
      raceDistanceKm: 42.2,
      startDate: "2026-04-01",
      endDate: "2026-08-01",
      activities: [],
    });
    const file = new File([jsonContent], "plan.json", { type: "application/json" });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText(/imported successfully/i)).toBeInTheDocument();
    expect(screen.getByText("Imported Marathon")).toBeInTheDocument();

    const importCall = fetchMock.mock.calls[1];
    expect(importCall[0]).toBe("/api/plans/import");
    expect((importCall[1] as RequestInit).method).toBe("POST");
  });

  it("shows an error when the imported file is not valid JSON", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ plans: [] }));
    render(<PlanningPage />);
    await screen.findByText("Build your training plan.");

    const file = new File(["not json at all"], "bad.json", { type: "application/json" });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText(/valid JSON/i)).toBeInTheDocument();
  });

  it("shows an error when the imported JSON is missing required fields", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ plans: [] }));
    render(<PlanningPage />);
    await screen.findByText("Build your training plan.");

    const file = new File(['{"raceName":"Test"}'], "incomplete.json", { type: "application/json" });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText(/invalid import file/i)).toBeInTheDocument();
  });

  it("shows server error when the import API rejects the file", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ plans: [] }))
      .mockResolvedValueOnce(createJsonResponse({ message: "User can only have one active plan at a time." }, false));

    render(<PlanningPage />);
    await screen.findByText("Build your training plan.");

    const jsonContent = JSON.stringify({
      raceName: "Conflicting Marathon",
      raceDistanceKm: 42.2,
      startDate: "2026-04-01",
      endDate: "2026-08-01",
      activities: [],
    });
    const file = new File([jsonContent], "plan.json", { type: "application/json" });
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(fileInput, file);

    expect(await screen.findByText("User can only have one active plan at a time.")).toBeInTheDocument();
  });
});
