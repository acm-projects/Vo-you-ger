import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import TravelGlobe from "../components/globe";
import CountryPanel from "../components/CountryPanel";
import TripPanel from "../components/TripPanel";
import { getTripGlobe } from "../services/api";
import { globeTrips, tripLabel, tripsAtPin, validPin } from "../services/savedTripPins";
import "./home.css";

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const signedIn = Boolean(localStorage.getItem("token"));
  const trips = useMemo(() => globeTrips(saved), [saved]);
  const siblings = selectedTrip ? tripsAtPin(trips, selectedTrip) : [];

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    getTripGlobe({signal: controller.signal})
      .then(({data}) => {
        if (!controller.signal.aborted) {
          setSaved(data);
          setError("");
          setSessionExpired(false);
        }
      })
      .catch(requestError => {
        if (!controller.signal.aborted) {
          const expired = [401, 403].includes(requestError.response?.status);
          setSessionExpired(expired);
          if (expired) setSaved(null);
          setError(expired ? "Your session has expired. Sign in again to see your saved trips."
            : "Couldn't load your saved trips. Please try again.");
        }
      });
    return () => controller.abort();
  }, [signedIn, attempt]);

  function selectTrip(trip) {
    setSelectedCountry(null);
    setSelectedTrip(trip);
  }

  function selectCountry(country) {
    setSelectedTrip(null);
    setSelectedCountry(country);
  }

  function tripList(items, heading) {
    return <section className="saved-trips" aria-label={heading}>
      <h3>{heading}</h3>
      <ul>{items.map(trip => <li key={trip.tripId}>
        <button type="button" onClick={() => selectTrip(trip)} aria-pressed={selectedTrip?.tripId === trip.tripId}>
          <span>{tripLabel(trip)}</span>
          <small>{trip.baseNames?.join(" → ") || trip.startCity || "Saved itinerary"}{!validPin(trip.pin) && " · Location unavailable"}</small>
        </button>
      </li>)}</ul>
    </section>;
  }

  return (
    <div className="trip-home">
      <Navbar />

      <main className="trip-home__main">
        <header className="trip-home__heading">
          <h1>The world is your oyster.</h1>
          <span>Explore a new country or view your saved trips</span>
        </header>

        <div className="trip-home__layout">
          <section
            className="trip-home__globe"
            aria-label="Interactive globe"
          >
            <TravelGlobe onCountrySelect={selectCountry} trips={trips} onTripSelect={selectTrip}
              selectedTripId={selectedTrip?.tripId} selectedCountryCode={selectedCountry?.countryCode} />
          </section>

          <aside
            className={`trip-home__panel${
              selectedCountry || selectedTrip || trips.length || signedIn ? " trip-home__panel--country" : ""
            }`}
            aria-label="Trip and country details"
            aria-live="polite"
          >
            {selectedTrip ? (
              <>
                <TripPanel key={selectedTrip.tripId} trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
                {siblings.length > 1 && tripList(siblings, "Trips starting here")}
              </>
            ) : selectedCountry ? (
              <CountryPanel
                key={selectedCountry.countryCode || selectedCountry.name}
                country={selectedCountry}
                onClose={() => setSelectedCountry(null)}
              />
            ) : (
              <>
                <p>Explore new destinations and view your saved trips here.</p>
                {!signedIn ? <a className="saved-trip-panel__open" href="/signUpAndLogin/login.html">Sign in to see your trips</a> : (
                  <>
                    {error && <p className="saved-trips__message" role="alert">{error}</p>}
                    {sessionExpired && <a className="saved-trip-panel__open" href="/signUpAndLogin/login.html">Sign in again</a>}
                    {!saved && !error && <p role="status">Loading saved trips…</p>}
                    {saved && (trips.length ? tripList(trips, "Your saved trips") : <p className="saved-trips__message">No saved trips yet. Saved itineraries will appear here as pins.</p>)}
                    {!sessionExpired && <a className="saved-trip-panel__open" href="/Assessments/assessments.html">Plan a new trip</a>}
                    <button type="button" className="country-panel__retry" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Refresh saved trips</button>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
