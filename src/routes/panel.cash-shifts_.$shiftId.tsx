import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatMoney, parseKopecks } from "@/lib/format";
import { CASH_SHIFT_STATUS_LABELS, CASH_SHIFT_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import { useCashShiftsApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/cash-shifts_/$shiftId")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Касова зміна #${params.shiftId} — адмін-панель бістро та магазину` },
      { name: "description", content: "Картка касової зміни." },
      {
        property: "og:title",
        content: `Касова зміна #${params.shiftId} — адмін-панель бістро та магазину`,
      },
      { property: "og:description", content: "Картка касової зміни." },
    ],
  }),
  component: CashShiftDetailsPage,
});

function CashShiftDetailsPage() {
  const { shiftId: shiftIdParam } = Route.useParams();
  const navigate = useNavigate();
  const shiftId = Number(shiftIdParam);
  const shiftIdIsValid = Number.isInteger(shiftId) && shiftId > 0;

  const getShift = useCashShiftsApi().getCashShiftQuery;
  const {
    data: shift,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    ...getShift(shiftIdIsValid ? shiftId : 0),
    enabled: shiftIdIsValid,
  });

  if (!shiftIdIsValid) {
    return <ErrorState message="Некоректний номер касової зміни." />;
  }
  if (isLoading) return <LoadingState />;
  if (isError || !shift) {
    return (
      <ErrorState
        message="Не вдалося завантажити касову зміну або її не знайдено."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/panel/cash-shifts" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Касова зміна #{shift.id}</CardTitle>
            <StatusBadge
              tone={CASH_SHIFT_STATUS_TONES[shift.status] as BadgeTone}
              label={CASH_SHIFT_STATUS_LABELS[shift.status]}
            />
          </div>
          <CardDescription>
            Кінцевий залишок — початковий залишок плюс готівка мінус готівкові повернення. Продажі
            карткою в нього не входять.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Касир" value={shift.cashierName} />
            <Detail label="Статус" value={CASH_SHIFT_STATUS_LABELS[shift.status]} />
            <Detail label="Відкрита" value={formatDateTime(shift.openedAt)} />
            <Detail label="Закрита" value={shift.closedAt ? formatDateTime(shift.closedAt) : "—"} />
            <Detail label="Початковий залишок" value={formatMoney(shift.openingBalance)} />
            <Detail label="Кінцевий залишок" value={formatMoney(shift.closingBalance)} />
            <Detail label="Готівка" value={formatMoney(shift.cashSales)} />
            <Detail label="Картка" value={formatMoney(shift.cardSales)} />
            <Detail label="Повернення" value={formatMoney(shift.refunds)} />
            <Detail label="Чеків" value={String(shift.ordersCount)} />
            {shift.actualClosingBalance !== null ? (
              <Detail label="Порахована готівка" value={formatMoney(shift.actualClosingBalance)} />
            ) : null}
            {shift.difference !== null ? (
              <Detail label="Розбіжність" value={formatSignedMoney(shift.difference)} />
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {shift.status === "OPEN" ? (
        <CloseShiftForm shiftId={shift.id} expectedClosingBalance={shift.closingBalance} />
      ) : null}
    </div>
  );
}

function CloseShiftForm({
  shiftId,
  expectedClosingBalance,
}: {
  shiftId: number;
  expectedClosingBalance: number;
}) {
  const queryClient = useQueryClient();
  const { mutateCloseCashShift } = useCashShiftsApi();
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    const actualClosingBalance = parseKopecks(amount);
    if (actualClosingBalance === null) {
      setFieldError("Вкажіть суму від 0 грн з точністю до копійки.");
      return;
    }

    setFieldError(null);
    mutateCloseCashShift.mutate(
      { params: { id: shiftId, closeCashShiftDto: { actualClosingBalance } } },
      {
        onSuccess: () => {
          setAmount("");
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
        onError: (error) => {
          setApiError(apiErrorMessage(error, "Не вдалося закрити зміну. Спробуйте ще раз."));
        },
      },
    );
  };

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle className="text-base">Закрити зміну</CardTitle>
          <CardDescription>
            Порахуйте готівку в касі. Система запише кінцевий залишок сама і поставить час закриття.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Очікуваний залишок:{" "}
            <span className="font-medium text-foreground">
              {formatMoney(expectedClosingBalance)}
            </span>
          </p>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="actualClosingBalance">Порахована готівка, грн</Label>
            <Input
              id="actualClosingBalance"
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
          </div>
          {apiError ? (
            <p className="text-sm text-destructive" role="alert">
              {apiError}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={mutateCloseCashShift.isPending}>
            Закрити зміну
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}

function formatSignedMoney(amountInKopecks: number): string {
  if (amountInKopecks > 0) return `+${formatMoney(amountInKopecks)}`;
  return formatMoney(amountInKopecks);
}
