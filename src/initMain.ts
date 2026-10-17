import type { AxiosInstance } from "axios";
import { initApiClient } from "@horpynka/api-sdk";

import { installAuthInterceptors } from "@/lib/auth/interceptors";

let apiClient: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    throw new Error("API client is not initialized");
  }

  return apiClient;
}

export const initMain = () => {
  apiClient = initApiClient({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
  });

  apiClient.defaults.withCredentials = true;
  installAuthInterceptors(apiClient);
};
