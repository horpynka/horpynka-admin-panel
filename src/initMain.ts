import { initApiClient } from "@horpynka/api-sdk";

import { registerSdkHttp } from "@/api/sdk-http";
import { installAuthInterceptors } from "@/lib/auth/interceptors";

export const initMain = () => {
  const apiClient = initApiClient({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
  });

  apiClient.defaults.withCredentials = true;
  installAuthInterceptors(apiClient);
  registerSdkHttp(apiClient);
};
