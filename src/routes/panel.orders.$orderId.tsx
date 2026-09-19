import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, CreditCard, Wallet } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, type BadgeTone } from "@/lib/labels";
import { useOrdersApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/orders/$orderId")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Чек #${params.orderId} — адмін-панель бістро та магазину` },
      { name: "description", content: "Деталі чека та позиції." },
      { property: "og:title", content: `Чек #${params.orderId} — адмін-панель бістро та магазину` },
      { property: "og:description", content: "Деталі чека та позиції." },
    ],
  }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const getOrder = useOrdersApi().getOrderQuery;
  const { data: order, isLoading, isError } = useQuery(getOrder(Number(orderId)));

  if (isLoading) return <LoadingState />;
  if (isError || !order) {
    return <ErrorState message="Не вдалося завантажити чек або чек не знайдено." />;
  }

  const { orderItems: items } = order;

  const totalRefund = order.refundedWithCash + order.refundedWithCard;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/panel/orders" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Чек #{order.id}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge tone={ORDER_STATUS_TONES[order.status] as BadgeTone}>
          {ORDER_STATUS_LABELS[order.status]}
        </StatusBadge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Готівка
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(order.paidWithCash)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Картка
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(order.paidWithCard)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Повернення</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRefund > 0 ? "text-destructive" : ""}`}>
              {formatMoney(totalRefund)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Позиції чека</CardTitle>
          <CardDescription>Страви та товари у цьому чеку.</CardDescription>
        </CardHeader>
        <CardContent>
          {!items || items.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Немає позицій"
              description="У цьому чеку поки немає позицій."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className="text-xs font-semibold uppercase">Назва</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Тип</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-right">
                      Ціна
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {item.itemType === "dish" ? "Страва" : "Товар"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(item.sellingPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex justify-between items-center text-lg font-bold">
            <span>Загальна сума:</span>
            <span>{formatMoney(order.orderPrice)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
