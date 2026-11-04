
function Hero() {
  return (
    <section className="hero-section" id="home">
      <div className="hero-content">
        <h1>
          Your next adventure
          <br />
          starts here.
        </h1>

        <p>
          Vo(you)ger builds itineraries personalized to you.
          Just tell us your preferences and how you like to
          travel. We’ll do the rest!
        </p>

        <a
          href="/signUpAndLogin/signup.html"
          className="primary-button"
        >
          Build My Itinerary
          <svg
            className="button-arrow-icon"
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>

      <div className="hero-photos">
        <div className="polaroid polaroid-back">
          <img
            className="travel-photo"
            src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=700&q=85"
            alt="Colorful Italian coastal village"
          />
        </div>

        <div className="polaroid polaroid-front">
          <img
            className="travel-photo"
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=700&q=85"
            alt="Beautiful mountain lake surrounded by the Alps"
          />
        </div>
      </div>
    </section>
  );
}

export default Hero;
