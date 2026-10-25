import type { MeasurementUnit } from "@/types/domain";

/**
 * Грошові суми зберігаються як integer (копійки).
 * Форматування виконується цілочисельно, без floating-point арифметики.
 */
export function formatMoney(amountInKopecks: number): string {
  const negative = amountInKopecks < 0;
  const abs = Math.abs(Math.trunc(amountInKopecks));
  const hryvnias = Math.trunc(abs / 100);
  const kopecks = abs % 100;
  const groupedHryvnias = String(hryvnias).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${negative ? "−" : ""}${groupedHryvnias},${String(kopecks).padStart(2, "0")}\u00a0грн`;
}

/** Перетворює введене користувачем значення в гривнях у копійки. */
export function toKopecks(value: number): number {
  return Math.round(value * 100);
}

/**
 * Розбирає невід'ємну суму в гривнях у цілі копійки.
 * Приймає «500», «500,50», «500.5» і пробіли як роздільник тисяч.
 * Повертає null, якщо текст порожній або це не сума з точністю до копійки.
 */
export function parseKopecks(raw: string): number | null {
  const compact = raw.trim().replace(/\s/g, "").replace(",", ".");
  const normalized = compact.endsWith(".") ? compact.slice(0, -1) : compact;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const hryvnias = Number(whole);
  const kopecks = hryvnias * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(hryvnias) || !Number.isSafeInteger(kopecks)) return null;
  return kopecks;
}

/** Перетворює копійки у число гривень для полів форми. */
export function toHryvnias(value: number): number {
  return Math.round(value) / 100;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATE_FORMATTER.format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return TIME_FORMATTER.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return `${DATE_FORMATTER.format(date)}, ${TIME_FORMATTER.format(date)}`;
}

/** Дата у форматі YYYY-MM-DD для порівнянь та полів типу date. */
export function toDateInputValue(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatQuantity(value: number, unit: MeasurementUnit): string {
  const formatted = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value);
  return `${formatted} ${measurementUnitLabel(unit)}`;
}

export function measurementUnitLabel(unit: MeasurementUnit): string {
  switch (unit) {
    case "g":
      return "г";
    case "ml":
      return "мл";
    case "pcs":
      return "шт.";
    default:
      return unit;
  }
}
