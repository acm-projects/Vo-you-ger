// Connects to http://localhost:8080/api and automatically attaches the authentication token to outgoing requests.

import axios from "axios";

// Create an Axios instance with backend base URL
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api",
});

// Request Interceptor: Runs automatically before EVERY HTTP request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    // Attach the JWT token using the standard Bearer scheme
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// User endpoints
export const registerUser = (userData) => API.post("/auth/register", userData);
export const loginUser = (credentials) => API.post("/auth/login", credentials);
export const getCurrentUser = () => API.get("/auth/me");

// Quiz endpoints
export const saveQuizResponse = (quizData) => API.post("/quiz", quizData);
export const getQuizResponse = () => API.get("/quiz");

// Recommendation endpoints
// If quizData is provided, sends it in request body; otherwise backend uses saved profile quizResponse
export const getRecommendations = (quizData) =>
  API.post("/recommendations", quizData ? { quiz: quizData } : {});

// Itinerary endpoints (Phase 3)
export const previewTripRoute = (tripId, { countryId, numberOfDays, numberOfNights, startDate }) =>
  API.post(`/trips/${tripId}/route`, { countryId, numberOfDays, numberOfNights, startDate });

export const getDestinationPlaces = (tripId, selection) =>
  API.post(`/recommendations/${tripId}/places`, selection);

export const saveTrip = (tripId) => API.put(`/trips/${tripId}/save`);
export const unsaveTrip = (tripId) => API.delete(`/trips/${tripId}/save`);
export const getSavedTrips = () => API.get("/trips/saved");
export const getTripGlobe = () => API.get("/trips/globe");
export const getTrip = (tripId) => API.get(`/trips/${tripId}`);
export const getTripDayPlaces = (tripId, day) => API.get(`/trips/${tripId}/days/${day}/places`);
export const getCountryPlanning = (countryCode) => API.get(`/countries/${countryCode}/planning`);
export const getCountries = () => API.get('/countries');
export const getCountryInfo = (countryCode) => API.get(`/countries/${countryCode}`);
export const generateCountryTrip = (countryCode, input) => API.post(`/countries/${countryCode}/itinerary`, input);

export const generateItinerary = ({ tripId, countryId, destinationId, destination, candidatePlaces, numberOfDays, numberOfNights, startDate, quiz }) =>
  API.post(tripId ? `/itinerary/${tripId}` : "/itinerary/generate", {
    destination,
    countryId,
    destinationId,
    candidatePlaces,
    numberOfDays,
    numberOfNights,
    startDate,
    quiz,
  });

export default API;
