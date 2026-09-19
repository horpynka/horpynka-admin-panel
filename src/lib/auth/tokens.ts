const ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_SESSION_KEY = "pos-admin-session";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getAccessToken(): string | null {
  return getLocalStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function setAccessToken(token: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(ACCESS_TOKEN_KEY, token);
  storage.removeItem(LEGACY_SESSION_KEY);
}

export function clearAccessToken(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(LEGACY_SESSION_KEY);
}
