function Navbar() {
  return (
    <nav className="navbar">
      <a href="/" className="navbar-logo">
        LOGO
      </a>

      <div className="navbar-links">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#how-it-works">How It Works</a>

        <a href="/signup" className="sign-in-button">
          Sign In
        </a>
      </div>
    </nav>
  );
}

export default Navbar;