import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, ShoppingCart, Clock, Wallet, CreditCard, AlertTriangle } from "lucide-react";
import { dashboardApi } from "@horpynka/api-sdk";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ErrorState, LoadingState } from "@/components/common/states";
import { DateRangeFilter, type DateRange } from "@/components/common/date-range-filter";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney, formatDateTime } from "@/lib/format";
import {
  customRangeIssue,
  formatChartDay,
  formatIsoDate,
  presetRange,
  resolveDashboardRange,
  type DashboardPeriodPreset,
} from "@/lib/dashboard-period";
import { CASH_SHIFT_STATUS_TONES, type BadgeTone } from "@/lib/labels";

const PERIODS: { id: DashboardPeriodPreset; label: string }[] = [
  { id: "today", label: "Сьогодні" },
  { id: "7d", label: "7 днів" },
  { id: "30d", label: "30 днів" },
  { id: "custom", label: "Довільний діапазон" },
];

const PAYMENT_ORDER = ["Готівка", "Картка"] as const;

export const Route = createFileRoute("/panel/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Панель — адмін-панель бістро та магазину" },
      { name: "description", content: "Ключові показники продажів бістро та магазину." },
      { property: "og:title", content: "Панель — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Ключові показники продажів бістро та магазину." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [preset, setPreset] = useState<DashboardPeriodPreset>("today");
  const [customRange, setCustomRange] = useState<DateRange>({ from: "", to: "" });
  const range = resolveDashboardRange(preset, customRange);
  const rangeIssue = preset === "custom" ? customRangeIssue(customRange) : null;

  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard", "stats", range?.from, range?.to],
    queryFn: () => dashboardApi.getStats(range!.from, range!.to).then((response) => response.data),
    enabled: range !== null,
  });

  const selectPreset = (next: string) => {
    if (next !== "today" && next !== "7d" && next !== "30d" && next !== "custom") return;
    if (next === "custom") {
      setCustomRange((current) => {
        if (current.from && current.to) return current;
        return presetRange(preset === "custom" ? "today" : preset);
      });
    }
    setPreset(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Панель</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ключові показники продажів бістро та магазину.
          </p>
          {range ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatIsoDate(range.from)} — {formatIsoDate(range.to)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={preset}
            onValueChange={selectPreset}
            aria-label="Період"
            className="flex-wrap justify-start"
          >
            {PERIODS.map((period) => (
              <ToggleGroupItem key={period.id} value={period.id} className="px-3">
                {period.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {preset === "custom" ? (
            <DateRangeFilter value={customRange} onChange={setCustomRange} />
          ) : null}
        </div>
      </div>

      {rangeIssue === "incomplete" ? (
        <p className="text-sm text-muted-foreground">Вкажіть дату від і дату до.</p>
      ) : null}
      {rangeIssue === "inverted" ? (
        <p className="text-sm text-destructive">Дата «від» має бути не пізніше за дату «до».</p>
      ) : null}

      {range && isLoading ? <LoadingState /> : null}
      {range && isError ? (
        <ErrorState message="Не вдалося завантажити статистику." onRetry={() => refetch()} />
      ) : null}
      {range && stats ? <DashboardStatsView preset={preset} stats={stats} /> : null}
    </div>
  );
}

function salesTitle(preset: DashboardPeriodPreset): string {
  switch (preset) {
    case "today":
      return "Продажі сьогодні";
    case "7d":
      return "Продажі за 7 днів";
    case "30d":
      return "Продажі за 30 днів";
    default:
      return "Продажі за період";
  }
}

function barsTitle(preset: DashboardPeriodPreset): string {
  switch (preset) {
    case "today":
      return "Продажі за сьогодні";
    case "7d":
      return "Продажі за останні 7 днів";
    case "30d":
      return "Продажі за останні 30 днів";
    default:
      return "Продажі за вибраний період";
  }
}

function orderedPaymentSplit(split: { name: string; value: number }[]) {
  const preferred = PAYMENT_ORDER.flatMap((name) => {
    const item = split.find((entry) => entry.name === name);
    return item ? [item] : [];
  });
  const preferredNames = new Set<string>(PAYMENT_ORDER);
  const extras = split.filter((item) => !preferredNames.has(item.name));
  const items = [...preferred, ...extras];
  if (items.length > 0) return items;
  return PAYMENT_ORDER.map((name) => ({ name, value: 0 }));
}

function shareLabel(value: number, total: number): string {
  if (total <= 0) return "0%";
  const tenths = Math.round((value * 1000) / total);
  const whole = Math.trunc(tenths / 10);
  const fraction = Math.abs(tenths % 10);
  return fraction === 0 ? `${whole}%` : `${whole},${fraction}%`;
}

function DashboardStatsView({
  preset,
  stats,
}: {
  preset: DashboardPeriodPreset;
  stats: {
    todaySales: number;
    ordersCount: number;
    openOrders: number;
    closedOrders: number;
    refunds: number;
    averageOrder: number;
    currentShift: {
      status: keyof typeof CASH_SHIFT_STATUS_TONES;
      openedAt: string;
      cashierName: string;
      openingBalance: number;
      cashSales: number;
      closingBalance: number;
    } | null;
    salesByDay: { date: string; sales: number; orders: number }[];
    paymentSplit: { name: string; value: number }[];
  };
}) {
  const paymentItems = orderedPaymentSplit(stats.paymentSplit);
  const paymentTotal = paymentItems.reduce((sum, item) => sum + item.value, 0);
  const maxSales = stats.salesByDay.reduce((max, day) => Math.max(max, day.sales), 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {salesTitle(preset)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.todaySales)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Середній чек: {formatMoney(stats.averageOrder)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Кількість чеків
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ordersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Закритих: {stats.closedOrders}</p>
          </CardContent>
        </Card>

        {paymentItems.map((item) => (
          <Card key={item.name}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {item.name === "Картка" ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {item.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(item.value)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {shareLabel(item.value, paymentTotal)} від оплат періоду
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.openOrders > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Відкриті чеки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Зараз {stats.openOrders}{" "}
              {stats.openOrders === 1 ? "відкритий чек" : "відкритих чеків"}
            </p>
          </CardContent>
        </Card>
      )}

      {stats.refunds > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {preset === "today" ? "Повернення сьогодні" : "Повернення за період"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-destructive">{formatMoney(stats.refunds)}</div>
          </CardContent>
        </Card>
      )}

      {stats.currentShift && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Поточна касова зміна</CardTitle>
              <StatusBadge
                label="Відкрита"
                tone={CASH_SHIFT_STATUS_TONES[stats.currentShift.status] as BadgeTone}
              />
            </div>
            <CardDescription>
              Відкрита: {formatDateTime(stats.currentShift.openedAt)} · Касир:{" "}
              {stats.currentShift.cashierName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Початковий залишок</p>
                <p className="text-lg font-semibold">
                  {formatMoney(stats.currentShift.openingBalance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Продажі готівкою</p>
                <p className="text-lg font-semibold">{formatMoney(stats.currentShift.cashSales)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Поточний залишок</p>
                <p className="text-lg font-semibold">
                  {formatMoney(stats.currentShift.closingBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{barsTitle(preset)}</CardTitle>
          <CardDescription>Динаміка продажів та кількості чеків</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.salesByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">Немає даних за вибраний період.</p>
          ) : (
            <div className="space-y-2">
              {stats.salesByDay.map((day) => {
                const percentage = maxSales > 0 ? (day.sales / maxSales) * 100 : 0;

                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-sm text-muted-foreground">
                      {formatChartDay(day.date)}
                    </div>
                    <div className="flex-1">
                      <div className="h-8 rounded bg-secondary relative overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-32 text-right">
                      <div className="text-sm font-semibold">{formatMoney(day.sales)}</div>
                      <div className="text-xs text-muted-foreground">{day.orders} чеків</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
