import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { authApi } from "@horpynka/api-sdk";

import { hasPanelAccess } from "./roles";
import { isUnauthorized } from "./errors";
import { getAccessToken } from "./tokens";

export interface AuthSession {
  email: string;
  roles: string[];
}

export const sessionQueryKey = ["auth", "session"] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<AuthSession> => {
    const { data } = await authApi.getSession();
    return { email: data.email, roles: readRoles(data) };
  },
  retry: false,
  staleTime: 5 * 60_000,
});

export function sessionHasPanelAccess(session: AuthSession): boolean {
  return hasPanelAccess(session.roles);
}

function readRoles(data: object): string[] {
  if (!("roles" in data) || !Array.isArray(data.roles)) return [];

  return data.roles.filter((role): role is string => typeof role === "string");
}

export async function ensureSession(queryClient: QueryClient): Promise<AuthSession | null> {
  try {
    return await queryClient.ensureQueryData(sessionQueryOptions);
  } catch (error) {
    if (isUnauthorized(error) || !getAccessToken()) return null;
    throw error;
  }
}
