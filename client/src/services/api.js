// Connects to http://localhost:8080/api and automatically attaches the authentication token to outgoing requests.

import axios from "axios";

// Create an Axios instance with your backend's base URL
const API = axios.create({
  baseURL: "http://localhost:8080/api",
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

// Centralized helper functions matching your backend routes
export const registerUser = (userData) => API.post("/auth/register", userData);
export const loginUser = (credentials) => API.post("/auth/login", credentials);
export const getCurrentUser = () => API.get("/auth/me");

export default API;
