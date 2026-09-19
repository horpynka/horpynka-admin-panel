import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { signOut } from "./actions";
import { getAccessToken, setAccessToken } from "./tokens";

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type QueuedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

type RefreshResponse = {
  accessToken: string;
};

const SKIP_REFRESH_PATHS = ["/auth/sign-in", "/auth/refresh"];

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

function requestPath(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

function shouldSkipTokenRefresh(url?: string): boolean {
  const path = requestPath(url);
  return SKIP_REFRESH_PATHS.some((skipPath) => path.endsWith(skipPath));
}

function processQueue(error: unknown, token?: string): void {
  failedQueue.forEach((request) => {
    if (error || !token) {
      request.reject(error);
    } else {
      request.resolve(token);
    }
  });
  failedQueue = [];
}

export function installAuthInterceptors(apiClient: AxiosInstance): void {
  apiClient.interceptors.request.use((config) => {
    config.withCredentials = true;
    const token = getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const originalRequest = error.config as RetryableRequestConfig | undefined;

      if (
        originalRequest &&
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !shouldSkipTokenRefresh(originalRequest.url)
      ) {
        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.set("Authorization", `Bearer ${token}`);
              return apiClient(originalRequest);
            })
            .catch((err: unknown) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const { data } = await apiClient.get<RefreshResponse>("/auth/refresh", {
            withCredentials: true,
          });
          if (!data?.accessToken) {
            throw new Error("Refresh response is missing accessToken");
          }
          setAccessToken(data.accessToken);
          originalRequest.headers.set("Authorization", `Bearer ${data.accessToken}`);
          processQueue(null, data.accessToken);
          return apiClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError);
          signOut();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
}
