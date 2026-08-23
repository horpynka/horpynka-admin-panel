import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  CheckCircle,
  Wallet,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/common/states";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMoney, formatDateTime } from "@/lib/format";
import { CASH_SHIFT_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import { dashboardRepository } from "@/repositories/dashboard";

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
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardRepository.getStats(),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити статистику." />;
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Панель</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ключові показники продажів бістро та магазину.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Продажі сьогодні
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Готівка
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.cashSales)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Картка
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(stats.cardSales)}</div>
          </CardContent>
        </Card>
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
              Повернення сьогодні
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
              <StatusBadge tone={CASH_SHIFT_STATUS_TONES[stats.currentShift.status] as BadgeTone}>
                Відкрита
              </StatusBadge>
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
          <CardTitle className="text-base">Продажі за останні 7 днів</CardTitle>
          <CardDescription>Динаміка продажів та кількості чеків</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.salesByDay.map((day) => {
              const date = new Date(day.date);
              const dateStr = date.toLocaleDateString("uk-UA", {
                day: "2-digit",
                month: "short",
                weekday: "short",
              });

              const maxSales = Math.max(...stats.salesByDay.map((d) => d.sales));
              const percentage = (day.sales / maxSales) * 100;

              return (
                <div key={day.date} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-muted-foreground">{dateStr}</div>
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
        </CardContent>
      </Card>
    </div>
  );
}
