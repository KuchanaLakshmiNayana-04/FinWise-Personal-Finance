import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://finwise-backend-g98f.onrender.com",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("finance_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;