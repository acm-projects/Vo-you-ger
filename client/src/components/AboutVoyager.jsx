function AboutVoyager() {
  const benefits = [
    {
      title: "Personalized",
      text: "for you",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          {/* Outer compass ring */}
          <circle cx="24" cy="24" r="17" />

          {/* Inner ring */}
          <circle cx="24" cy="24" r="13" />

          {/* Compass needle */}
          <path d="M30 17L26 26L18 31L22 22L30 17Z" />

          {/* Center point */}
          <circle cx="24" cy="24" r="1.5" />

          {/* Cardinal direction marks */}
          <path d="M24 4V7" />
          <path d="M24 41V44" />
          <path d="M4 24H7" />
          <path d="M41 24H44" />
        </svg>
      ),
    },
    {
      title: "Discover",
      text: "new places",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 5c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14Z" />
          <circle cx="24" cy="19" r="5" />
        </svg>
      ),
    },
    {
      title: "Make the most",
      text: "of your budget",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          {/* Coin outline */}
          <circle cx="24" cy="24" r="17" />

          {/* Inner decorative ring */}
          <circle cx="24" cy="24" r="13" />

          {/* Dollar sign */}
          <path d="M29 17.5c-1.1-1.2-2.7-1.8-4.6-1.8-2.7 0-4.5 1.4-4.5 3.4 0 2.2 2 3.1 4.5 3.9s4.6 1.7 4.6 4c0 2.2-2 3.7-4.8 3.7-1.9 0-3.7-.7-5-2" />

          {/* Dollar sign stem */}
          <path d="M24 13.5v21" />
        </svg>
      ),
    },
    {
      title: "Real experiences",
      text: "not just tourist traps",
      icon: (
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="m4 39 13-22 9 13 6-9 12 18H4Z" />
          <path d="m12 26 5 5 5-2M4 42h40" />
          <path d="m34 4 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="about-section" id="about">
      <div className="about-image">
        <div className="mountain-photo-frame">
          <img
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85"
            alt="Dramatic mountain peaks surrounded by nature"
          />
        </div>
      </div>

      <div className="about-content">
        <h2>
          Built for curious
          <br />
          explorers.
        </h2>

        <p>
          Voyouger was created for people who want more than
          just a vacation - they want an experience. We combine
          your preferences with smart technology to create
          itineraries that feel personal, authentic, and
          unforgettable.
        </p>

        <div className="benefits">
          {benefits.map((benefit) => (
            <div className="benefit" key={benefit.title}>
              <span className="benefit-icon">{benefit.icon}</span>
              <strong>{benefit.title}</strong>
              <small>{benefit.text}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default AboutVoyager;