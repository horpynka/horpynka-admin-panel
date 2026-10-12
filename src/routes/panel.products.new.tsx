import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatMoney, measurementUnitLabel, toHryvnias, toKopecks } from "@/lib/format";
import type { MeasurementUnit } from "@/types/domain";
import { useCategoriesApi, useProductsApi } from "@horpynka/api-sdk";

export interface CreateProductForm {
  name: string;
  categoryId: number;
  measurementUnit: MeasurementUnit; // "g" | "ml" | "pcs"
  ownPrice: number; // копійки
  sellingPrice: number; // копійки
  selling: boolean;
  addedValue: number; // sellingPrice − ownPrice, копійки; на формі в грн
  addedValuePercent: number | null; // (addedValue / ownPrice) × 100; null, якщо ownPrice === 0
}

type CreateProductPayload = Omit<CreateProductForm, "addedValue" | "addedValuePercent">;

type ProductFormState = {
  name: string;
  categoryId: number | null;
  measurementUnit: MeasurementUnit | null;
  ownPrice: number;
  sellingPrice: number;
  selling: boolean;
  addedValue: number;
  addedValuePercent: number | null;
};

type FieldName = "name" | "categoryId" | "measurementUnit" | "ownPrice" | "sellingPrice";
type FieldErrors = Partial<Record<FieldName, string>>;

const MEASUREMENT_UNITS: MeasurementUnit[] = ["g", "ml", "pcs"];

const ADDED_VALUE_PERCENT_FORMAT = new Intl.NumberFormat("uk-UA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function emptyForm(): ProductFormState {
  return {
    name: "",
    categoryId: null,
    measurementUnit: null,
    ownPrice: 0,
    sellingPrice: 0,
    selling: true,
    addedValue: 0,
    addedValuePercent: null,
  };
}

function pricesWithAddedValue(ownPrice: number, sellingPrice: number) {
  const addedValue = sellingPrice - ownPrice;
  const addedValuePercent = ownPrice === 0 ? null : (addedValue / ownPrice) * 100;
  return { ownPrice, sellingPrice, addedValue, addedValuePercent };
}

function parseHryvniaInput(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === "-") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatAddedValuePercent(value: number): string {
  return `${ADDED_VALUE_PERCENT_FORMAT.format(value)}%`;
}

function isMeasurementUnit(value: string): value is MeasurementUnit {
  return MEASUREMENT_UNITS.some((unit) => unit === value);
}

function collectCategories(categories: {
  dishesCategories: ReadonlyArray<{ id: number; name: string }>;
  productsCategories: ReadonlyArray<{ id: number; name: string }>;
}) {
  const byId = new Map<number, { id: number; name: string }>();
  for (const category of [...categories.dishesCategories, ...categories.productsCategories]) {
    if (!byId.has(category.id)) {
      byId.set(category.id, { id: category.id, name: category.name });
    }
  }
  return [...byId.values()];
}

function validateForm(form: ProductFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim() === "") errors.name = "Вкажіть назву.";
  if (form.categoryId === null) errors.categoryId = "Оберіть категорію.";
  if (form.measurementUnit === null) errors.measurementUnit = "Оберіть фасування.";
  if (form.ownPrice < 0) errors.ownPrice = "Собівартість має бути не меншою за 0.";
  if (form.sellingPrice <= 0) errors.sellingPrice = "Ціна продажу має бути більшою за 0.";
  return errors;
}

export const Route = createFileRoute("/panel/products/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Новий товар — адмін-панель бістро та магазину" },
      { name: "description", content: "Створення товару для продажу в касі." },
      { property: "og:title", content: "Новий товар — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Створення товару для продажу в касі." },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const getCategories = useCategoriesApi().getCategoriesQuery;
  const { data: categories, isLoading, isError, refetch } = useQuery(getCategories());
  const { mutateCreateProduct } = useProductsApi();

  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [ownPriceInput, setOwnPriceInput] = useState("");
  const [sellingPriceInput, setSellingPriceInput] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  if (isLoading) return <LoadingState />;
  if (isError || !categories) {
    return (
      <ErrorState
        message="Не вдалося завантажити категорії."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const categoryOptions = collectCategories(categories);

  const clearError = (field: FieldName) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateOwnPrice = (raw: string) => {
    setOwnPriceInput(raw);
    clearError("ownPrice");
    setForm((current) => ({
      ...current,
      ...pricesWithAddedValue(toKopecks(parseHryvniaInput(raw)), current.sellingPrice),
    }));
  };

  const updateSellingPrice = (raw: string) => {
    setSellingPriceInput(raw);
    clearError("sellingPrice");
    setForm((current) => ({
      ...current,
      ...pricesWithAddedValue(current.ownPrice, toKopecks(parseHryvniaInput(raw))),
    }));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (form.categoryId === null || form.measurementUnit === null) return;

    const createProductDto: CreateProductPayload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      measurementUnit: form.measurementUnit,
      ownPrice: form.ownPrice,
      sellingPrice: form.sellingPrice,
      selling: form.selling,
    };

    mutateCreateProduct.mutate(
      { params: { createProductDto } },
      {
        onSuccess: () => {
          navigate({ to: "/panel/products" });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новий товар</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Товар, який касир продає в касовій системі.
        </p>
      </div>

      <Card>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Назва</Label>
              <Input
                id="name"
                value={form.name}
                autoComplete="off"
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  clearError("name");
                }}
                aria-invalid={errors.name ? true : undefined}
              />
              <FieldError message={errors.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Категорія</Label>
              <Select
                value={form.categoryId === null ? "" : String(form.categoryId)}
                onValueChange={(value) => {
                  const categoryId = Number(value);
                  setForm((current) => ({ ...current, categoryId }));
                  clearError("categoryId");
                }}
              >
                <SelectTrigger id="categoryId" aria-invalid={errors.categoryId ? true : undefined}>
                  <SelectValue placeholder="Оберіть категорію" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.categoryId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measurementUnit">Фасування</Label>
              <Select
                value={form.measurementUnit ?? ""}
                onValueChange={(value) => {
                  if (!isMeasurementUnit(value)) return;
                  setForm((current) => ({ ...current, measurementUnit: value }));
                  clearError("measurementUnit");
                }}
              >
                <SelectTrigger
                  id="measurementUnit"
                  aria-invalid={errors.measurementUnit ? true : undefined}
                >
                  <SelectValue placeholder="Оберіть фасування" />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {measurementUnitLabel(unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.measurementUnit} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownPrice">Собівартість</Label>
              <Input
                id="ownPrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={ownPriceInput}
                onChange={(event) => updateOwnPrice(event.target.value)}
                onBlur={() => {
                  if (ownPriceInput.trim() === "") return;
                  setOwnPriceInput(String(toHryvnias(form.ownPrice)));
                }}
                aria-invalid={errors.ownPrice ? true : undefined}
              />
              <FieldError message={errors.ownPrice} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Ціна продажу</Label>
              <Input
                id="sellingPrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={sellingPriceInput}
                onChange={(event) => updateSellingPrice(event.target.value)}
                onBlur={() => {
                  if (sellingPriceInput.trim() === "") return;
                  setSellingPriceInput(String(toHryvnias(form.sellingPrice)));
                }}
                aria-invalid={errors.sellingPrice ? true : undefined}
              />
              <FieldError message={errors.sellingPrice} />
            </div>

            <div className="space-y-1">
              <Label>Додана вартість</Label>
              <p className="font-medium">{formatMoney(form.addedValue)}</p>
              <p className="text-sm text-muted-foreground">
                {form.ownPrice === 0 || form.addedValuePercent === null
                  ? "—"
                  : formatAddedValuePercent(form.addedValuePercent)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <div className="space-y-1">
                <Label htmlFor="selling">Продається</Label>
                <p className="text-sm text-muted-foreground">Показувати товар у меню каси.</p>
              </div>
              <Switch
                id="selling"
                checked={form.selling}
                onCheckedChange={(selling) => setForm((current) => ({ ...current, selling }))}
              />
            </div>

            {mutateCreateProduct.isError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                Не вдалося створити товар.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/panel/products" })}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={mutateCreateProduct.isPending}>
              Зберегти
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}
