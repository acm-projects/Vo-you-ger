import { useEffect, useState } from "react";
import "./Loading.css";

import globeImage from "../../loading/globe (2).png";
import lightbulbImage from "../../loading/lightbulb-removebg-preview.png";

const facts = [
  "Chewing gum is heavily restricted in Singapore, with exceptions for approved dental and medicinal gum.",
  "Japan has vending machines that sell everything from drinks to hot meals.",
  "Canada has more lakes than any other country in the world.",
  "The Eiffel Tower can grow slightly taller during hot weather.",
  "Iceland has no native mosquito population."
];

function Loading({ error, onRetry }) {
  const [currentFact, setCurrentFact] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFact((previousFact) => (previousFact + 1) % facts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="loading-page">
      <div className="loading-container">
        <div className="globe-container">
          <img
            src={globeImage}
            alt="Spinning globe"
            className="globe-image"
          />
        </div>

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
                href="/Assessments/assessments.html"
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#e9dfcd",
                  color: "#46372f",
                  textDecoration: "none",
                  fontWeight: "600",
                }}
              >
                Back to Quiz
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default Loading;