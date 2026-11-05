import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { attachHeadingMask } from "../services/globeHeadingMask";
import { addMapboxTripMarkers, configureGlobeStyle, countryFromFeature,
  COUNTRY_LAYER, GLOBE_STYLE, GLOBE_BASEMAP_CONFIG, selectCountry } from "../services/mapboxGlobe";

const NO_TRIPS = [];

function mapPadding(container) {
  const empty = {top: 0, bottom: 0, left: 0, right: 0};
  if (window.innerWidth <= 850 || document.fullscreenElement?.contains(container)) return empty;
  const main = container.closest(".trip-home__main");
  const panel = main?.querySelector(".trip-home__panel");
  if (!panel) return empty;
  const gap = parseFloat(getComputedStyle(main.querySelector(".trip-home__layout")).columnGap) || 0;
  return {...empty,
    top: 32, // Shift the globe's visual center down by 16px.
    left: parseFloat(getComputedStyle(main).paddingLeft) || 0,
    right: Math.max(0, container.getBoundingClientRect().right - panel.getBoundingClientRect().left + gap),
  };
}

async function loadShapes(path, signal) {
  const response = await fetch(path, {signal});
  if (!response.ok) throw new Error("COUNTRY_SHAPES_UNAVAILABLE");
  const data = await response.json();
  if (data.type !== "FeatureCollection" || !data.features?.length) throw new Error("COUNTRY_SHAPES_UNAVAILABLE");
  return data;
}

export default function MapboxGlobe({onCountrySelect, trips = NO_TRIPS, onTripSelect,
  selectedTripId, selectedCountryCode}) {
  const containerRef = useRef(null);
  const countryCallback = useRef(onCountrySelect);
  const tripCallback = useRef(onTripSelect);
  const markersRef = useRef(null);
  const [runtime, setRuntime] = useState(null);
  const [status, setStatus] = useState("Loading globe…");

  useEffect(() => { countryCallback.current = onCountrySelect; }, [onCountrySelect]);
  useEffect(() => { tripCallback.current = onTripSelect; }, [onTripSelect]);

  useEffect(() => {
    if (!runtime) return;
    const markers = addMapboxTripMarkers(runtime.map, mapboxgl.Marker, trips,
      trip => tripCallback.current?.(trip));
    markersRef.current = markers;
    return () => { markers.remove(); markersRef.current = null; };
  }, [runtime, trips]);

  useEffect(() => {
    markersRef.current?.highlight(selectedTripId);
  }, [runtime, trips, selectedTripId]);

  useEffect(() => {
    if (runtime) selectCountry(runtime.map, runtime.countries, selectedCountryCode);
  }, [runtime, selectedCountryCode]);

  useEffect(() => {
    const controller = new AbortController();
    let map, observer, removeHeadingMask, cancelled = false, providerError = false;
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    async function initialize() {
      try {
        if (!token?.startsWith("pk.")) throw new Error("MISSING_MAPBOX_TOKEN");
        // Fetching local shapes first lets StrictMode cancel its initial effect
        // before a map is created, avoiding duplicate Mapbox map loads.
        const countries = await loadShapes("/countries.geojson", controller.signal);
        if (cancelled) return;
        const padding = mapPadding(containerRef.current);
        const size = Math.min(containerRef.current.clientWidth - padding.left - padding.right,
          containerRef.current.clientHeight);
        const initialZoom = Math.max(0, Math.min(1.5, Math.log2(size / 256) + 0.25));
        map = new mapboxgl.Map({
          container: containerRef.current, accessToken: token,
          style: GLOBE_STYLE, config: {basemap: GLOBE_BASEMAP_CONFIG}, projection: "globe",
          center: [-40, 20], zoom: initialZoom, minZoom: 0, maxZoom: 5,
          pitch: 0, maxPitch: 0, dragRotate: false, touchPitch: false,
          renderWorldCopies: false, antialias: true,
        });
        // Keep the globe centered in the area beside the panel while allowing
        // zoomed map content to render behind it and out to the page edges.
        map.setPadding(padding);
        map.touchZoomRotate.disableRotation();
        map.getCanvas().setAttribute("aria-label", "Interactive globe. Drag to rotate, zoom, and click a country or saved-trip pin.");
        map.addControl(new mapboxgl.NavigationControl({showCompass: false}), "top-right");
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
        observer = new ResizeObserver(() => {
          map.resize();
          map.setPadding(mapPadding(containerRef.current));
        });
        observer.observe(containerRef.current);

        map.on("error", event => {
          if (cancelled) return;
          providerError = true;
          const code = event.error?.status;
          setStatus(code === 429
            ? "Mapbox's request or usage limit was reached. Check your Mapbox account limits before retrying."
            : [401, 403].includes(code)
              ? "Mapbox couldn't authorize this map. Check your token's access and account limits."
              : "Mapbox couldn't load some map data. Check your connection and account usage, then refresh.");
          // Provider errors can contain the token in a URL; don't log them.
        });
        map.on("style.load", () => {
          if (cancelled) return;
          configureGlobeStyle(map, countries);
        });
        map.on("load", () => {
          if (cancelled) return;
          removeHeadingMask = attachHeadingMask(map,
            containerRef.current.closest(".trip-home__main")?.querySelector(".trip-home__heading"));
          if (!providerError) setStatus("");
          setRuntime({map, countries});
        });
        map.on("click", event => {
          if (!map.getLayer(COUNTRY_LAYER)) return;
          const feature = map.queryRenderedFeatures(event.point, {layers: [COUNTRY_LAYER]})[0];
          countryCallback.current?.(countryFromFeature(feature));
        });
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;
        observer?.disconnect();
        removeHeadingMask?.();
        map?.remove();
        map = null;
        setStatus(error.message === "MISSING_MAPBOX_TOKEN"
          ? "Add your public VITE_MAPBOX_ACCESS_TOKEN to client/.env.local and restart Vite."
          : "Couldn't initialize the globe. Check your connection and that WebGL is enabled.");
      }
    }

    initialize();
    return () => {
      cancelled = true;
      controller.abort();
      observer?.disconnect();
      removeHeadingMask?.();
      map?.remove();
    };
  }, []);

  return (
    <div className="trip-home__globe-viewer">
      <div ref={containerRef} className="trip-home__mapbox-map" />
      {status && <div className="trip-home__globe-status" role="status">{status}</div>}
    </div>
  );
}
