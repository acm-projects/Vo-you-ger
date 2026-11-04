import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { geoContains } from "d3-geo";
import { addTripMarkers } from "../services/savedTripPins";

const NO_TRIPS = [];

let mapsPromise;

function loadGoogleMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!key) {
    throw new Error("MISSING_MAPS_KEY");
  }

  if (!mapsPromise) {
    setOptions({ key, v: "weekly" });
    mapsPromise = importLibrary("maps3d");
  }

  return mapsPromise;
}

async function loadCountryShapes(signal) {
  const response = await fetch("/countries.geojson", { signal });

  if (!response.ok) {
    throw new Error("Could not load country shapes.");
  }

  const data = await response.json();

  const countries = (data.features || []).filter(
    (feature) =>
      feature.geometry?.type === "Polygon" ||
      feature.geometry?.type === "MultiPolygon"
  );

  if (!countries.length) {
    throw new Error("Country shapes are missing.");
  }

  return countries;
}

async function addCountryBorders(map, Polyline3DElement, signal) {
  const response = await fetch("/country-borders.geojson", {
    signal,
  });

  if (!response.ok) {
    throw new Error("Could not load country borders.");
  }

  const data = await response.json();

  if (signal.aborted) return;

  const fragment = document.createDocumentFragment();

  for (const feature of data.features || []) {
    const geometry = feature.geometry;

    const lines =
      geometry?.type === "LineString"
        ? [geometry.coordinates]
        : geometry?.type === "MultiLineString"
          ? geometry.coordinates
          : [];

    for (const coordinates of lines) {
      if (coordinates.length < 2) continue;

      fragment.appendChild(
        new Polyline3DElement({
          path: coordinates.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: "#e8f1ffb3",
          strokeWidth: 1.2,
          altitudeMode: "CLAMP_TO_GROUND",
          geodesic: true,
          drawsOccludedSegments: false,
          extruded: false,
        })
      );
    }
  }

  map.appendChild(fragment);
}

export default function TravelGlobe({ onCountrySelect, trips = NO_TRIPS, onTripSelect, selectedTripId }) {
  const containerRef = useRef(null);
  const onCountrySelectRef = useRef(onCountrySelect);
  const onTripSelectRef = useRef(onTripSelect);
  const markersRef = useRef(null);
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("Loading Google globe…");

  useEffect(() => {
    onCountrySelectRef.current = onCountrySelect;
  }, [onCountrySelect]);

  useEffect(() => {
    onTripSelectRef.current = onTripSelect;
  }, [onTripSelect]);

  useEffect(() => {
    if (!runtime) return;
    const markers = addTripMarkers(runtime.map, runtime.Marker, trips,
      trip => onTripSelectRef.current?.(trip));
    markersRef.current = markers;
    return () => {
      markers.remove();
      markersRef.current = null;
    };
  }, [runtime, trips]);

  useEffect(() => {
    markersRef.current?.highlight(selectedTripId);
  }, [selectedTripId, runtime, trips]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let map;
    let countries = [];

    const controller = new AbortController();

    function handleSteadyChange(event) {
      if (!cancelled && event.isSteady) {
        setStatus("");
      }
    }

    function handleMapError() {
      if (!cancelled) {
        setStatus(
          "Google Maps couldn't initialize. Check the browser console for its error."
        );
      }
    }

    function handleCountryClick(event) {
      if (cancelled || !event.position || event.target !== map) return;

      const { lat, lng } = event.position;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const feature = countries.find((country) =>
        geoContains(country, [lng, lat])
      );

      if (!feature) {
        onCountrySelectRef.current?.(null);
        return;
      }

      const properties = feature.properties || {};

      const countryCode = [
        properties.ISO_A2_EH,
        properties.ISO_A2,
      ].find((code) => /^[A-Z]{2}$/.test(code || ""));

      onCountrySelectRef.current?.({
        name: properties.ADMIN || properties.NAME,
        countryCode: countryCode || null,
      });
    }

    async function initialize() {
      try {
        const [mapsLibrary, countryShapes] = await Promise.all([
          loadGoogleMaps(),
          loadCountryShapes(controller.signal),
        ]);

        if (cancelled) return;

        countries = countryShapes;

        const { Map3DElement, Polyline3DElement, Marker3DInteractiveElement } = mapsLibrary;

        map = new Map3DElement({
          center: { lat: 20, lng: -40, altitude: 0 },
          range: 12000000,
          fov: 45,
          tilt: 0,
          heading: 0,
          mode: "SATELLITE",
          description:
            "Explore the world. Click a country to select it.",
        });

        map.addEventListener("gmp-error", handleMapError);
        map.addEventListener("gmp-steadychange", handleSteadyChange);
        map.addEventListener("gmp-click", handleCountryClick);

        container.appendChild(map);
        setRuntime({map, Marker: Marker3DInteractiveElement});

        addCountryBorders(
          map,
          Polyline3DElement,
          controller.signal
        ).catch((error) => {
          if (!cancelled && error.name !== "AbortError") {
            console.error("Country borders failed to load.", error);
          }
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;

        setStatus(
          error.message === "MISSING_MAPS_KEY"
            ? "Add VITE_GOOGLE_MAPS_API_KEY to client/.env.local and restart Vite."
            : "Couldn't load the globe or country shapes. Check the browser console."
        );
      }
    }

    initialize();

    return () => {
      cancelled = true;
      controller.abort();

      if (map) {
        map.removeEventListener("gmp-error", handleMapError);
        map.removeEventListener("gmp-steadychange", handleSteadyChange);
        map.removeEventListener("gmp-click", handleCountryClick);
        map.remove();
      }
    };
  }, []);

  return (
    <div className="trip-home__globe-viewer">
      <div ref={containerRef} className="trip-home__google-map" />

      {status && (
        <div className="trip-home__google-status" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
