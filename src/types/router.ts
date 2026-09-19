import type { QueryClient } from "@tanstack/react-query";

import type { AuthSession } from "@/lib/auth/session";

export interface RouterContext {
  queryClient: QueryClient;
  session: AuthSession | null;
}
