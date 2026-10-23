import React from "react";

function HowItWorks() {
  const steps = [
    {
      className: "step-one",
      number: "1",
      title: "Take the Assessment",
      description:
        "Tell us about your travel style, budget, interests, and more.",
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M22 12V8.5A3.5 3.5 0 0 1 25.5 5h13A3.5 3.5 0 0 1 42 8.5V12" />
          <rect x="11" y="12" width="42" height="47" rx="4" />
          <path d="M19 25l3.5 3.5L29 21" />
          <path d="M33 25h12" />
          <path d="M19 38l3.5 3.5L29 34" />
          <path d="M33 38h12" />
          <path d="M19 50l3.5 3.5L29 46" />
          <path d="M33 50h12" />
        </svg>
      ),
    },
    {
      className: "step-two",
      number: "2",
      title: "Let AI Work",
      description:
        "We analyze your preferences and find the best destinations, experiences, and activities for you.",
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M32 5l4.2 13.1L49 22.5l-12.8 4.2L32 40l-4.2-13.3L15 22.5l12.8-4.4Z" />
          <path d="M49 37l2.2 6.8L58 46l-6.8 2.2L49 55l-2.2-6.8L40 46l6.8-2.2Z" />
          <path d="M12 37l1.5 4.5L18 43l-4.5 1.5L12 49l-1.5-4.5L6 43l4.5-1.5Z" />
        </svg>
      ),
    },
    {
      className: "step-three",
      number: "3",
      title: "Get Your Itinerary",
      description:
        "Receive a personalized, day-by-day plan with places to stay, things to do, and local tips.",
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M7 22l16-7 18 6 16-7v34l-16 7-18-6-16 7Z" />
          <path d="M23 15v34M41 21v34" />
          <path d="M32 7a9 9 0 0 0-9 9c0 7 9 17 9 17s9-10 9-17a9 9 0 0 0-9-9Z" />
          <circle cx="32" cy="16" r="3" />
        </svg>
      ),
    },
  ];

  return (
    <section className="how-section" id="how-it-works">
      <div className="section-heading">
        <span className="section-eyebrow">HOW IT WORKS</span>
        <h2>Your dream trip, made simple.</h2>
        <p>
          Answer a few quick questions, and let our AI craft a personalized
          itinerary just for you.
        </p>
      </div>

      <div className="steps">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <article className={`step ${step.className}`}>
              <div className="step-number">{step.number}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
            {index < steps.length - 1 && (
              <div
                className={`step-arrow step-arrow-${index === 0 ? "one" : "two"}`}
                aria-hidden="true"
              >
                <span>→</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;
