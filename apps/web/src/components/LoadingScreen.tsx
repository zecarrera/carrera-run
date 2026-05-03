import type { CSSProperties } from "react";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
  return (
    <main className="loading-screen" aria-label={`${message}…`} aria-live="polite">
      <div className="loading-runner-wrap">
        <img
          src="/loading-run-stick-man.gif"
          alt=""
          aria-hidden="true"
          className="loading-runner-gif"
          width="320"
          height="240"
        />
      </div>

      <p className="loading-text">
        {message}
        <span className="loading-dot" style={{ "--dot-delay": "0s" } as CSSProperties}>.</span>
        <span className="loading-dot" style={{ "--dot-delay": "0.2s" } as CSSProperties}>.</span>
        <span className="loading-dot" style={{ "--dot-delay": "0.4s" } as CSSProperties}>.</span>
      </p>
    </main>
  );
}
