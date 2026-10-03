import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import type { Inventory, InventoryStatus } from "@/types/domain";
import { useInventoryApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/inventory")({
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

function InventoryPage() {
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "ALL">("ALL");
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);

  const getInventories = useInventoryApi().getInventoriesQuery;
  const { data: inventories, isLoading, isError } = useQuery(getInventories());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити інвентаризації." />;
  if (!inventories) return null;

  const filteredInventories = inventories.filter((inventory) => {
    const matchesStatus = statusFilter === "ALL" || inventory.status === statusFilter;
    return matchesStatus;
  });

  const columns: DataTableColumn<Inventory>[] = [
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
        <StatusBadge tone={INVENTORY_STATUS_TONES[row.status] as BadgeTone}>
          {INVENTORY_STATUS_LABELS[row.status]}
        </StatusBadge>
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Інвентаризація</h1>
        <p className="mt-1 text-sm text-muted-foreground">Перевірки залишків на складі.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as InventoryStatus | "ALL")}
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
        onRowClick={(row) => setSelectedInventory(row)}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="Інвентаризацій поки немає"
            description="Тут з'являться результати інвентаризацій."
          />
        }
      />

      {selectedInventory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Інвентаризація #{selectedInventory.id}</CardTitle>
              <StatusBadge tone={INVENTORY_STATUS_TONES[selectedInventory.status] as BadgeTone}>
                {INVENTORY_STATUS_LABELS[selectedInventory.status]}
              </StatusBadge>
            </div>
            <CardDescription>
              {formatDateTime(selectedInventory.createdAt)} · {selectedInventory.responsible}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedInventory.items.map((item) => {
                const difference = item.actualQuantity - item.expectedQuantity;
                const hasDifference = difference !== 0;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      hasDifference ? "border-warning bg-warning/5" : "border-border"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Очікувано: {formatQuantity(item.expectedQuantity, item.measurementUnit)} ·
                        Фактично: {formatQuantity(item.actualQuantity, item.measurementUnit)}
                      </div>
                    </div>
                    {hasDifference && (
                      <div
                        className={`text-sm font-semibold ${difference > 0 ? "text-success" : "text-destructive"}`}
                      >
                        {difference > 0 ? "+" : ""}
                        {formatQuantity(Math.abs(difference), item.measurementUnit)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
