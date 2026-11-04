// client/src/App.jsx
// Root application component managing page routing, recommendation generation,
// and background itinerary generation with synchronized loading screens.

import { useState, useEffect, useCallback } from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutVoyager from "./components/AboutVoyager";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";
import { getRecommendations, generateItinerary } from "./services/api";

function App() {
  // =========================================================================
  // Chunk 1: Application Routing and State Management
  // Parse URL query parameters to determine initial page and loading mode.
  // Assumption: Supported pages are "home", "loading", and "recommendations".
  // =========================================================================
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get("page");
    return page === "loading"
      ? "loading"
      : page === "recommendations"
        ? "recommendations"
        : "home";
  });

  // Determines whether the loading screen is generating country recommendations or a full itinerary
  const [loadingMode, setLoadingMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") || "recommendations";
  });

  // Recommendation cards returned by Gemini based on traveler assessment
  const [recommendations, setRecommendations] = useState(() => {
    try {
      const cached = sessionStorage.getItem("voyager_recommendations");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Active trip object containing tripId and quiz profile snapshot
  const [trip, setTrip] = useState(() => {
    try {
      const cached = sessionStorage.getItem("voyager_trip");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // Captures and surfaces error messages during asynchronous API operations
  const [loadingError, setLoadingError] = useState(null);

  // =========================================================================
  // Chunk 2: Recommendations Generation Flow
  // Invoked after the traveler completes the quiz. Queries Gemini to generate
  // top 3 personalized countries while displaying the animated spinning globe.
  // =========================================================================
  const fetchRecommendations = useCallback(async () => {
    setLoadingError(null);
    try {
      // Step A: Guarantee minimum display duration (2.5s) for smooth visual pacing
      const minDisplay = new Promise((resolve) => setTimeout(resolve, 2500));
      const [response] = await Promise.all([getRecommendations(), minDisplay]);

      const tripData = response.data?.trip;
      const recs = tripData?.recommendations || [];

      // Step B: Persist recommendation results and trip metadata to sessionStorage
      if (recs.length > 0) {
        setRecommendations(recs);
        setTrip(tripData);
        sessionStorage.setItem("voyager_recommendations", JSON.stringify(recs));
        sessionStorage.setItem("voyager_trip", JSON.stringify(tripData));
      }

      // Step C: Update URL and transition view to Recommendations page
      window.history.replaceState({}, "", "/?page=recommendations");
      setLoadingMode("recommendations");
      setCurrentPage("recommendations");
    } catch (err) {
      console.error("Failed to generate recommendations:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not generate recommendations. Please try again.";
      setLoadingError(msg);
    }
  }, []);

  // =========================================================================
  // Chunk 3: Background Itinerary Generation Flow
  // Invoked when the user selects a recommended country.
  // Executes POST /api/itinerary/generate (or /api/itinerary/:tripId) in the
  // background while displaying the loading screen with spinning globe and fun facts.
  // =========================================================================
  const fetchItinerary = useCallback(async () => {
    setLoadingError(null);
    try {
      // Step A: Retrieve selected country details from sessionStorage
      let selectedDest = null;
      try {
        const cachedDest = sessionStorage.getItem("selectedDestination");
        if (cachedDest) selectedDest = JSON.parse(cachedDest);
      } catch (e) {
        console.warn("Could not read cached selectedDestination:", e);
      }

      // Step B: Resolve trip ID from active trip state or sessionStorage
      const currentTripId =
        trip?.tripId ||
        (() => {
          try {
            return (
              sessionStorage.getItem("currentTripId") ||
              JSON.parse(sessionStorage.getItem("voyager_trip") || "{}")?.tripId
            );
          } catch {
            return null;
          }
        })();

      // Step C: Validate destination selection prerequisites
      if (!selectedDest) {
        throw new Error(
          "No destination selected. Please go back to recommendations and select a country.",
        );
      }

      // Step D: Construct payload conforming to backend itinerary generation requirements
      const payload = {
        tripId: currentTripId,
        countryId: selectedDest.destinationId || selectedDest.countryCode,
        destinationId: selectedDest.destinationId,
        destination: selectedDest.name || selectedDest.country,
      };

      // Step E: Trigger Gemini generation in parallel with minimum display animation
      const minDisplay = new Promise((resolve) => setTimeout(resolve, 2500));
      const [response] = await Promise.all([
        generateItinerary(payload),
        minDisplay,
      ]);

      const itineraryData = response.data?.itinerary;
      if (!itineraryData) {
        throw new Error("Received empty itinerary data from server.");
      }

      // Step F: Persist generated itinerary into sessionStorage for the Itinerary view
      sessionStorage.setItem(
        "voyager_itinerary",
        JSON.stringify(itineraryData),
      );
      if (response.data?.trip) {
        sessionStorage.setItem(
          "voyager_trip",
          JSON.stringify(response.data.trip),
        );
      }

      // Step G: Navigate to the personalized itinerary page
      const countryParam = encodeURIComponent(
        selectedDest.countryCode ||
          selectedDest.name ||
          selectedDest.country ||
          "",
      );
      const destIdParam = encodeURIComponent(selectedDest.destinationId || "");
      window.location.href = `/ItineraryNew/itenNew.html?country=${countryParam}&destinationId=${destIdParam}`;
    } catch (err) {
      console.error("Failed to generate itinerary:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not generate your personalized itinerary. Please try again.";
      setLoadingError(msg);
    }
  }, [trip]);

  // =========================================================================
  // Chunk 4: Country Selection Handler
  // Transitions to the Loading page in 'itinerary' mode upon country selection.
  // =========================================================================
  const handleSelectDestination = useCallback(
    (destination, currentTrip) => {
      try {
        sessionStorage.setItem(
          "selectedDestination",
          JSON.stringify(destination),
        );
        const effectiveTripId = currentTrip?.tripId || trip?.tripId;
        if (effectiveTripId) {
          sessionStorage.setItem("currentTripId", effectiveTripId);
        }
      } catch (e) {
        console.warn("Could not cache destination prior to loading:", e);
      }

      setLoadingMode("itinerary");
      setLoadingError(null);
      setCurrentPage("loading");
      window.history.pushState({}, "", "/?page=loading&mode=itinerary");
    },
    [trip],
  );

  // =========================================================================
  // Chunk 5: Execution Effect for Active Loading Operations
  // Runs the appropriate background fetch depending on whether we are loading
  // initial recommendations or the final personalized itinerary.
  // =========================================================================
  useEffect(() => {
    if (currentPage === "loading") {
      if (loadingMode === "itinerary") {
        fetchItinerary();
      } else {
        fetchRecommendations();
      }
    }
  }, [currentPage, loadingMode, fetchItinerary, fetchRecommendations]);

  // =========================================================================
  // Chunk 6: Page View Rendering
  // Render Loading page, Recommendations page, or Landing page.
  // =========================================================================
  if (currentPage === "loading") {
    const isItinerary = loadingMode === "itinerary";
    return (
      <Loading
        error={loadingError}
        onRetry={isItinerary ? fetchItinerary : fetchRecommendations}
        backLink={
          isItinerary
            ? "/?page=recommendations"
            : "/Assessments/assessments.html"
        }
        backText={isItinerary ? "Back to Recommendations" : "Back to Quiz"}
      />
    );
  }

  if (currentPage === "recommendations") {
    return (
      <Recommendations
        recommendations={recommendations}
        trip={trip}
        onRefreshPicks={fetchRecommendations}
        onSelectDestination={handleSelectDestination}
      />
    );
  }

  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <AboutVoyager />
      </main>
    </>
  );
}

export default App;
