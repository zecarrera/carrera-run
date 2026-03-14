import { NavLink } from "react-router-dom";

export function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <NavLink to="/" className="header-logo">
          <img src="/logo.png" alt="Carrera Run" />
        </NavLink>
        <nav className="header-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Activities
          </NavLink>
          <NavLink
            to="/planning"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Planning
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Profile
          </NavLink>
        </nav>
        <form action="/api/auth/logout" method="post">
          <button className="button-secondary" type="submit">
            Disconnect
          </button>
        </form>
      </div>
    </header>
  );
}
