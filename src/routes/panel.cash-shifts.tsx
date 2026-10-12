import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

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
import { Card } from "@/components/ui/card";
import { formatMoney, formatDateTime } from "@/lib/format";
import { CASH_SHIFT_STATUS_LABELS, CASH_SHIFT_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import type { CashShift, CashShiftStatus } from "@/types/domain";
import { useCashShiftsApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/cash-shifts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Касові зміни — адмін-панель бістро та магазину" },
      { name: "description", content: "Відкриття та закриття змін касирів." },
      { property: "og:title", content: "Касові зміни — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Відкриття та закриття змін касирів." },
    ],
  }),
  component: CashShiftsPage,
});

function CashShiftsPage() {
  const [statusFilter, setStatusFilter] = useState<CashShiftStatus | "ALL">("ALL");

  const getShifts = useCashShiftsApi().getCashShiftsQuery;
  const { data: shifts, isLoading, isError } = useQuery(getShifts());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити касові зміни." />;
  if (!shifts) return null;

  const filteredShifts = shifts.filter((shift) => {
    const matchesStatus = statusFilter === "ALL" || shift.status === statusFilter;
    return matchesStatus;
  });

  const columns: DataTableColumn<CashShift>[] = [
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
        <StatusBadge tone={CASH_SHIFT_STATUS_TONES[row.status] as BadgeTone}>
          {CASH_SHIFT_STATUS_LABELS[row.status]}
        </StatusBadge>
      ),
      sortValue: (row) => row.status,
    },
    {
      id: "cashier",
      header: "Касир",
      cell: (row) => <span className="text-sm">{row.cashierName}</span>,
      sortValue: (row) => row.cashierName,
      hideBelow: "md",
    },
    {
      id: "openedAt",
      header: "Відкрита",
      cell: (row) => formatDateTime(row.openedAt),
      sortValue: (row) => row.openedAt,
      hideBelow: "lg",
    },
    {
      id: "closedAt",
      header: "Закрита",
      cell: (row) => (row.closedAt ? formatDateTime(row.closedAt) : "—"),
      sortValue: (row) => row.closedAt ?? "",
      hideBelow: "lg",
    },
    {
      id: "ordersCount",
      header: "Чеків",
      cell: (row) => row.ordersCount,
      sortValue: (row) => row.ordersCount,
      align: "right",
      hideBelow: "md",
    },
    {
      id: "cashSales",
      header: "Готівка",
      cell: (row) => formatMoney(row.cashSales),
      sortValue: (row) => row.cashSales,
      align: "right",
      hideBelow: "xl",
    },
    {
      id: "closingBalance",
      header: "Залишок",
      cell: (row) => <span className="font-semibold">{formatMoney(row.closingBalance)}</span>,
      sortValue: (row) => row.closingBalance,
      align: "right",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Касові зміни</h1>
        <p className="mt-1 text-sm text-muted-foreground">Відкриття та закриття змін касирів.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CashShiftStatus | "ALL")}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі статуси</SelectItem>
              {Object.entries(CASH_SHIFT_STATUS_LABELS).map(([status, label]) => (
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
        rows={filteredShifts}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Clock}
            title="Касових змін поки немає"
            description="Тут з'являться всі касові зміни."
          />
        }
      />
    </div>
  );
}
