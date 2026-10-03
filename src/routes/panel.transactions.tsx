import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, Search } from "lucide-react";

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
import {
  TRANSACTION_KIND_LABELS,
  TRANSACTION_KIND_TONES,
  PAYMENT_METHOD_LABELS,
  type BadgeTone,
} from "@/lib/labels";
import type { Transaction, TransactionKind, PaymentMethod } from "@/types/domain";
import { useTransactionsApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/transactions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Транзакції — адмін-панель бістро та магазину" },
      { name: "description", content: "Рух коштів по касах і терміналах." },
      { property: "og:title", content: "Транзакції — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Рух коштів по касах і терміналах." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<TransactionKind | "ALL">("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "ALL">("ALL");

  const getTransactions = useTransactionsApi().getTransactionsQuery;
  const { data: transactions, isLoading, isError } = useQuery(getTransactions());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити транзакції." />;
  if (!transactions) return null;

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch = search
      ? String(transaction.orderId).includes(search) ||
        TRANSACTION_KIND_LABELS[transaction.kind].toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesKind = kindFilter === "ALL" || transaction.kind === kindFilter;
    const matchesPayment = paymentFilter === "ALL" || transaction.paymentMethod === paymentFilter;
    return matchesSearch && matchesKind && matchesPayment;
  });

  const columns: DataTableColumn<Transaction>[] = [
    {
      id: "orderId",
      header: "№ чека",
      cell: (row) => <span className="font-medium">#{row.orderId}</span>,
      sortValue: (row) => row.orderId,
    },
    {
      id: "createdAt",
      header: "Дата",
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => row.createdAt,
      hideBelow: "md",
    },
    {
      id: "kind",
      header: "Тип",
      cell: (row) => (
        <StatusBadge tone={TRANSACTION_KIND_TONES[row.kind] as BadgeTone}>
          {TRANSACTION_KIND_LABELS[row.kind]}
        </StatusBadge>
      ),
      sortValue: (row) => row.kind,
    },
    {
      id: "paymentMethod",
      header: "Спосіб оплати",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {PAYMENT_METHOD_LABELS[row.paymentMethod]}
        </span>
      ),
      sortValue: (row) => row.paymentMethod,
      hideBelow: "lg",
    },
    {
      id: "amount",
      header: "Сума",
      cell: (row) => <span className="font-semibold">{formatMoney(row.amount)}</span>,
      sortValue: (row) => row.amount,
      align: "right",
    },
    {
      id: "refund",
      header: "Повернення",
      cell: (row) =>
        row.refundedAmount > 0 ? (
          <span className="text-destructive">{formatMoney(row.refundedAmount)}</span>
        ) : (
          "—"
        ),
      sortValue: (row) => row.refundedAmount,
      align: "right",
      hideBelow: "xl",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Транзакції</h1>
        <p className="mt-1 text-sm text-muted-foreground">Рух коштів по касах і терміналах.</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Пошук за номером чека..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={kindFilter}
            onValueChange={(v) => setKindFilter(v as TransactionKind | "ALL")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі типи</SelectItem>
              {Object.entries(TRANSACTION_KIND_LABELS).map(([kind, label]) => (
                <SelectItem key={kind} value={kind}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={paymentFilter}
            onValueChange={(v) => setPaymentFilter(v as PaymentMethod | "ALL")}
          >
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Спосіб оплати" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Усі способи</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => (
                <SelectItem key={method} value={method}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filteredTransactions}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({ to: "/panel/orders/$orderId", params: { orderId: String(row.orderId) } })
        }
        emptyState={
          <EmptyState
            icon={ArrowDownUp}
            title="Транзакцій поки немає"
            description="Тут з'являться всі фінансові операції."
          />
        }
      />
    </div>
  );
}
