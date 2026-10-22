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

function Loading() {
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
      </div>
    </main>
  );
}

export default Loading;