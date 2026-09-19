import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { onAuthLogout } from "@/lib/auth/events";
import type { RouterContext } from "@/types/router";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      session: null,
    } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  onAuthLogout(() => {
    void queryClient.cancelQueries().then(() => {
      queryClient.clear();
      if (router.state.location.pathname !== "/login") {
        void router.navigate({ to: "/login", replace: true });
      }
    });
  });

  return router;
};
