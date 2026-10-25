
import { useState } from "react";

const destinations = [
  {
    id: 1,
    name: "Amalfi Coast",
    location: "POSITANO, ITALY",
    category: "EUROPEAN GETAWAY",
    description:
      "Colorful cliffside villages, crystal-clear waters, and unforgettable views. The Amalfi Coast is a dream for food lovers, explorers, and romantics alike.",
    image:
      "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: 2,
    name: "The Bahamas",
    location: "NASSAU, BAHAMAS",
    category: "CARIBBEAN ESCAPE",
    description:
      "Discover turquoise waters, peaceful beaches, and colorful island towns perfect for a relaxing getaway.",
    image:
      "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1400&q=85",
  },
  {
    id: 3,
    name: "Hawaii",
    location: "MAUI, HAWAII",
    category: "PACIFIC PARADISE",
    description:
      "Explore lush tropical landscapes, scenic coastlines, and unforgettable outdoor adventures.",
    image:
      "https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=1400&q=85",
  },
];

function Recommendations() {
  const [index, setIndex] = useState(0);

  const destination = destinations[index];

  function showPreviousPick() {
    setIndex(
      (current) =>
        (current - 1 + destinations.length) % destinations.length
    );
  }

  function showNextPick() {
    setIndex(
      (current) => (current + 1) % destinations.length
    );
  }

  function createItinerary() {
    window.location.href = "/ItineraryNew/itenNew.html";
  }

  return (
    <main className="postcard-page">
      <nav className="postcard-nav"></nav>

      <section className="postcard-intro">
        <div>
          <p className="postcard-eyebrow">CURATED FOR YOU</p>
          <h1>Your Next Destination</h1>
          <p>Recommended places to begin your next adventure.</p>
        </div>

        <button
          className="postcard-refresh"
          onClick={showNextPick}
        >
          ↻ &nbsp; View New Picks
        </button>
      </section>

      <section className="postcard-layout">
        <button
          type="button"
          className="postcard-arrow postcard-arrow--left"
          onClick={showPreviousPick}
          aria-label="Previous destination"
          title="Previous destination"
        >
          &#10094;
        </button>

        <article className="travel-postcard">
          <div className="travel-postcard__photo">
            <img
              src={destination.image}
              alt={destination.name}
            />

            <span className="travel-postcard__category">
              {destination.category}
            </span>
          </div>

          <div className="travel-postcard__details">
            <div className="postcard-stamp" aria-hidden="true">
              ✈
            </div>

            <p className="postcard-eyebrow">
              {destination.location}
            </p>

            <h2>{destination.name}</h2>

            <p className="travel-postcard__description">
              {destination.description}
            </p>

            <div className="postcard-divider" />

            <div className="postcard-actions">
              <button
                className="postcard-save"
                onClick={createItinerary}
              >
                Create Itinerary
              </button>

              <div className="discover-more-wrapper">
                <button className="postcard-details-button">
                  Discover More <span>✦</span>
                </button>

                <div className="discover-more-popup">
                  <h3>Explore This Destination</h3>
                  <p>More destination info will be added later.</p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <button
          type="button"
          className="postcard-arrow postcard-arrow--right"
          onClick={showNextPick}
          aria-label="Next destination"
          title="Next destination"
        >
          &#10095;
        </button>
      </section>

      <div className="postcard-pagination">
        {destinations.map((item, itemIndex) => (
          <button
            key={item.id}
            className={itemIndex === index ? "active" : ""}
            onClick={() => setIndex(itemIndex)}
            aria-label={`Show ${item.name}`}
            aria-current={itemIndex === index ? "true" : undefined}
          />
        ))}
      </div>
    </main>
  );
}

export default Recommendations;
