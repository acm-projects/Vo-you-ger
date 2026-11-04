
import { useState, useMemo } from "react";
import RecommendationPhoto from "../components/RecommendationPhoto";
import { paths } from "../services/navigation";


function Recommendations({
  recommendations: propRecs,
  trip: propTrip,
  onSelectDestination,
}) {
  const [index, setIndex] = useState(0);

  // Chunk A: Resolve Destination Recommendations List
  // Real results come from props or this tab's saved recommendation response.
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
    return [];
  }, [propRecs]);

  // Chunk B: Resolve Current Trip Metadata
  // Retrieves tripId and saved quiz assessment snapshot.
  const tripData = useMemo(() => {
    if (propTrip) return propTrip;
    try {
      const cached = sessionStorage.getItem("voyager_trip");
      if (cached) return JSON.parse(cached);
    } catch {
      return null;
    }
    return null;
  }, [propTrip]);

  const activeIndex = index >= destinationsList.length ? 0 : index;
  const destination = destinationsList[activeIndex];

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

  // Chunk C: Country Selection & Itinerary Flow Transition
  // Caches selected country and initiates background POST /api/itinerary/generate
  // via the Loading screen.
  function createItinerary() {
    try {
      sessionStorage.setItem("selectedDestination", JSON.stringify(destination));
      if (tripData?.tripId) {
        sessionStorage.setItem("currentTripId", tripData.tripId);
      }
    } catch (e) {
      console.warn("Could not cache selected destination:", e);
    }

    // Delegate to parent App component to transition to loading screen in 'itinerary' mode
    if (typeof onSelectDestination === "function") {
      onSelectDestination(destination, tripData);
      return;
    }

    // Direct fallback navigation to loading screen if rendered outside App container
    window.location.href = "/?page=loading&mode=itinerary";
  }

  if (!destination || !tripData?.tripId) {
    return (
      <main className="postcard-page">
        <h1>Find your next destination</h1>
        <p>Complete your assessment to see your three personalized country recommendations.</p>
        <a className="primary-button" href={localStorage.getItem("token") ? paths.assessment : paths.login}>
          {localStorage.getItem("token") ? "Take the assessment" : "Sign in to get started"}
        </a>
      </main>
    );
  }

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
            <RecommendationPhoto
              key={destination.countryCode || destination.destinationId || activeIndex}
              destination={destination}
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
