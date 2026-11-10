export const paths = {
  landing: "/",
  globe: "/?page=trips",
  assessment: "/Assessments/assessments.html",
  login: "/signUpAndLogin/login.html",
  signup: "/signUpAndLogin/signup.html",
  recommendations: "/?page=recommendations",
};

export function readRoute(search) {
  const params = new URLSearchParams(search);
  const requested = params.get("page");
  const route = {
    page: ["trips", "loading", "recommendations", "plan"].includes(requested) ? requested : "home",
    mode: params.get("mode") === "itinerary" ? "itinerary" : "recommendations",
  };
  if (route.page === "plan") {
    const code = params.get("country") || "";
    route.countryCode = /^[a-z]{2}$/i.test(code) ? code.toUpperCase() : null;
  }
  return route;
}

export function clearPlanningSession(storage) {
  for (const key of ["voyager_recommendations", "voyager_trip", "voyager_itinerary", "selectedDestination", "currentTripId"]) {
    storage.removeItem(key);
  }
}

export function countryPlanningUrl(countryCode) {
  if (typeof countryCode !== "string" || !/^[a-z]{2}$/i.test(countryCode)) throw new Error("Select a country to plan your trip.");
  return `/?page=plan&country=${countryCode.toUpperCase()}`;
}

// Only this local planning route may be resumed after authentication/assessment.
export function safePlanningReturn(value) {
  if (typeof value !== "string" || !value.startsWith("/?") || value.length > 500) return null;
  const route = readRoute(value.slice(1));
  return route.page === "plan" && route.countryCode ? countryPlanningUrl(route.countryCode) : null;
}

export function withPlanningReturn(path, returnTo) {
  const target = safePlanningReturn(returnTo);
  return target ? `${path}?returnTo=${encodeURIComponent(target)}` : path;
}

export function loginDestination({ isSignup, firstTime, returnTo }) {
  const target = safePlanningReturn(returnTo);
  return isSignup || firstTime ? withPlanningReturn(paths.assessment, target) : target || paths.globe;
}

export function itineraryUrl(tripId) {
  if (!tripId) throw new Error("No trip was returned. Please try generating your itinerary again.");
  return `/ItineraryFinal/itenF.html?tripId=${encodeURIComponent(tripId)}`;
}
