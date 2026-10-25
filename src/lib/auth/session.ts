import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { authApi } from "@horpynka/api-sdk";

import { isUnauthorized } from "./errors";
import { getAccessToken } from "./tokens";

export interface AuthSession {
  email: string;
}

export const sessionQueryKey = ["auth", "session"] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<AuthSession> => {
    const { data } = await authApi.getSession();
    return { email: data.email };
  },
  retry: false,
  staleTime: 5 * 60_000,
});

export async function ensureSession(queryClient: QueryClient): Promise<AuthSession | null> {
  try {
    return await queryClient.ensureQueryData(sessionQueryOptions);
  } catch (error) {
    if (isUnauthorized(error) || !getAccessToken()) return null;
    throw error;
  }
}
