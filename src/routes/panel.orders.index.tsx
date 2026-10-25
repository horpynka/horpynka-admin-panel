import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DateRangeFilter, type DateRange } from "@/components/common/date-range-filter";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
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
import {
  isReceiptStatus,
  RECEIPT_STATUSES,
  RECEIPT_STATUS_LABELS,
  RECEIPT_STATUS_TONES,
  type ReceiptStatus,
} from "@/lib/labels";
import { useOrdersApi } from "@horpynka/api-sdk";

const PAGE_SIZE = 15;

interface ReceiptListItem {
  id: number;
  status: string;
  createdAt: string;
  orderPrice: number;
  paidWithCash: number;
  paidWithCard: number;
  refundedWithCash: number;
  refundedWithCard: number;
}

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
  const getOrders = useOrdersApi().getOrdersQuery;
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const invalidRange = Boolean(dateRange.from && dateRange.to && dateRange.from > dateRange.to);
  const filtersKey = `${appliedSearch}|${statusFilter}|${dateRange.from}|${dateRange.to}`;
  const [pageFiltersKey, setPageFiltersKey] = useState(filtersKey);
  const filtersChanged = filtersKey !== pageFiltersKey;
  if (filtersChanged) {
    setPageFiltersKey(filtersKey);
    setPage(1);
  }
  const currentPage = filtersChanged ? 1 : page;

  // GET /orders defaults an omitted status to CREATED, so "all" requests each status.
  const statuses: ReceiptStatus[] = statusFilter === "ALL" ? [...RECEIPT_STATUSES] : [statusFilter];

  const orderQueries = useQueries({
    queries: statuses.map((status) => ({
      ...getOrders({
        page: currentPage,
        limit: PAGE_SIZE,
        status,
        search: appliedSearch || undefined,
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      }),
      enabled: !invalidRange,
      placeholderData: keepPreviousData,
    })),
  });

  const isLoading = orderQueries.some((query) => query.isLoading);
  const isError = orderQueries.some((query) => query.isError);
  const isFetching = orderQueries.some((query) => query.isFetching);
  const orders: ReceiptListItem[] = orderQueries.some((query) => query.data === undefined)
    ? []
    : orderQueries
        .flatMap((query) => query.data ?? [])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  const hasNextPage = orderQueries.some((query) => (query.data?.length ?? 0) === PAGE_SIZE);
  const hasFilters = Boolean(
    appliedSearch || statusFilter !== "ALL" || dateRange.from || dateRange.to,
  );

  const columns: DataTableColumn<ReceiptListItem>[] = [
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
        <StatusBadge
          label={isReceiptStatus(row.status) ? RECEIPT_STATUS_LABELS[row.status] : row.status}
          tone={isReceiptStatus(row.status) ? RECEIPT_STATUS_TONES[row.status] : "neutral"}
        />
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-50 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Пошук за номером або статусом..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value === "ALL" || isReceiptStatus(value)) setStatusFilter(value);
            }}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі статуси</SelectItem>
              {RECEIPT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {RECEIPT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        {invalidRange ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Дата «від» має бути не пізніше за дату «до».
          </p>
        ) : null}
      </Card>

      {invalidRange ? null : isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState
          message="Не вдалося завантажити чеки."
          onRetry={() => {
            orderQueries.forEach((query) => {
              void query.refetch();
            });
          }}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          title={hasFilters ? "Чеків не знайдено" : "Чеків поки немає"}
          description={
            hasFilters
              ? "Спробуйте інший період, статус або пошук."
              : "Тут з'являться всі чеки після створення."
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(row) => row.id}
          paginate={false}
          onRowClick={(row) =>
            navigate({ to: "/panel/orders/$orderId", params: { orderId: String(row.id) } })
          }
        />
      )}

      {!invalidRange && !isLoading && !isError && (orders.length > 0 || currentPage > 1) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Сторінка {currentPage}
            {orders.length > 0 ? ` · ${orders.length} чеків` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching || currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching || !hasNextPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Далі
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
