function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Take the Assessment",
      description:
        "Tell us about your travel style, budget, interests, and more.",
      icon: "📋",
    },
    {
      number: "2",
      title: "Let AI Work",
      description:
        "We analyze your preferences and find the best destinations, experiences, and activities for you.",
      icon: "✨",
    },
    {
      number: "3",
      title: "Get Your Itinerary",
      description:
        "Receive a personalized, day-by-day plan with places to stay, things to do, and local tips.",
      icon: "🗺️",
    },
  ];

  return (
    <section className="how-section" id="how-it-works">
      <div className="section-heading">
        <h2>
          Your dream trip,
          <br />
          made simple.
        </h2>

        <p>
          Answer a few quick questions, and let our AI
          craft a personalized itinerary just for you.
        </p>
      </div>

      <div className="steps">
        {steps.map((step, index) => (
          <div className="step" key={step.number}>
            <div className="step-number">
              {step.number}
            </div>

            <div className="step-icon">
              {step.icon}
            </div>

            <h3>{step.title}</h3>

            <p>{step.description}</p>

            {index < steps.length - 1 && (
              <div className="step-arrow">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;