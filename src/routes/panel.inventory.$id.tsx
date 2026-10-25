import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatQuantity, measurementUnitLabel } from "@/lib/format";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Inventory, InventoryItem, MeasurementUnit } from "@/types/domain";
import { useInventoryApi } from "@horpynka/api-sdk";

const ACTUALS_REQUIRED_MESSAGE = "Заповніть фактичну кількість у кожному рядку.";

export const Route = createFileRoute("/panel/inventory/$id")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Інвентаризація #${params.id} — адмін-панель бістро та магазину` },
      { name: "description", content: "Позиції перевірки залишків і фактичні кількості." },
      {
        property: "og:title",
        content: `Інвентаризація #${params.id} — адмін-панель бістро та магазину`,
      },
      { property: "og:description", content: "Позиції перевірки залишків і фактичні кількості." },
    ],
  }),
  component: InventoryDetailsPage,
});

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }

  const data = error.response.data;
  const message =
    data && typeof data === "object" && "message" in data
      ? (data as { message?: unknown }).message
      : undefined;

  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const lines = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (lines.length > 0) return lines.join(" ");
  }

  return fallback;
}

function draftsFromItems(items: InventoryItem[]): Record<number, string> {
  return Object.fromEntries(
    items.map((item) => [item.id, item.actualQuantity === null ? "" : String(item.actualQuantity)]),
  );
}

function parseActualQuantity(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value)) return undefined;
  return value;
}

function countedDifference(actual: number | null, expected: number): number | null {
  if (actual === null) return null;
  return actual - expected;
}

function formatDifference(difference: number | null, unit: MeasurementUnit): string {
  if (difference === null) return "—";
  if (difference > 0) return `+${formatQuantity(difference, unit)}`;
  return formatQuantity(difference, unit);
}

function differenceClassName(difference: number | null): string {
  if (difference === null || difference === 0) return "text-muted-foreground";
  return difference > 0 ? "text-success" : "text-destructive";
}

type CountedItem = {
  id: number;
  actualQuantity: number | null;
};

function collectCounts(
  items: InventoryItem[],
  drafts: Record<number, string>,
): { ok: true; items: CountedItem[] } | { ok: false; message: string } {
  const counts: CountedItem[] = [];

  for (const item of items) {
    const actualQuantity = parseActualQuantity(drafts[item.id] ?? "");
    if (actualQuantity === undefined) {
      return { ok: false, message: "Фактична кількість має бути цілим невід’ємним числом." };
    }
    counts.push({ id: item.id, actualQuantity });
  }

  return { ok: true, items: counts };
}

function countsDiffer(items: InventoryItem[], counts: CountedItem[]): boolean {
  return counts.some((count) => {
    const item = items.find((candidate) => candidate.id === count.id);
    return item?.actualQuantity !== count.actualQuantity;
  });
}

/**
 * Згенерований клієнт типізує `items` як Set, але сервер приймає JSON-масив.
 * Set серіалізується в `{}`, тому в запит іде звичайний масив.
 */
function saveInventoryDto(items: CountedItem[]) {
  return { items } as unknown as {
    items: Set<{ id: number; actualQuantity: number | null }>;
  };
}

function InventoryDetailsPage() {
  const { id } = Route.useParams();
  const parsedId = Number(id);
  const idIsValid = Number.isInteger(parsedId) && parsedId > 0;
  const { getInventoryQuery } = useInventoryApi();
  const inventoryQuery = useQuery({
    ...getInventoryQuery(idIsValid ? parsedId : 0),
    enabled: idIsValid,
  });

  if (!idIsValid) {
    return <ErrorState message="Не вдалося завантажити перевірку або її не знайдено." />;
  }

  if (inventoryQuery.isLoading) return <LoadingState />;

  if (inventoryQuery.isError || !inventoryQuery.data) {
    return (
      <ErrorState
        message="Не вдалося завантажити перевірку або її не знайдено."
        onRetry={() => {
          void inventoryQuery.refetch();
        }}
      />
    );
  }

  return <InventoryCheck key={inventoryQuery.data.id} inventory={inventoryQuery.data} />;
}

function InventoryCheck({ inventory }: { inventory: Inventory }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateSaveInventoryActualQuantities, mutateCompleteInventory } = useInventoryApi();
  const [drafts, setDrafts] = useState<Record<number, string>>(() =>
    draftsFromItems(inventory.items),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const editable = inventory.status === "IN_PROGRESS";
  const saving = mutateSaveInventoryActualQuantities.isPending;
  const completing = mutateCompleteInventory.isPending;
  const pending = saving || completing;

  const updateDraft = (itemId: number, raw: string) => {
    const compact = raw.replace(/\s/g, "");
    if (compact !== "" && !/^\d+$/.test(compact)) return;
    setDrafts((current) => ({ ...current, [itemId]: compact }));
    setSavedNotice(null);
    setFormError(null);
  };

  const persistCounts = (counts: CountedItem[], onSaved: () => void) => {
    mutateSaveInventoryActualQuantities.mutate(
      {
        params: {
          id: inventory.id,
          saveInventoryDto: saveInventoryDto(counts),
        },
      },
      {
        onSuccess: (response) => {
          queryClient.setQueryData(["inventory", inventory.id], response.data);
          onSaved();
        },
        onError: (error) => {
          setFormError(apiErrorMessage(error, "Не вдалося зберегти фактичні кількості."));
        },
      },
    );
  };

  const onSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    setSavedNotice(null);
    const collected = collectCounts(inventory.items, drafts);
    if (!collected.ok) {
      setFormError(collected.message);
      return;
    }
    persistCounts(collected.items, () => {
      setSavedNotice("Фактичні кількості збережено. Статус лишається «Триває».");
      setShowMissing(false);
    });
  };

  const onComplete = () => {
    if (pending) return;
    setFormError(null);
    setSavedNotice(null);
    const collected = collectCounts(inventory.items, drafts);
    if (!collected.ok) {
      setFormError(collected.message);
      return;
    }
    if (collected.items.some((item) => item.actualQuantity === null)) {
      setShowMissing(true);
      setFormError(ACTUALS_REQUIRED_MESSAGE);
      return;
    }

    const finish = () => {
      mutateCompleteInventory.mutate(
        { params: { id: inventory.id } },
        {
          onSuccess: (response) => {
            queryClient.setQueryData(["inventory", inventory.id], response.data);
          },
          onError: (error) => {
            setFormError(apiErrorMessage(error, "Не вдалося завершити перевірку."));
          },
        },
      );
    };

    if (countsDiffer(inventory.items, collected.items)) {
      persistCounts(collected.items, finish);
      return;
    }

    finish();
  };

  const draftsDirty = editable && countsDifferFromDrafts(inventory.items, drafts);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/panel/inventory" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Інвентаризація #{inventory.id}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Початок: {formatDateTime(inventory.createdAt)} · {inventory.responsible}
            {inventory.finishedAt ? ` · Завершення: ${formatDateTime(inventory.finishedAt)}` : ""}
          </p>
        </div>
        <StatusBadge
          tone={INVENTORY_STATUS_TONES[inventory.status]}
          label={INVENTORY_STATUS_LABELS[inventory.status]}
        />
      </div>

      <Card>
        <form onSubmit={onSave} noValidate>
          <CardContent className="p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              {editable
                ? "Очікувана кількість — знімок залишку на початок перевірки. Вона не змінюється, навіть якщо живий залишок змінився."
                : "Перевірку завершено. Фактичні кількості лише для перегляду."}
            </p>

            {inventory.items.length === 0 ? (
              <EmptyState
                title="У перевірці немає позицій"
                description="Немає інгредієнтів і продуктів із кількісним залишком."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60">
                      <TableHead className="text-xs font-semibold uppercase">Назва</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Одиниця</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-right">
                        Очікувано
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-right">
                        Фактично
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-right">
                        Різниця
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.items.map((item) => {
                      const draft = drafts[item.id] ?? "";
                      const parsedActual = editable
                        ? parseActualQuantity(draft)
                        : item.actualQuantity;
                      const actual = parsedActual === undefined ? null : parsedActual;
                      const difference = countedDifference(actual, item.expectedQuantity);
                      const missing = showMissing && editable && draft.trim() === "";

                      return (
                        <TableRow
                          key={item.id}
                          className={cn(difference !== null && difference !== 0 && "bg-warning/10")}
                        >
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {measurementUnitLabel(item.measurementUnit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQuantity(item.expectedQuantity, item.measurementUnit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {editable ? (
                              <Input
                                value={draft}
                                inputMode="numeric"
                                aria-label={`Фактична кількість: ${item.name}`}
                                aria-invalid={missing || undefined}
                                className={cn(
                                  "ml-auto h-8 w-28 text-right",
                                  missing && "border-destructive",
                                )}
                                onChange={(event) => updateDraft(item.id, event.target.value)}
                                disabled={pending}
                              />
                            ) : item.actualQuantity === null ? (
                              "—"
                            ) : (
                              formatQuantity(item.actualQuantity, item.measurementUnit)
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold",
                              differenceClassName(difference),
                            )}
                          >
                            {formatDifference(difference, item.measurementUnit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {formError ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
            {savedNotice ? (
              <p className="mt-4 text-sm text-muted-foreground" role="status">
                {savedNotice}
              </p>
            ) : null}
          </CardContent>

          {editable ? (
            <CardFooter className="justify-end gap-2">
              <Button type="submit" variant="outline" disabled={pending || !draftsDirty}>
                {saving ? "Зберігаємо..." : "Зберегти"}
              </Button>
              <Button type="button" onClick={onComplete} disabled={pending}>
                {completing ? "Завершуємо..." : "Завершити перевірку"}
              </Button>
            </CardFooter>
          ) : null}
        </form>
      </Card>
    </div>
  );
}

function countsDifferFromDrafts(items: InventoryItem[], drafts: Record<number, string>): boolean {
  return items.some((item) => {
    const actualQuantity = parseActualQuantity(drafts[item.id] ?? "");
    if (actualQuantity === undefined) return true;
    return actualQuantity !== item.actualQuantity;
  });
}
