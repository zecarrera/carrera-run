import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./LoadingScreen";

describe("LoadingScreen", () => {
  it("renders with default message", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Loading…");
  });

  it("renders with custom message", () => {
    render(<LoadingScreen message="Loading your activities" />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-label", "Loading your activities…");
  });

  it("renders the loading text", () => {
    render(<LoadingScreen message="Loading" />);
    const main = screen.getByRole("main");
    expect(main.textContent).toContain("Loading");
  });
});
