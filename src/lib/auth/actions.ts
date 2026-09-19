import type { QueryClient } from "@tanstack/react-query";
import { authApi } from "@horpynka/api-sdk";

import { isUnauthorized } from "./errors";
import { emitAuthLogout } from "./events";
import { sessionQueryOptions, type AuthSession } from "./session";
import { clearAccessToken, setAccessToken } from "./tokens";

export async function signIn(
  queryClient: QueryClient,
  email: string,
  password: string,
): Promise<AuthSession> {
  try {
    const {
      data: { accessToken },
    } = await authApi.signIn({ email, password });
    setAccessToken(accessToken);
  } catch (error) {
    if (isUnauthorized(error)) {
      throw new Error("Невірна електронна пошта або пароль.");
    }
    throw new Error("Не вдалося виконати вхід.");
  }

  return queryClient.fetchQuery(sessionQueryOptions);
}

export function signOut(): void {
  clearAccessToken();
  emitAuthLogout();
}
