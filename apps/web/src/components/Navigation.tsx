import { NavLink } from "react-router-dom";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.75L12 3l9 6.75V21a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function PlansIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: <HomeIcon />, end: true },
  { to: "/planning", label: "Plans", icon: <PlansIcon /> },
  { to: "/activities", label: "Activities", icon: <ActivityIcon /> },
  { to: "/profile", label: "Profile", icon: <ProfileIcon /> },
];

export function Navigation() {
  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="app-sidebar">
        <NavLink to="/" className="sidebar-logo">
          <img src="/logo.png" alt="Carrera Run" />
          <span>Carrera Run</span>
        </NavLink>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <form action="/api/auth/logout" method="post">
            <button type="submit">Disconnect</button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="mobile-header">
        <NavLink to="/" className="mobile-logo">
          <img src="/logo.png" alt="Carrera Run" />
          <span>Carrera Run</span>
        </NavLink>
        {/* Hamburger — visual only for now, bottom tabs handle nav on mobile */}
        <button type="button" className="mobile-menu-btn" aria-label="Menu">
          ☰
        </button>
      </header>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <div className="bottom-tab-bar">
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `bottom-tab-link${isActive ? " active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
