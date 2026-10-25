import { formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, TRANSACTION_KIND_LABELS } from "@/lib/labels";
import type { Transaction } from "@/types/domain";

/** Суми в копійках; одиниця вказана в заголовку колонки. */
const CSV_HEADERS = [
  "Дата",
  "Замовлення",
  "Тип",
  "Спосіб оплати",
  "Сума (коп.)",
  "Повернення (коп.)",
] as const;

function escapeCsvField(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildTransactionsCsv(rows: readonly Transaction[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((row) =>
      [
        formatDateTime(row.createdAt),
        `#${row.orderId}`,
        TRANSACTION_KIND_LABELS[row.kind],
        PAYMENT_METHOD_LABELS[row.paymentMethod],
        row.amount,
        row.refundedAmount,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

export function downloadTransactionsCsv(rows: readonly Transaction[]): void {
  const blob = new Blob([buildTransactionsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
