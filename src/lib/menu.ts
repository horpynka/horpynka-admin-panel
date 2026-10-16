import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { sdkHttp } from "@/api/sdk-http";
import type { MenuItem } from "@/types/domain";

const menuCatalogKey = ["menu", "catalog"] as const;

export function menuCatalogQuery() {
  return queryOptions({
    queryKey: menuCatalogKey,
    queryFn: () =>
      sdkHttp()
        .get<MenuItem[]>("/menu/catalog")
        .then((response) => response.data),
  });
}

export function useUpdateMenuItemSelling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, selling }: { id: string; selling: boolean }) =>
      sdkHttp()
        .patch<MenuItem>(`/menu/${id}/selling`, { selling })
        .then((response) => response.data),
    onMutate: async ({ id, selling }) => {
      await queryClient.cancelQueries({ queryKey: menuCatalogKey });
      const previous = queryClient.getQueryData<MenuItem[]>(menuCatalogKey);
      queryClient.setQueryData<MenuItem[]>(menuCatalogKey, (current) =>
        current?.map((item) => (item.id === id ? { ...item, selling } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(menuCatalogKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: menuCatalogKey });
    },
  });
}
