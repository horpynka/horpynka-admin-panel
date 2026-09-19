type LogoutListener = () => void;

const logoutListeners = new Set<LogoutListener>();

export function onAuthLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => {
    logoutListeners.delete(listener);
  };
}

export function emitAuthLogout(): void {
  logoutListeners.forEach((listener) => listener());
}
