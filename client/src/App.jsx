

import { useState, useEffect, useCallback } from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutVoyager from "./components/AboutVoyager";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";
import { getRecommendations } from "./services/api";

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get("page");
    return page === "loading" ? "loading" : page === "recommendations" ? "recommendations" : "home";
  });

  const [recommendations, setRecommendations] = useState(() => {
    try {
      const cached = sessionStorage.getItem("voyager_recommendations");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [trip, setTrip] = useState(() => {
    try {
      const cached = sessionStorage.getItem("voyager_trip");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loadingError, setLoadingError] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    setLoadingError(null);
    try {
      // Ensure smooth experience with min display time for loading animation
      const minDisplay = new Promise((resolve) => setTimeout(resolve, 2500));
      const [response] = await Promise.all([
        getRecommendations(),
        minDisplay,
      ]);

      const tripData = response.data?.trip;
      const recs = tripData?.recommendations || [];

      if (recs.length > 0) {
        setRecommendations(recs);
        setTrip(tripData);
        sessionStorage.setItem("voyager_recommendations", JSON.stringify(recs));
        sessionStorage.setItem("voyager_trip", JSON.stringify(tripData));
      }

      window.history.replaceState({}, "", "/?page=recommendations");
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

  useEffect(() => {
    if (currentPage === "loading") {
      fetchRecommendations();
    }
  }, [currentPage, fetchRecommendations]);

  if (currentPage === "loading") {
    return <Loading error={loadingError} onRetry={fetchRecommendations} />;
  }

  if (currentPage === "recommendations") {
    return (
      <Recommendations
        recommendations={recommendations}
        trip={trip}
        onRefreshPicks={fetchRecommendations}
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
