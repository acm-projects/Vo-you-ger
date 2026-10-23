

import { useState, useEffect } from "react";
import "./App.css";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutVoyager from "./components/AboutVoyager";
import Loading from "./pages/Loading";
import Recommendations from "./pages/Recommendations";

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);

    return params.get("page") === "loading" ? "loading" : "home";
  });

  useEffect(() => {
    if (currentPage !== "loading") {
      return;
    }

    const timer = setTimeout(() => {
      window.history.replaceState({}, "", "/");
      setCurrentPage("recommendations");
    }, 15000);

    return () => clearTimeout(timer);
  }, [currentPage]);

  if (currentPage === "loading") {
    return <Loading />;
  }

  if (currentPage === "recommendations") {
    return <Recommendations />;
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
