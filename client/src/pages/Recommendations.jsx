
import { useState, useMemo } from "react";

const fallbackDestinations = [
  {
    destinationId: "country-it",
    name: "Italy",
    country: "Italy",
    countryCode: "IT",
    location: "POSITANO & ROME, ITALY",
    category: "EUROPEAN GETAWAY",
    reason:
      "A culinary and cultural wonderland, Italy offers legendary flavors from handmade cacio e pepe to crisp wood-fired Neapolitan pizza. And while you're not savoring local trattorias, immerse yourself in world-renowned Renaissance art, dramatic cliffside coastal views, and ancient Roman history.",
    imageUrl:
      "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?auto=format&fit=crop&w=1400&q=85",
  },
  {
    destinationId: "country-my",
    name: "Malaysia",
    country: "Malaysia",
    countryCode: "MY",
    location: "KUALA LUMPUR & PENANG, MALAYSIA",
    category: "SOUTHEAST ASIAN GEM",
    reason:
      "A foodie's paradise, Malaysia offers a unique, tasty blend of cuisines owing to its rich history. And while you're not gorging on delicious Hainanese chicken rice, feel free to enjoy the rich colonial history and breathtaking sceneries that make up this highly budget-friendly country.",
    imageUrl:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Kuala_Lumpur_Skyline_at_Dusk.jpg/1280px-Kuala_Lumpur_Skyline_at_Dusk.jpg",
  },
  {
    destinationId: "country-jp",
    name: "Japan",
    country: "Japan",
    countryCode: "JP",
    location: "TOKYO & KYOTO, JAPAN",
    category: "PACIFIC PARADISE",
    reason:
      "Renowned for unmatched culinary craftsmanship, Japan invites you to savor steaming bowls of rich tonkotsu ramen and delicate matcha treats. Between meals, marvel at the contrast of hyper-modern neon skylines and serene thousand-year-old Shinto shrines connected by effortless bullet trains.",
    imageUrl:
      "https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=1400&q=85",
  },
];

function Recommendations({ recommendations: propRecs, trip: propTrip, onRefreshPicks }) {
  const [index, setIndex] = useState(0);

  const destinationsList = useMemo(() => {
    if (Array.isArray(propRecs) && propRecs.length > 0) {
      return propRecs;
    }
    try {
      const cached = sessionStorage.getItem("voyager_recommendations");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read cached recommendations:", e);
    }
    return fallbackDestinations;
  }, [propRecs]);

  const tripData = useMemo(() => {
    if (propTrip) return propTrip;
    try {
      const cached = sessionStorage.getItem("voyager_trip");
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  }, [propTrip]);

  const activeIndex = index >= destinationsList.length ? 0 : index;
  const destination = destinationsList[activeIndex] || fallbackDestinations[0];

  function showPreviousPick() {
    setIndex(
      (current) =>
        (current - 1 + destinationsList.length) % destinationsList.length
    );
  }

  function showNextPick() {
    setIndex(
      (current) => (current + 1) % destinationsList.length
    );
  }

  function createItinerary() {
    try {
      sessionStorage.setItem("selectedDestination", JSON.stringify(destination));
      if (tripData?.tripId) {
        sessionStorage.setItem("currentTripId", tripData.tripId);
      }
    } catch (e) {
      console.warn("Could not cache selected destination:", e);
    }

    const countryParam = encodeURIComponent(
      destination.countryCode || destination.name || destination.country || ""
    );
    const destIdParam = encodeURIComponent(destination.destinationId || "");
    window.location.href = `/ItineraryNew/itenNew.html?country=${countryParam}&destinationId=${destIdParam}`;
  }

  const photoSrc =
    destination.imageUrl ||
    destination.photo?.url ||
    destination.image ||
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=85";

  const countryDisplayName =
    destination.name || destination.country || "Explore Destination";

  const categoryLabel = destination.category || "CURATED DESTINATION";

  const eyebrowLabel = destination.countryCode
    ? `${destination.countryCode} • PICK ${activeIndex + 1} OF ${destinationsList.length}`
    : destination.location || `DESTINATION ${activeIndex + 1} OF ${destinationsList.length}`;

  const reasonDescription =
    destination.reason ||
    destination.description ||
    "A destination tailored to your quiz preferences.";

  return (
    <main className="postcard-page">
      <nav className="postcard-nav"></nav>

      <section className="postcard-intro">
        <div>
          <p className="postcard-eyebrow">CURATED FOR YOU</p>
          <h1>{tripData?.title || "Your Next Destination"}</h1>
          <p>
            {tripData?.summary ||
              "Recommended places to begin your next adventure based on your quiz answers."}
          </p>
        </div>

        <button
          className="postcard-refresh"
          onClick={showNextPick}
          title="Cycle to next recommendation"
        >
          ↻ &nbsp; View Next Pick ({activeIndex + 1}/{destinationsList.length})
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
              src={photoSrc}
              alt={destination.photo?.alt || countryDisplayName}
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=85";
              }}
            />

            <span className="travel-postcard__category">
              {categoryLabel}
            </span>
          </div>

          <div className="travel-postcard__details">
            <div className="postcard-stamp" aria-hidden="true">
              ✈
            </div>

            <p className="postcard-eyebrow">
              {eyebrowLabel}
            </p>

            <h2>{countryDisplayName}</h2>

            <p className="travel-postcard__description">
              {reasonDescription}
            </p>

            <div className="postcard-divider" />

            <div className="postcard-actions">
              <button
                className="postcard-save"
                onClick={createItinerary}
              >
                Create Itinerary
              </button>
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
        {destinationsList.map((item, itemIndex) => (
          <button
            key={item.destinationId || item.id || itemIndex}
            className={itemIndex === activeIndex ? "active" : ""}
            onClick={() => setIndex(itemIndex)}
            aria-label={`Show ${item.name || item.country || "destination"}`}
            aria-current={itemIndex === activeIndex ? "true" : undefined}
          />
        ))}
      </div>
    </main>
  );
}

export default Recommendations;
