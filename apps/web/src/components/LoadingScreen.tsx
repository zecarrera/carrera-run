import type { CSSProperties } from "react";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
  return (
    <main className="loading-screen" aria-label={`${message}…`} aria-live="polite">
      <img src="/logo.png" alt="Carrera Run" className="loading-logo" />

      <div className="loading-runner-wrap">
        {/* Runner silhouette — mid-stride, leaning forward */}
        <svg
          className="loading-runner"
          viewBox="0 0 60 80"
          width="72"
          height="96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="43" cy="8" r="7" fill="#fc5200" />
          <path d="M41 15 L33 40" stroke="#fc5200" strokeWidth="5" strokeLinecap="round" />
          {/* Arms */}
          <path d="M37 24 L22 33" stroke="#fc5200" strokeWidth="4" strokeLinecap="round" />
          <path d="M37 24 L50 17" stroke="#fc5200" strokeWidth="4" strokeLinecap="round" />
          {/* Leading leg */}
          <path d="M33 40 L20 57" stroke="#fc5200" strokeWidth="5" strokeLinecap="round" />
          <path d="M20 57 L12 72" stroke="#fc5200" strokeWidth="5" strokeLinecap="round" />
          {/* Trailing leg */}
          <path d="M33 40 L44 54" stroke="#fc5200" strokeWidth="5" strokeLinecap="round" />
          <path d="M44 54 L53 64" stroke="#fc5200" strokeWidth="5" strokeLinecap="round" />
        </svg>

        {/* Ground shadow that compresses when the runner is "airborne" */}
        <div className="loading-shadow" aria-hidden="true" />
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
