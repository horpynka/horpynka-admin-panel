import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { formatMoney, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import type { Order, OrderStatus } from "@/types/domain";
import { useOrdersApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Чеки — адмін-панель бістро та магазину" },
      { name: "description", content: "Історія чеків, статуси та способи оплати." },
      { property: "og:title", content: "Чеки — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Історія чеків, статуси та способи оплати." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  const getOrders = useOrdersApi().getOrdersQuery;
  const { data: orders, isLoading, isError } = useQuery(getOrders());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити чеки." />;
  if (!orders) return null;

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = search
      ? String(order.id).includes(search) ||
        order.status.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: DataTableColumn<Order>[] = [
    {
      id: "id",
      header: "№ чека",
      cell: (row) => `#${row.id}`,
      sortValue: (row) => row.id,
      className: "font-medium",
    },
    {
      id: "status",
      header: "Статус",
      cell: (row) => (
        <StatusBadge tone={ORDER_STATUS_TONES[row.status] as BadgeTone}>
          {ORDER_STATUS_LABELS[row.status]}
        </StatusBadge>
      ),
      sortValue: (row) => row.status,
    },
    {
      id: "createdAt",
      header: "Створено",
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => row.createdAt,
      hideBelow: "md",
    },
    {
      id: "orderPrice",
      header: "Сума",
      cell: (row) => formatMoney(row.orderPrice),
      sortValue: (row) => row.orderPrice,
      align: "right",
      className: "font-semibold",
    },
    {
      id: "cash",
      header: "Готівка",
      cell: (row) => formatMoney(row.paidWithCash),
      sortValue: (row) => row.paidWithCash,
      align: "right",
      hideBelow: "lg",
    },
    {
      id: "card",
      header: "Картка",
      cell: (row) => formatMoney(row.paidWithCard),
      sortValue: (row) => row.paidWithCard,
      align: "right",
      hideBelow: "lg",
    },
    {
      id: "refund",
      header: "Повернення",
      cell: (row) => {
        const totalRefund = row.refundedWithCash + row.refundedWithCard;
        return totalRefund > 0 ? (
          <span className="text-destructive">{formatMoney(totalRefund)}</span>
        ) : (
          "—"
        );
      },
      sortValue: (row) => row.refundedWithCash + row.refundedWithCard,
      align: "right",
      hideBelow: "xl",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Чеки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Історія чеків, статуси та способи оплати.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Пошук за номером або статусом..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OrderStatus | "ALL")}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі статуси</SelectItem>
              {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
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
        rows={filteredOrders}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({ to: "/panel/orders/$orderId", params: { orderId: String(row.id) } })
        }
        emptyState={
          <EmptyState
            icon={Calendar}
            title="Чеків поки немає"
            description="Тут з'являться всі чеки після створення."
          />
        }
      />
    </div>
  );
}
