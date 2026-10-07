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

        <a href="/signup" className="primary-button">
          Build My Itinerary
          <span>→</span>
        </a>
      </div>

      <div className="hero-photos">
        <div className="polaroid polaroid-back">
          <div className="photo-placeholder">
            Photo 2
          </div>
        </div>

        <div className="polaroid polaroid-front">
          <div className="photo-placeholder">
            Photo 1
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
