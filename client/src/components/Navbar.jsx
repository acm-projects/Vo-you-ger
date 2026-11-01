
import { useState } from "react";
import { clearPlanningSession, paths } from "../services/navigation";

function Navbar() {
  const [user] = useState(() => {
    try {
      return localStorage.getItem("token") ? JSON.parse(localStorage.getItem("user") || "null") : null;
    } catch {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("quizResponse");
    clearPlanningSession(sessionStorage);
    window.location.href = paths.landing;
  };

  return (
    <nav className="navbar">
      <a href={user ? paths.globe : "/#home"} className="navbar-logo">
        LOGO
      </a>

      <div className="navbar-links">
        <a href={user ? paths.globe : "/#home"}>Home</a>
        <a href="/#about">About</a>
        <a href="/#how-it-works">How It Works</a>

        {user ? (
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <span>Hi, {user.fName}!</span>
            <button onClick={handleLogout} className="sign-in-button">
              Logout
            </button>
          </div>
        ) : (
          <a
            href="/signUpAndLogin/login.html"
            className="sign-in-button"
          >
            Sign In
          </a>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
