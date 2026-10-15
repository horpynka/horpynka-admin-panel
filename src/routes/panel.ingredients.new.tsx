import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";

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
import { MEASUREMENT_UNITS } from "@/lib/labels";
import type { MeasurementUnit } from "@/types/domain";
import { useIngredientsApi } from "@horpynka/api-sdk";

type IngredientFormState = {
  name: string;
  measurementUnit: MeasurementUnit | null;
};

type FieldName = "name" | "measurementUnit";
type FieldErrors = Partial<Record<FieldName, string>>;

function emptyForm(): IngredientFormState {
  return {
    name: "",
    measurementUnit: null,
  };
}

function isMeasurementUnit(value: string): value is MeasurementUnit {
  return MEASUREMENT_UNITS.some((unit) => unit.value === value);
}

function validateForm(form: IngredientFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim() === "") errors.name = "Вкажіть назву.";
  if (form.measurementUnit === null) errors.measurementUnit = "Оберіть одиницю виміру.";
  return errors;
}

function apiErrorMessage(error: unknown): string {
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

  if (error.response.status === 409) return "Інгредієнт з такою назвою вже існує";
  return "Не вдалося зберегти інгредієнт. Спробуйте ще раз.";
}

export const Route = createFileRoute("/panel/ingredients/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Новий інгредієнт — адмін-панель бістро та магазину" },
      { name: "description", content: "Створення інгредієнта для складу страв." },
      { property: "og:title", content: "Новий інгредієнт — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Створення інгредієнта для складу страв." },
    ],
  }),
  component: NewIngredientPage,
});

function NewIngredientPage() {
  const navigate = useNavigate();
  const { mutateCreateIngredient } = useIngredientsApi();

  const [form, setForm] = useState<IngredientFormState>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const clearError = (field: FieldName) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (form.measurementUnit === null) return;

    mutateCreateIngredient.mutate(
      {
        params: {
          createIngredientDto: {
            name: form.name.trim(),
            measurementUnit: form.measurementUnit,
          },
        },
      },
      {
        onSuccess: () => {
          navigate({ to: "/panel/ingredients" });
        },
        onError: (error) => {
          setApiError(apiErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новий інгредієнт</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сировина, яку можна додати до складу страви.
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

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="measurementUnit">Одиниця виміру</Label>
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
                  <SelectValue placeholder="Оберіть одиницю виміру" />
                </SelectTrigger>
                <SelectContent>
                  {MEASUREMENT_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.measurementUnit} />
            </div>

            {apiError ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {apiError}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/panel/ingredients" })}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={mutateCreateIngredient.isPending}>
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
