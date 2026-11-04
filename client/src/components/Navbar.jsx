
import { useState, useEffect } from "react";

function Navbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.reload();
  };

  return (
    <nav className="navbar">
      <a href="/#home" className="navbar-logo">
        LOGO
      </a>

      <div className="navbar-links">
        <a href="/#home">Home</a>
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
