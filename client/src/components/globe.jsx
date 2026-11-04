import { lazy, Suspense } from "react";

const GoogleGlobe = lazy(() => import("./GoogleGlobe"));
const MapboxGlobe = lazy(() => import("./MapboxGlobe"));

export default function TravelGlobe(props) {
  // Existing Google setups keep working; setting a Mapbox token opts into the
  // new renderer. VITE_GLOBE_PROVIDER=google allows an immediate switch back.
  const provider = import.meta.env.VITE_GLOBE_PROVIDER ||
    (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ? "mapbox" : "google");
  const Globe = provider === "mapbox" ? MapboxGlobe : GoogleGlobe;
  return (
    <Suspense fallback={<div className="trip-home__globe-status" role="status">Loading globe…</div>}>
      <Globe {...props} />
    </Suspense>
  );
}
