import { useState, useEffect } from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutVoyager from "./components/AboutVoyager";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  // Automatically show Recommendations after Loading.
  useEffect(() => {
    if (currentPage !== "loading") {
      return;
    }

    const timer = setTimeout(() => {
      setCurrentPage("recommendations");
    }, 15000);

    return () => clearTimeout(timer);
  }, [currentPage]);

  // Loading page
  if (currentPage === "loading") {
    return <Loading />;
  }

  // Recommendations page
  if (currentPage === "recommendations") {
    return <Recommendations />;
  }

  // Landing page
  return (
    <>
      <Navbar />

      <main>
        <Hero />
        <HowItWorks />
        <AboutVoyager />

        {/* Temporary button for testing the loading flow */}
        <section className="loading-preview">
          <button
            className="recommendations-preview__button"
            onClick={() => setCurrentPage("loading")}
          >
            Preview Loading Page
          </button>
        </section>
      </main>
    </>
  );
}

export default App;