import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import type { UserProfile } from "../types";

const profileFixture: UserProfile = {
  id: "profile-1",
  userId: "athlete-1",
  trainingZones: {
    Z1: { fromSecondsPerKm: 360, toSecondsPerKm: 390 },
    Z2: { fromSecondsPerKm: 330, toSecondsPerKm: 359 },
    Z3: { fromSecondsPerKm: 300, toSecondsPerKm: 329 },
    Z4: { fromSecondsPerKm: 280, toSecondsPerKm: 299 },
    Z5: { fromSecondsPerKm: 240, toSecondsPerKm: 279 },
  },
  raceResults: [],
  preferredChannels: [],
  allowOtherChannels: true,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

function createJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("ProfilePage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("saves valid training zones", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }))
      .mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));

    const user = userEvent.setup();
    render(<ProfilePage />);

    // Wait for page to load then open configure form
    await screen.findByRole("button", { name: "Configure" });
    await user.click(screen.getByRole("button", { name: "Configure" }));

    const z1FromInput = screen.getByLabelText("Z1 from pace");
    await user.clear(z1FromInput);
    await user.type(z1FromInput, "6:30");
    await user.click(screen.getByRole("button", { name: "Save zones" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/profile/zones",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"from":"6:30"'),
      }),
    );
    expect(await screen.findByText("Training zones saved.")).toBeInTheDocument();
  });

  it("shows a validation error for invalid pace format before submitting", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));

    const user = userEvent.setup();
    render(<ProfilePage />);

    // Wait for page to load then open configure form
    await screen.findByRole("button", { name: "Configure" });
    await user.click(screen.getByRole("button", { name: "Configure" }));

    const z1FromInput = screen.getByLabelText("Z1 from pace");
    await user.clear(z1FromInput);
    await user.type(z1FromInput, "6:3");
    await user.click(screen.getByRole("button", { name: "Save zones" }));

    expect(await screen.findByText("Z1 pace must use mm:ss format, for example 6:30.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds race result with valid time format", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }))
      .mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));

    const user = userEvent.setup();
    render(<ProfilePage />);

    // Wait for page to load then open add race form
    await screen.findByRole("button", { name: "Add Race" });
    await user.click(screen.getByRole("button", { name: "Add Race" }));

    await user.type(screen.getByLabelText("Race title"), "10K Test");
    await user.type(screen.getByLabelText("Distance (km)"), "10");
    await user.type(screen.getByLabelText("Date"), "2026-03-20");
    await user.type(screen.getByLabelText("Race result time"), "42:30");
    const addRaceResultButton = screen.getByRole("button", { name: "Add race result" });
    const addRaceResultForm = addRaceResultButton.closest("form");
    expect(addRaceResultForm).not.toBeNull();
    fireEvent.submit(addRaceResultForm!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/profile/race-results",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"time":"42:30"'),
      }),
    );
    expect(await screen.findByText("Race result added.")).toBeInTheDocument();
  });

  it("shows a validation error for invalid race result time before submitting", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));

    const user = userEvent.setup();
    render(<ProfilePage />);

    // Wait for page to load then open add race form
    await screen.findByRole("button", { name: "Add Race" });
    await user.click(screen.getByRole("button", { name: "Add Race" }));

    await user.type(screen.getByLabelText("Race title"), "10K Test");
    await user.type(screen.getByLabelText("Distance (km)"), "10");
    await user.type(screen.getByLabelText("Date"), "2026-03-20");
    await user.type(screen.getByLabelText("Race result time"), "42:3");
    const addRaceResultButton = screen.getByRole("button", { name: "Add race result" });
    const addRaceResultForm = addRaceResultButton.closest("form");
    expect(addRaceResultForm).not.toBeNull();
    fireEvent.submit(addRaceResultForm!);

    expect(
      await screen.findByText("Race time must use mm:ss or hh:mm:ss format, for example 42:30 or 1:42:30."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Video channel management ─────────────────────────────────────────────

  it("shows the Video Recommendations section with channel input", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));
    render(<ProfilePage />);
    expect(await screen.findByText("Video Recommendations")).toBeInTheDocument();
    expect(screen.getByLabelText("Channel name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
  });

  it("loads existing preferred channels from profile", async () => {
    const profileWithChannels: UserProfile = {
      ...profileFixture,
      preferredChannels: ["The Run Experience", "Sage Running"],
    };
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileWithChannels }));
    render(<ProfilePage />);
    expect(await screen.findByText("The Run Experience")).toBeInTheDocument();
    expect(screen.getByText("Sage Running")).toBeInTheDocument();
  });

  it("adds a channel and shows it in the list", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }));
    const user = userEvent.setup();
    render(<ProfilePage />);
    await screen.findByText("Video Recommendations");

    const input = screen.getByLabelText("Channel name");
    await user.type(input, "Global Triathlon Network");
    await user.click(screen.getByRole("button", { name: "+ Add" }));

    expect(screen.getByText("Global Triathlon Network")).toBeInTheDocument();
    expect(input).toHaveValue(""); // input cleared after add
  });

  it("removes a channel from the list", async () => {
    const profileWithChannels: UserProfile = {
      ...profileFixture,
      preferredChannels: ["The Run Experience"],
    };
    fetchMock.mockResolvedValueOnce(createJsonResponse({ profile: profileWithChannels }));
    const user = userEvent.setup();
    render(<ProfilePage />);
    await screen.findByText("The Run Experience");

    await user.click(screen.getByRole("button", { name: "Remove The Run Experience" }));
    expect(screen.queryByText("The Run Experience")).not.toBeInTheDocument();
  });

  it("saves channel preferences via PUT /api/profile/video-channels", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ profile: profileFixture }))
      .mockResolvedValueOnce(createJsonResponse({ profile: { ...profileFixture, preferredChannels: ["Sage Running"] } }));

    const user = userEvent.setup();
    render(<ProfilePage />);
    await screen.findByText("Video Recommendations");

    // Add a channel then save
    await user.type(screen.getByLabelText("Channel name"), "Sage Running");
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall[0]).toBe("/api/profile/video-channels");
    const body = JSON.parse(String((saveCall[1] as RequestInit).body)) as {
      preferredChannels: string[];
      allowOtherChannels: boolean;
    };
    expect(body.preferredChannels).toContain("Sage Running");
    expect(typeof body.allowOtherChannels).toBe("boolean");
    expect(await screen.findByText("Video preferences saved.")).toBeInTheDocument();
  });
});