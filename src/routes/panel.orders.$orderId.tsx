import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, Wallet } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  isReceiptStatus,
  RECEIPT_STATUSES,
  RECEIPT_STATUS_LABELS,
  RECEIPT_STATUS_TONES,
} from "@/lib/labels";
import { useOrdersApi } from "@horpynka/api-sdk";

interface ReceiptItem {
  id: number;
  sellingPrice: number;
  discount: string | null;
  discountType: string;
  dishId: number | null;
  productId: number | null;
  dish: { name: string } | null;
  product: { name: string } | null;
}

interface ReceiptDetails {
  id: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  orderPrice: number;
  paidWithCash: number;
  paidWithCard: number;
  refundedWithCash: number;
  refundedWithCard: number;
  orderItems: ReceiptItem[];
}

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

function itemName(item: ReceiptItem): string {
  return item.dish?.name || item.product?.name || "—";
}

function itemKind(item: ReceiptItem): string {
  if (item.dishId != null) return "Страва";
  if (item.productId != null) return "Товар";
  return "—";
}

function formatDiscountValue(discount: string | null, discountType: string): string {
  const value = discount?.trim() ?? "";
  if (discountType === "NONE" || value === "") return "Немає";
  if (discountType === "PERCENT") return value.endsWith("%") ? value : `${value}%`;
  if (discountType === "AMOUNT" && /^\d+$/.test(value)) return formatMoney(Number(value));
  return value;
}

function discountTypeLabel(discountType: string): string {
  if (discountType === "NONE" || discountType === "PERCENT" || discountType === "AMOUNT") {
    return discountType;
  }
  return discountType || "NONE";
}

function parseKopecks(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();

  const getOrder = useOrdersApi().getOrderQuery;
  const { data: order, isLoading, isError } = useQuery(getOrder(Number(orderId)));

  if (isLoading) return <LoadingState />;
  if (isError || !order) {
    return <ErrorState message="Не вдалося завантажити чек або чек не знайдено." />;
  }

  const items = order.orderItems;
  const totalRefund = order.refundedWithCash + order.refundedWithCard;
  const statusLabel = isReceiptStatus(order.status)
    ? RECEIPT_STATUS_LABELS[order.status]
    : order.status;

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
        <StatusBadge
          label={statusLabel}
          tone={isReceiptStatus(order.status) ? RECEIPT_STATUS_TONES[order.status] : "neutral"}
        />
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
            <p className="mt-2 text-sm text-muted-foreground">
              Готівка: {order.refundedWithCash} коп. · Картка: {order.refundedWithCard} коп.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Позиції чека</CardTitle>
          <CardDescription>Страви та товари у цьому чеку.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState title="Немає позицій" description="У цьому чеку поки немає позицій." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className="text-xs font-semibold uppercase">Назва</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Тип</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Знижка</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Тип знижки</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-right">
                      Ціна
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{itemName(item)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{itemKind(item)}</span>
                      </TableCell>
                      <TableCell>{formatDiscountValue(item.discount, item.discountType)}</TableCell>
                      <TableCell className="font-medium">
                        {discountTypeLabel(item.discountType)}
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

      <ReceiptCorrectionForm
        key={`${order.id}-${order.updatedAt}-${order.status}-${order.refundedWithCash}-${order.refundedWithCard}`}
        order={order}
      />
    </div>
  );
}

function ReceiptCorrectionForm({ order }: { order: ReceiptDetails }) {
  const { mutateUpdateOrder } = useOrdersApi();
  const [status, setStatus] = useState(order.status);
  const [refundedWithCash, setRefundedWithCash] = useState(String(order.refundedWithCash));
  const [refundedWithCard, setRefundedWithCard] = useState(String(order.refundedWithCard));
  const [errors, setErrors] = useState<{ cash?: string; card?: string; status?: string }>({});

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cash = parseKopecks(refundedWithCash);
    const card = parseKopecks(refundedWithCard);
    const nextErrors: { cash?: string; card?: string; status?: string } = {};
    if (!isReceiptStatus(status)) nextErrors.status = "Оберіть статус зі списку.";
    if (cash === null) nextErrors.cash = "Вкажіть ціле число копійок від 0.";
    if (card === null) nextErrors.card = "Вкажіть ціле число копійок від 0.";
    setErrors(nextErrors);
    if (cash === null || card === null || !isReceiptStatus(status)) return;

    mutateUpdateOrder.mutate({
      params: {
        id: order.id,
        updateOrderDto: {
          status,
          refundedWithCash: cash,
          refundedWithCard: card,
        },
      },
    });
  };

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle className="text-base">Статус і повернення</CardTitle>
          <CardDescription>
            Статус і суми повернення зберігаються цілими копійками. Новий чек тут не створюється.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="order-status">Статус</Label>
            <Select
              value={isReceiptStatus(status) ? status : undefined}
              onValueChange={(value) => {
                if (!isReceiptStatus(value)) return;
                setStatus(value);
                setErrors((current) => ({ ...current, status: undefined }));
              }}
            >
              <SelectTrigger id="order-status" aria-invalid={errors.status ? true : undefined}>
                <SelectValue placeholder="Оберіть статус" />
              </SelectTrigger>
              <SelectContent>
                {RECEIPT_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {RECEIPT_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.status ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.status}
              </p>
            ) : null}
          </div>

          <KopecksField
            id="refunded-cash"
            label="Повернення готівкою (коп.)"
            value={refundedWithCash}
            error={errors.cash}
            onChange={(value) => {
              setRefundedWithCash(value);
              setErrors((current) => ({ ...current, cash: undefined }));
            }}
          />
          <KopecksField
            id="refunded-card"
            label="Повернення карткою (коп.)"
            value={refundedWithCard}
            error={errors.card}
            onChange={(value) => {
              setRefundedWithCard(value);
              setErrors((current) => ({ ...current, card: undefined }));
            }}
          />

          {mutateUpdateOrder.isError ? (
            <p className="text-sm text-destructive sm:col-span-3" role="alert">
              Не вдалося зберегти зміни.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={mutateUpdateOrder.isPending}>
            {mutateUpdateOrder.isPending ? "Збереження..." : "Зберегти"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function KopecksField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
