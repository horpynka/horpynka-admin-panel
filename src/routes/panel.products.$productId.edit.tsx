import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
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

type UpdateProductPayload = {
  name: string;
  categoryId: number;
  measurementUnit: MeasurementUnit;
  ownPrice: number;
  sellingPrice: number;
  selling: boolean;
};

type EditableProduct = {
  id: number;
  name: string;
  categoryId: number | null;
  measurementUnit: string;
  ownPrice: number;
  sellingPrice: number;
  selling: boolean;
};

type CategoryGroups = {
  dishesCategories: ReadonlyArray<{ id: number; name: string }>;
  productsCategories: ReadonlyArray<{ id: number; name: string }>;
};

type FieldName = "name" | "categoryId" | "measurementUnit" | "ownPrice" | "sellingPrice";
type FieldErrors = Partial<Record<FieldName, string>>;

const MEASUREMENT_UNITS: MeasurementUnit[] = ["g", "ml", "pcs"];

const ADDED_VALUE_PERCENT_FORMAT = new Intl.NumberFormat("uk-UA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function collectCategories(categories: CategoryGroups) {
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

function formFromProduct(product: EditableProduct): ProductFormState {
  return {
    name: product.name,
    categoryId: product.categoryId,
    measurementUnit: isMeasurementUnit(product.measurementUnit) ? product.measurementUnit : null,
    selling: product.selling,
    ...pricesWithAddedValue(product.ownPrice, product.sellingPrice),
  };
}

function deleteErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return "Не вдалося видалити товар.";
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

  return "Не вдалося видалити товар.";
}

export const Route = createFileRoute("/panel/products/$productId/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Редагування товару — адмін-панель бістро та магазину" },
      { name: "description", content: "Зміна даних товару для продажу в касі." },
      {
        property: "og:title",
        content: "Редагування товару — адмін-панель бістро та магазину",
      },
      { property: "og:description", content: "Зміна даних товару для продажу в касі." },
    ],
  }),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const parsedId = Number(productId);
  const idIsValid = Number.isInteger(parsedId) && parsedId > 0;

  const { getProductQuery } = useProductsApi();
  const { getCategoriesQuery } = useCategoriesApi();
  const productQuery = useQuery({
    ...getProductQuery(idIsValid ? parsedId : 0),
    enabled: idIsValid,
  });
  const categoriesQuery = useQuery(getCategoriesQuery());

  if (!idIsValid) {
    return <ErrorState message="Не вдалося завантажити товар або товар не знайдено." />;
  }

  if (productQuery.isLoading || categoriesQuery.isLoading) {
    return <LoadingState />;
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <ErrorState
        message="Не вдалося завантажити товар або товар не знайдено."
        onRetry={() => {
          void productQuery.refetch();
        }}
      />
    );
  }

  if (categoriesQuery.isError || !categoriesQuery.data) {
    return (
      <ErrorState
        message="Не вдалося завантажити категорії."
        onRetry={() => {
          void categoriesQuery.refetch();
        }}
      />
    );
  }

  return (
    <EditProductForm
      key={productQuery.data.id}
      product={productQuery.data}
      categories={categoriesQuery.data}
    />
  );
}

function EditProductForm({
  product,
  categories,
}: {
  product: EditableProduct;
  categories: CategoryGroups;
}) {
  const navigate = useNavigate();
  const { mutateUpdateProduct, mutateRemoveProduct } = useProductsApi();

  const [form, setForm] = useState<ProductFormState>(() => formFromProduct(product));
  const [ownPriceInput, setOwnPriceInput] = useState(() => String(toHryvnias(product.ownPrice)));
  const [sellingPriceInput, setSellingPriceInput] = useState(() =>
    String(toHryvnias(product.sellingPrice)),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const categoryOptions = collectCategories(categories);
  const saving = mutateUpdateProduct.isPending || mutateRemoveProduct.isPending;

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

    const updateProductDto: UpdateProductPayload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      measurementUnit: form.measurementUnit,
      ownPrice: form.ownPrice,
      sellingPrice: form.sellingPrice,
      selling: form.selling,
    };

    mutateUpdateProduct.mutate(
      { params: { id: product.id, updateProductDto } },
      {
        onSuccess: () => {
          navigate({ to: "/panel/products" });
        },
      },
    );
  };

  const onDelete = () => {
    mutateRemoveProduct.mutate(
      { params: { id: product.id } },
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
        <h1 className="text-2xl font-semibold tracking-tight">Редагування товару</h1>
        <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>
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

            {mutateUpdateProduct.isError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                Не вдалося зберегти товар.
              </p>
            ) : null}
            {mutateRemoveProduct.isError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {deleteErrorMessage(mutateRemoveProduct.error)}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between gap-2">
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" disabled={saving}>
                  Видалити
                </Button>
              }
              title="Видалити товар?"
              description="Товар буде видалено без можливості відновлення."
              confirmLabel="Видалити"
              cancelLabel="Скасувати"
              onConfirm={onDelete}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/panel/products" })}
              >
                Скасувати
              </Button>
              <Button type="submit" disabled={saving}>
                Зберегти
              </Button>
            </div>
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
