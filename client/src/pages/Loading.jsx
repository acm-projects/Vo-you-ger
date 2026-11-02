// client/src/pages/Loading.jsx
// Dedicated full-screen loading component featuring a rotating globe animation and rotating fun facts.
// Used both during initial recommendation generation after the quiz and during itinerary generation after country selection.

import { useEffect, useState } from "react";
import "./Loading.css";

import globeImage from "../../loading/globe (2).png";
import lightbulbImage from "../../loading/lightbulb-removebg-preview.png";

// Curated collection of global travel trivia cycled while waiting for AI generation
const facts = [
  "Chewing gum is heavily restricted in Singapore, with exceptions for approved dental and medicinal gum.",
  "Japan has vending machines that sell everything from drinks to hot meals.",
  "Canada has more lakes than any other country in the world.",
  "The Eiffel Tower can grow slightly taller during hot weather.",
  "Iceland has no native mosquito population."
];

/**
 * Loading component rendered during asynchronous AI calls.
 * 
 * Props:
 * - error: Optional string error message if API call fails.
 * - onRetry: Callback to trigger the failed operation again.
 * - backLink: Target URL for the navigation escape button (defaults to Quiz, configurable for Recommendations).
 * - backText: Label for the navigation escape button (defaults to "Back to Quiz").
 */
function Loading({ error, onRetry, backLink = "/Assessments/assessments.html", backText = "Back to Quiz" }) {
  // Step 1: Track index of currently displayed travel fun fact
  const [currentFact, setCurrentFact] = useState(0);

  // Step 2: Set up a 5-second interval timer to smoothly cycle through travel trivia
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFact((previousFact) => (previousFact + 1) % facts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="loading-page">
      <div className="loading-container">
        {/* Step 3: Spinning globe graphic demonstrating active background processing */}
        <div className="globe-container">
          <img
            src={globeImage}
            alt="Spinning globe"
            className="globe-image"
          />
        </div>

        {/* Step 4: Card presenting rotating fun facts to keep the user engaged */}
        <section className="funFact-card">
          <div className="card-content">
            <img
              src={lightbulbImage}
              alt="Lightbulb"
              className="lightbulb-image"
            />

            <div className="text-content">
              <h2>Fun Fact:</h2>
              <p key={currentFact}>{facts[currentFact]}</p>
            </div>
          </div>
        </section>

        {/* Step 5: Graceful error overlay offering Retry and Back navigation options if API fails */}
        {error && (
          <div
            className="loading-error-box"
            style={{
              position: "absolute",
              top: "580px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              padding: "16px 20px",
              background: "#fffaf0",
              border: "1px solid #e6d7bd",
              borderRadius: "12px",
              textAlign: "center",
              width: "min(90%, 460px)",
              boxShadow: "0 8px 24px rgba(70, 55, 47, 0.12)",
            }}
          >
            <p style={{ color: "#b2533e", fontWeight: "600", margin: "0 0 14px" }}>
              {error}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "#5c4033",
                    color: "#fff",
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Try Again
                </button>
              )}
              <a
                href={backLink}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#e9dfcd",
                  color: "#46372f",
                  textDecoration: "none",
                  fontWeight: "600",
                }}
              >
                {backText}
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default Loading;