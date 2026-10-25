import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Plus } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONES } from "@/lib/labels";
import type { InventoryStatus } from "@/types/domain";
import { useInventoryApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/inventory/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Інвентаризація — адмін-панель бістро та магазину" },
      { name: "description", content: "Перевірки залишків на складі." },
      { property: "og:title", content: "Інвентаризація — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Перевірки залишків на складі." },
    ],
  }),
  component: InventoryPage,
});

function apiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }

  const data = error.response.data;
  const message =
    data && typeof data === "object" && "message" in data
      ? (data as { message?: unknown }).message
      : undefined;

  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const lines = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (lines.length > 0) return lines.join(" ");
  }

  return "Не вдалося почати перевірку. Спробуйте ще раз.";
}

function InventoryPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "ALL">("ALL");
  const [startError, setStartError] = useState<string | null>(null);

  const { getInventoriesQuery, mutateStartInventory } = useInventoryApi();
  const { data: inventories, isLoading, isError, refetch } = useQuery(getInventoriesQuery());
  type InventoryRow = NonNullable<typeof inventories>[number];

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <ErrorState
        message="Не вдалося завантажити інвентаризації."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!inventories) return null;

  const filteredInventories = inventories.filter((inventory) => {
    return statusFilter === "ALL" || inventory.status === statusFilter;
  });

  const columns: DataTableColumn<InventoryRow>[] = [
    {
      id: "id",
      header: "№",
      cell: (row) => <span className="font-medium">#{row.id}</span>,
      sortValue: (row) => row.id,
    },
    {
      id: "status",
      header: "Статус",
      cell: (row) => (
        <StatusBadge
          tone={INVENTORY_STATUS_TONES[row.status]}
          label={INVENTORY_STATUS_LABELS[row.status]}
        />
      ),
      sortValue: (row) => row.status,
    },
    {
      id: "responsible",
      header: "Відповідальний",
      cell: (row) => <span className="text-sm">{row.responsible}</span>,
      sortValue: (row) => row.responsible,
      hideBelow: "md",
    },
    {
      id: "createdAt",
      header: "Початок",
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => row.createdAt,
      hideBelow: "lg",
    },
    {
      id: "finishedAt",
      header: "Завершення",
      cell: (row) => (row.finishedAt ? formatDateTime(row.finishedAt) : "—"),
      sortValue: (row) => row.finishedAt ?? "",
      hideBelow: "lg",
    },
    {
      id: "itemsCount",
      header: "Позицій",
      cell: (row) => row.items.length,
      sortValue: (row) => row.items.length,
      align: "right",
    },
  ];

  const startInventory = () => {
    setStartError(null);
    mutateStartInventory.mutate(
      {},
      {
        onSuccess: (response) => {
          navigate({
            to: "/panel/inventory/$id",
            params: { id: String(response.data.id) },
          });
        },
        onError: (error) => {
          setStartError(apiErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Інвентаризація</h1>
          <p className="mt-1 text-sm text-muted-foreground">Перевірки залишків на складі.</p>
        </div>
        <Button onClick={startInventory} disabled={mutateStartInventory.isPending}>
          <Plus className="h-4 w-4 mr-1" />
          {mutateStartInventory.isPending ? "Починаємо..." : "Почати перевірку"}
        </Button>
      </div>

      {startError ? (
        <p className="text-sm text-destructive" role="alert">
          {startError}
        </p>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as InventoryStatus | "ALL")}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі статуси</SelectItem>
              {Object.entries(INVENTORY_STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filteredInventories}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({ to: "/panel/inventory/$id", params: { id: String(row.id) } })
        }
        emptyState={
          inventories.length === 0 ? (
            <EmptyState
              title="Інвентаризацій поки немає"
              description="Почніть перевірку, щоб звірити залишки на складі."
              action={
                <Button onClick={startInventory} disabled={mutateStartInventory.isPending}>
                  <Plus className="h-4 w-4 mr-1" />
                  Почати перевірку
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Немає перевірок із цим статусом"
              description="Змініть фільтр статусу, щоб побачити інші перевірки."
            />
          )
        }
      />
    </div>
  );
}
