function AboutVoyager() {
  const benefits = [
    {
      icon: "🧭",
      title: "Personalized",
      text: "for you",
    },
    {
      icon: "✨",
      title: "Discover",
      text: "new places",
    },
    {
      icon: "❤️",
      title: "Make the most",
      text: "of your budget",
    },
    {
      icon: "⛰️",
      title: "Real experiences",
      text: "not just tourist traps",
    },
  ];

  return (
    <section className="about-section" id="about">
      <div className="about-image">
        <div className="mountain-placeholder">
          Travel Photo
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
              <span>{benefit.icon}</span>

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