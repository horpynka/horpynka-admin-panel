import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { apiErrorMessage } from "@/lib/api-error";
import { formatMoney, formatDateTime, parseKopecks } from "@/lib/format";
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
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<CashShiftStatus | "ALL">("ALL");
  const [openDialog, setOpenDialog] = useState(false);

  const getShifts = useCashShiftsApi().getCashShiftsQuery;
  const { data: shifts, isLoading, isError, refetch } = useQuery(getShifts());

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <ErrorState
        message="Не вдалося завантажити касові зміни."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!shifts) return null;

  const openShift = shifts.find((shift) => shift.status === "OPEN");
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
        <StatusBadge
          tone={CASH_SHIFT_STATUS_TONES[row.status] as BadgeTone}
          label={CASH_SHIFT_STATUS_LABELS[row.status]}
        />
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Касові зміни</h1>
          <p className="mt-1 text-sm text-muted-foreground">Відкриття та закриття змін касирів.</p>
        </div>
        <Button onClick={() => setOpenDialog(true)} disabled={Boolean(openShift)}>
          <Plus className="h-4 w-4 mr-1" />
          Відкрити зміну
        </Button>
      </div>

      {openShift ? (
        <p className="text-sm text-muted-foreground">
          Зараз відкрита зміна #{openShift.id}. Другу можна відкрити лише після закриття поточної.{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              navigate({
                to: "/panel/cash-shifts/$shiftId",
                params: { shiftId: String(openShift.id) },
              })
            }
          >
            Перейти до зміни
          </Button>
        </p>
      ) : null}

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
        onRowClick={(row) =>
          navigate({ to: "/panel/cash-shifts/$shiftId", params: { shiftId: String(row.id) } })
        }
        emptyState={
          <EmptyState
            title="Касових змін поки немає"
            description="Тут з'являться всі касові зміни."
          />
        }
      />

      <OpenShiftDialog open={openDialog} onOpenChange={setOpenDialog} />
    </div>
  );
}

function OpenShiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateOpenCashShift } = useCashShiftsApi();
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const reset = () => {
    setAmount("");
    setFieldError(null);
    setApiError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    const openingBalance = parseKopecks(amount);
    if (openingBalance === null) {
      setFieldError("Вкажіть суму від 0 грн з точністю до копійки.");
      return;
    }

    setFieldError(null);
    mutateOpenCashShift.mutate(
      { params: { openCashShiftDto: { openingBalance } } },
      {
        onSuccess: (response) => {
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          handleOpenChange(false);
          navigate({
            to: "/panel/cash-shifts/$shiftId",
            params: { shiftId: String(response.data.id) },
          });
        },
        onError: (error) => {
          setApiError(apiErrorMessage(error, "Не вдалося відкрити зміну. Спробуйте ще раз."));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Відкрити зміну</DialogTitle>
            <DialogDescription>
              Вкажіть готівку в касі на початок зміни. Одночасно може бути відкрита лише одна зміна.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="openingBalance">Початковий залишок, грн</Label>
            <Input
              id="openingBalance"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
            />
            <FieldError message={fieldError ?? undefined} />
            {apiError ? (
              <p className="text-sm text-destructive" role="alert">
                {apiError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={mutateOpenCashShift.isPending}>
              Відкрити
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}
