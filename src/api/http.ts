/**
 * Заготовка HTTP-клієнта для майбутнього підключення існуючого backend.
 * Зараз жодних реальних запитів не виконується — усі дані беруться з mock-репозиторіїв.
 */
import axios from "axios";

export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "/api";

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Українські повідомлення про помилки формуються на рівні UI.
    return Promise.reject(error);
  },
);
