import type {
  CashShiftStatus,
  DiscountType,
  InventoryStatus,
  MeasurementUnit,
  MenuItemKind,
  OrderStatus,
  PaymentMethod,
  TransactionKind,
} from "@/types/domain";

export type BadgeTone = "neutral" | "success" | "warning" | "destructive" | "info";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Створений",
  PAID: "Оплачений",
  CLOSED: "Закритий",
  REFUNDED: "Повернений",
  CANCELED: "Скасований",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  CREATED: "warning",
  PAID: "info",
  CLOSED: "success",
  REFUNDED: "destructive",
  CANCELED: "neutral",
};

/** Statuses accepted by PATCH /orders/:id and GET /orders. */
export const RECEIPT_STATUSES = [
  "CREATED",
  "PAID",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DELETED",
] as const;

export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  CREATED: "Створений",
  PAID: "Оплачений",
  COMPLETED: "Завершений",
  CANCELLED: "Скасований",
  REFUNDED: "Повернений",
  DELETED: "Видалений",
};

export const RECEIPT_STATUS_TONES: Record<ReceiptStatus, BadgeTone> = {
  CREATED: "warning",
  PAID: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REFUNDED: "destructive",
  DELETED: "neutral",
};

export function isReceiptStatus(value: string): value is ReceiptStatus {
  return (RECEIPT_STATUSES as readonly string[]).includes(value);
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Готівка",
  CARD: "Картка",
  MIXED: "Змішана оплата",
};

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  SALE: "Продаж",
  REFUND: "Повернення",
};

export const TRANSACTION_KIND_TONES: Record<TransactionKind, BadgeTone> = {
  SALE: "success",
  REFUND: "destructive",
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  NONE: "Без знижки",
  PERCENT: "Відсоток",
  AMOUNT: "Сума",
};

export const CASH_SHIFT_STATUS_LABELS: Record<CashShiftStatus, string> = {
  OPEN: "Відкрита",
  CLOSED: "Закрита",
};

export const CASH_SHIFT_STATUS_TONES: Record<CashShiftStatus, BadgeTone> = {
  OPEN: "warning",
  CLOSED: "success",
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  COMPLETED: "Завершена",
  WITH_DIFFERENCES: "Є розбіжності",
  IN_PROGRESS: "Триває",
};

export const INVENTORY_STATUS_TONES: Record<InventoryStatus, BadgeTone> = {
  COMPLETED: "success",
  WITH_DIFFERENCES: "warning",
  IN_PROGRESS: "info",
};

export const MENU_ITEM_KIND_LABELS: Record<MenuItemKind, string> = {
  DISH: "Страва",
  PRODUCT: "Товар",
};

export const MEASUREMENT_UNITS: { value: MeasurementUnit; label: string }[] = [
  { value: "g", label: "г" },
  { value: "ml", label: "мл" },
  { value: "pcs", label: "шт." },
];

export const SELLING_LABELS = {
  true: "Продається",
  false: "Не продається",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  HORPYNKA_PANEL_ADMIN: "Адміністратор панелі",
  HORPYNKA_CASHIER_USER: "Касир",
  ROLE_ADMIN: "Адміністратор",
  ROLE_MANAGER: "Менеджер",
  ROLE_CASHIER: "Касир",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
