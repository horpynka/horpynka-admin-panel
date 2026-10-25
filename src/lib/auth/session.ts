import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { authApi } from "@horpynka/api-sdk";

import { isUnauthorized } from "./errors";
import { hasPanelAccess } from "./roles";
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
    return { email: data.email, roles: readRoles(data.roles) };
  },
  retry: false,
  staleTime: 5 * 60_000,
});

export function sessionHasPanelAccess(session: AuthSession): boolean {
  return hasPanelAccess(session.roles);
}

function readRoles(roles: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === "string");
}

export async function ensureSession(queryClient: QueryClient): Promise<AuthSession | null> {
  try {
    return await queryClient.ensureQueryData(sessionQueryOptions);
  } catch (error) {
    if (isUnauthorized(error) || !getAccessToken()) return null;
    throw error;
  }
}
