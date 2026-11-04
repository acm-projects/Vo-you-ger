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
  return {
    page: ["trips", "loading", "recommendations"].includes(requested) ? requested : "home",
    mode: params.get("mode") === "itinerary" ? "itinerary" : "recommendations",
  };
}

export function clearPlanningSession(storage) {
  for (const key of ["voyager_recommendations", "voyager_trip", "voyager_itinerary", "selectedDestination", "currentTripId"]) {
    storage.removeItem(key);
  }
}

export function loginDestination({ isSignup, firstTime }) {
  return isSignup || firstTime ? paths.assessment : paths.globe;
}

export function itineraryUrl(tripId) {
  if (!tripId) throw new Error("No trip was returned. Please try generating your itinerary again.");
  return `/ItineraryNew/itenNew.html?tripId=${encodeURIComponent(tripId)}`;
}
