import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { useCategoriesApi, useDishesApi, useIngredientsApi } from "@horpynka/api-sdk";

import { ErrorState, LoadingState } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { measurementUnitLabel, toKopecks } from "@/lib/format";
import type { MeasurementUnit } from "@/types/domain";

export const Route = createFileRoute("/panel/dishes/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Нова страва — адмін-панель бістро та магазину" },
      { name: "description", content: "Створення страви та її складу." },
      { property: "og:title", content: "Нова страва — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Створення страви та її складу." },
    ],
  }),
  component: NewDishPage,
});

const MEASUREMENT_UNITS = ["g", "ml", "pcs"] as const;

function isMeasurementUnit(unit: string): unit is MeasurementUnit {
  return (MEASUREMENT_UNITS as readonly string[]).includes(unit);
}

function quantityUnitLabel(unit: string | undefined): string | null {
  if (!unit) return null;
  if (isMeasurementUnit(unit)) return measurementUnitLabel(unit);
  return unit;
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function moneyError(value: string, options: { empty: string; allowZero: boolean }): string | null {
  const trimmed = value.trim();
  if (!trimmed) return options.empty;
  const amount = parseDecimal(trimmed);
  if (amount === null) return "Введіть коректну суму.";
  const kopecks = toKopecks(amount);
  if (options.allowZero && kopecks < 0) return "Собівартість не може бути від'ємною.";
  if (!options.allowZero && kopecks <= 0) return "Ціна продажу має бути більшою за 0.";
  return null;
}

const dishFormSchema = z.object({
  name: z.string().trim().min(1, "Введіть назву страви."),
  categoryId: z.string().min(1, "Оберіть категорію."),
  ownPrice: z.string().superRefine((value, ctx) => {
    const message = moneyError(value, {
      empty: "Введіть собівартість.",
      allowZero: true,
    });
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  sellingPrice: z.string().superRefine((value, ctx) => {
    const message = moneyError(value, {
      empty: "Введіть ціну продажу.",
      allowZero: false,
    });
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  selling: z.boolean(),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string(),
        quantity: z.string(),
      }),
    )
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        if (!row.ingredientId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Оберіть інгредієнт.",
            path: [index, "ingredientId"],
          });
        } else if (seen.has(row.ingredientId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Цей інгредієнт уже додано.",
            path: [index, "ingredientId"],
          });
        } else {
          seen.add(row.ingredientId);
        }

        const quantity = parseDecimal(row.quantity);
        if (!row.quantity.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Введіть кількість.",
            path: [index, "quantity"],
          });
        } else if (quantity === null || quantity <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Кількість має бути більшою за 0.",
            path: [index, "quantity"],
          });
        }
      });
    }),
});

type DishFormValues = z.infer<typeof dishFormSchema>;

function apiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Не вдалося зберегти страву. Спробуйте ще раз.";
  }
  if (error.response?.status === 401 || error.response?.status === 403) {
    return "Недостатньо прав, щоб створити страву.";
  }
  const message =
    error.response?.data && typeof error.response.data === "object"
      ? (error.response.data as { message?: unknown }).message
      : undefined;
  if (Array.isArray(message)) {
    const lines = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (lines.length > 0) return lines.join(" ");
  }
  if (typeof message === "string" && message.trim()) return message;
  return "Не вдалося зберегти страву. Спробуйте ще раз.";
}

function NewDishPage() {
  const navigate = useNavigate();
  const { mutateCreateDish } = useDishesApi();
  const { getCategoriesQuery } = useCategoriesApi();
  const { getIngredientsQuery } = useIngredientsApi();
  const [apiError, setApiError] = useState<string | null>(null);

  const categoriesQuery = useQuery(getCategoriesQuery());
  const ingredientsQuery = useQuery(getIngredientsQuery());

  const form = useForm<DishFormValues>({
    resolver: zodResolver(dishFormSchema),
    defaultValues: {
      name: "",
      categoryId: "",
      ownPrice: "",
      sellingPrice: "",
      selling: true,
      ingredients: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });
  const ingredientRows = useWatch({ control: form.control, name: "ingredients" });

  const categories = categoriesQuery.data?.dishesCategories ?? [];
  const ingredients = ingredientsQuery.data ?? [];
  const takenIngredientIds = new Set(
    ingredientRows.flatMap((row) => (row.ingredientId ? [row.ingredientId] : [])),
  );
  const canAddIngredient = ingredients.some(
    (ingredient) => !takenIngredientIds.has(String(ingredient.id)),
  );
  const saving = mutateCreateDish.isPending;

  const onSubmit = (values: DishFormValues) => {
    const ownPrice = parseDecimal(values.ownPrice);
    const sellingPrice = parseDecimal(values.sellingPrice);
    if (ownPrice === null || sellingPrice === null) return;

    mutateCreateDish.mutate(
      {
        params: {
          createDishDto: {
            name: values.name.trim(),
            categoryId: Number(values.categoryId),
            ownPrice: toKopecks(ownPrice),
            sellingPrice: toKopecks(sellingPrice),
            selling: values.selling,
            // OpenAPI types unique items as Set. JSON.stringify drops Set entries,
            // while POST /dishes expects a JSON array.
            ingredients: values.ingredients.map((row) => ({
              ingredientId: Number(row.ingredientId),
              quantity: parseDecimal(row.quantity) ?? 0,
            })) as never,
          },
        },
      },
      {
        onSuccess: () => {
          navigate({ to: "/panel/dishes" });
        },
        onError: (error) => {
          setApiError(apiErrorMessage(error));
        },
      },
    );
  };

  if (categoriesQuery.isLoading || ingredientsQuery.isLoading) return <LoadingState />;
  if (
    categoriesQuery.isError ||
    ingredientsQuery.isError ||
    !categoriesQuery.data ||
    !ingredientsQuery.data
  ) {
    return (
      <ErrorState
        message="Не вдалося завантажити дані для форми."
        onRetry={() => {
          void categoriesQuery.refetch();
          void ingredientsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Нова страва</h1>
        <p className="mt-1 text-sm text-muted-foreground">Назва, ціни та склад страви.</p>
      </div>

      <Form {...form}>
        <form
          className="space-y-6"
          noValidate
          onSubmit={(event) => {
            setApiError(null);
            void form.handleSubmit(onSubmit)(event);
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Дані страви</CardTitle>
              <CardDescription>Ціни вводяться в гривнях.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Назва</FormLabel>
                    <FormControl>
                      <Input placeholder="Наприклад, Борщ" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категорія</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={saving || categories.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть категорію" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {categories.length === 0 ? (
                      <FormDescription>Немає категорій страв.</FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="ownPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Собівартість, грн</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="0,00"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ціна продажу, грн</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder="0,00"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="selling"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border border-border px-3 py-3">
                    <FormLabel className="cursor-pointer">Продається</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={saving}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Склад</CardTitle>
              <CardDescription>
                Один інгредієнт можна додати лише раз. Склад можна залишити порожнім.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Інгредієнтів у складі ще немає.</p>
              ) : (
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const selectedId = ingredientRows[index]?.ingredientId ?? "";
                    const selectedIngredient = ingredients.find(
                      (ingredient) => String(ingredient.id) === selectedId,
                    );
                    const unit = quantityUnitLabel(selectedIngredient?.measurementUnit);
                    const options = ingredients.filter((ingredient) => {
                      const id = String(ingredient.id);
                      return id === selectedId || !takenIngredientIds.has(id);
                    });

                    return (
                      <div
                        key={field.id}
                        className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] md:items-start"
                      >
                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.ingredientId`}
                          render={({ field: ingredientField }) => (
                            <FormItem>
                              <FormLabel>Інгредієнт</FormLabel>
                              <Select
                                value={ingredientField.value || undefined}
                                onValueChange={ingredientField.onChange}
                                disabled={saving}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Оберіть інгредієнт" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {options.map((ingredient) => (
                                    <SelectItem key={ingredient.id} value={String(ingredient.id)}>
                                      {ingredient.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`ingredients.${index}.quantity`}
                          render={({ field: quantityField }) => (
                            <FormItem>
                              <FormLabel>Кількість{unit ? `, ${unit}` : ""}</FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0"
                                  autoComplete="off"
                                  {...quantityField}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="md:mt-8"
                          aria-label="Прибрати інгредієнт"
                          disabled={saving}
                          onClick={() => remove(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || !canAddIngredient}
                  onClick={() => append({ ingredientId: "", quantity: "" })}
                >
                  <Plus />
                  Додати інгредієнт
                </Button>
                {ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    У системі ще немає інгредієнтів. Страву можна зберегти без складу.
                  </p>
                ) : null}
                {ingredients.length > 0 && !canAddIngredient ? (
                  <p className="text-sm text-muted-foreground">Усі інгредієнти вже додані.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {apiError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => navigate({ to: "/panel/dishes" })}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Збереження...
                </>
              ) : (
                "Зберегти"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
