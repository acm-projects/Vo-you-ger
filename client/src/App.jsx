import { useEffect, useRef, useState } from "react";
import Home from "./pages/Home";
import "./App.css";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutVoyager from "./components/AboutVoyager";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";
import { getRecommendations, generateItinerary } from "./services/api";
import { itineraryUrl, paths, readRoute } from "./services/navigation";

function cached(name) {
  try {
    return JSON.parse(sessionStorage.getItem(name) || "null");
  } catch {
    return null;
  }
}

function App() {
  const [route, setRoute] = useState(() => readRoute(window.location.search));
  const [recommendations, setRecommendations] = useState(() => cached("voyager_recommendations"));
  const [trip, setTrip] = useState(() => cached("voyager_trip"));
  const [loadingError, setLoadingError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const operation = useRef(null);

  useEffect(() => {
    const onBackOrForward = () => {
      setLoadingError(null);
      setRoute(readRoute(window.location.search));
    };
    window.addEventListener("popstate", onBackOrForward);
    return () => window.removeEventListener("popstate", onBackOrForward);
  }, []);

  useEffect(() => {
    if (route.page !== "loading") return;
    if (!localStorage.getItem("token")) {
      window.location.replace(paths.login);
      return;
    }

    let active = true;
    const selected = cached("selectedDestination");
    const tripId = cached("voyager_trip")?.tripId || sessionStorage.getItem("currentTripId");
    const key = JSON.stringify([route.mode, attempt, tripId, selected?.destinationId]);

    // Reuse the same request during StrictMode's effect replay. Only Retry or a
    // different selection starts another POST; Back cancels the UI continuation.
    if (operation.current?.key !== key) {
      const promise = (async () => {
        let request;
        if (route.mode === "itinerary") {
          if (!selected || !tripId) throw new Error("Go back to recommendations and select a country for your trip.");
          request = generateItinerary({
            tripId,
            countryId: selected.destinationId || selected.countryCode,
            destinationId: selected.destinationId,
            destination: selected.name || selected.country,
          });
        } else {
          request = getRecommendations();
        }
        const [response] = await Promise.all([
          request,
          new Promise(resolve => setTimeout(resolve, 2500)),
        ]);
        return response.data;
      })();
      operation.current = { key, promise };
    }

    operation.current.promise.then(data => {
      if (!active) return;
      if (route.mode === "itinerary") {
        if (!data.itinerary?.days?.length) throw new Error("Received an empty itinerary. Please try again.");
        const id = data.trip?.tripId || tripId;
        sessionStorage.setItem("voyager_itinerary", JSON.stringify(data.itinerary));
        if (data.trip) sessionStorage.setItem("voyager_trip", JSON.stringify(data.trip));
        sessionStorage.setItem("currentTripId", id);
        // Replace the loading entry so Back returns to the picks without
        // starting generation again. The URL identifies this exact trip.
        window.location.replace(itineraryUrl(id));
      } else {
        const nextTrip = data.trip;
        if (!nextTrip?.tripId || nextTrip.recommendations?.length !== 3) {
          throw new Error("The server did not return three recommendations. Please try again.");
        }
        sessionStorage.setItem("voyager_trip", JSON.stringify(nextTrip));
        sessionStorage.setItem("voyager_recommendations", JSON.stringify(nextTrip.recommendations));
        sessionStorage.setItem("currentTripId", nextTrip.tripId);
        setTrip(nextTrip);
        setRecommendations(nextTrip.recommendations);
        window.history.replaceState({}, "", paths.recommendations);
        setRoute(readRoute(window.location.search));
      }
    }).catch(error => {
      if (!active) return;
      if ([401, 403].includes(error.response?.status)) {
        window.location.replace(paths.login);
        return;
      }
      console.error("Planning request failed:", error);
      setLoadingError(error.response?.data?.message || error.message || "Please try again.");
    });

    return () => { active = false; };
  }, [route.page, route.mode, attempt]);

  function selectDestination(destination, currentTrip) {
    sessionStorage.setItem("selectedDestination", JSON.stringify(destination));
    const selectedTrip = currentTrip || trip;
    if (selectedTrip?.tripId) {
      sessionStorage.setItem("voyager_trip", JSON.stringify(selectedTrip));
      sessionStorage.setItem("currentTripId", selectedTrip.tripId);
    }
    setLoadingError(null);
    setAttempt(value => value + 1);
    window.history.pushState({}, "", "/?page=loading&mode=itinerary");
    setRoute(readRoute(window.location.search));
  }

  if (route.page === "trips") return <Home />;

  if (route.page === "loading") {
    const isItinerary = route.mode === "itinerary";
    return <Loading error={loadingError} onRetry={() => {
      setLoadingError(null);
      setAttempt(value => value + 1);
    }} backLink={isItinerary ? paths.recommendations : paths.assessment}
      backText={isItinerary ? "Back to Recommendations" : "Back to Quiz"} />;
  }

  if (route.page === "recommendations") {
    return <Recommendations recommendations={recommendations} trip={trip}
      onSelectDestination={selectDestination} />;
  }

  return <>
    <Navbar />
    <main><Hero /><HowItWorks /><AboutVoyager /></main>
  </>;
}

export default App;
