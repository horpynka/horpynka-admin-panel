import type { AxiosInstance } from "axios";

let client: AxiosInstance | undefined;

export function registerSdkHttp(instance: AxiosInstance): void {
  client = instance;
}

export function sdkHttp(): AxiosInstance {
  if (!client) {
    throw new Error("API client is not initialized");
  }
  return client;
}
