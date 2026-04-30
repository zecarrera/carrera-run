import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ActivitiesPage } from "./components/ActivitiesPage";
import { LoadingScreen } from "./components/LoadingScreen";
import { Navigation } from "./components/Navigation";
import { HomePage } from "./components/HomePage";
import { PlanningPage } from "./components/PlanningPage";
import { ProfilePage } from "./components/ProfilePage";
import type { AthleteSummary } from "./types";
import "./styles.css";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function App() {
  const [summary, setSummary] = useState<AthleteSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setState("loading");
        setErrorMessage(null);

        const summaryResponse = await fetch("/api/athlete/summary", { credentials: "include" });

        if (summaryResponse.status === 401) {
          setState("idle");
          return;
        }

        if (!summaryResponse.ok) {
          throw new Error("Unable to load Strava data.");
        }

        const summaryPayload = (await summaryResponse.json()) as { summary: AthleteSummary };
        setSummary(summaryPayload.summary);
        setState("ready");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load data.");
        setState("error");
      }
    };

    void load();
  }, []);

  if (state === "idle") {
    return (
      <main className="shell auth-shell">
        <section className="hero-card">
          <img src="/logo.png" alt="Carrera Run logo" className="hero-logo" />
          <p className="eyebrow">Strava dashboard</p>
          <h1>Connect your runs and review every session in one place.</h1>
          <p>
            Sign in with Strava to load your running history, totals, and recent activity details.
          </p>
          <a className="button-primary" href="/api/auth/strava/login">
            Connect with Strava
          </a>
        </section>
      </main>
    );
  }

  if (state === "loading") {
    return <LoadingScreen message="Loading your activities" />;
  }

  if (state === "error") {
    return (
      <main className="shell centered-state">
        <p>{errorMessage}</p>
        <a className="button-secondary" href="/api/auth/strava/login">
          Retry with Strava
        </a>
      </main>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navigation />
        <div className="app-main">
          <Routes>
            <Route path="/" element={<HomePage summary={summary} />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/profile" element={<ProfilePage summary={summary} />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
