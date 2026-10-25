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
import { MEASUREMENT_UNITS } from "@/lib/labels";
import type { MeasurementUnit } from "@/types/domain";
import { useIngredientsApi } from "@horpynka/api-sdk";

type IngredientFormState = {
  name: string;
  measurementUnit: MeasurementUnit | null;
};

type LoadedIngredient = {
  id: number;
  name: string;
  measurementUnit: string;
};

type FieldName = "name" | "measurementUnit";
type FieldErrors = Partial<Record<FieldName, string>>;

function isMeasurementUnit(value: string): value is MeasurementUnit {
  return MEASUREMENT_UNITS.some((unit) => unit.value === value);
}

function formFromIngredient(ingredient: LoadedIngredient): IngredientFormState {
  return {
    name: ingredient.name,
    measurementUnit: isMeasurementUnit(ingredient.measurementUnit)
      ? ingredient.measurementUnit
      : null,
  };
}

function validateForm(form: IngredientFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim() === "") errors.name = "Вкажіть назву.";
  if (form.measurementUnit === null) errors.measurementUnit = "Оберіть одиницю виміру.";
  return errors;
}

function responseMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error) || !error.response) return null;

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

  return null;
}

function apiErrorMessage(error: unknown): string {
  const message = responseMessage(error);
  if (message) return message;

  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }

  return "Не вдалося зберегти інгредієнт. Спробуйте ще раз.";
}

function deleteErrorMessage(error: unknown): string {
  return responseMessage(error) ?? "Не вдалося видалити інгредієнт.";
}

function isUnitChangeRejected(message: string): boolean {
  return message.toLowerCase().includes("одиниц");
}

export const Route = createFileRoute("/panel/ingredients/$ingredientId/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Редагування інгредієнта — адмін-панель бістро та магазину" },
      { name: "description", content: "Зміна назви та одиниці виміру інгредієнта." },
      {
        property: "og:title",
        content: "Редагування інгредієнта — адмін-панель бістро та магазину",
      },
      { property: "og:description", content: "Зміна назви та одиниці виміру інгредієнта." },
    ],
  }),
  component: EditIngredientPage,
});

function EditIngredientPage() {
  const { ingredientId } = Route.useParams();
  const parsedId = Number(ingredientId);
  const idIsValid = Number.isInteger(parsedId) && parsedId > 0;

  const { getIngredientQuery } = useIngredientsApi();
  const ingredientQuery = useQuery({
    ...getIngredientQuery(idIsValid ? parsedId : 0),
    enabled: idIsValid,
  });

  if (!idIsValid) {
    return <ErrorState message="Не вдалося завантажити інгредієнт або інгредієнт не знайдено." />;
  }

  if (ingredientQuery.isLoading) return <LoadingState />;

  if (ingredientQuery.isError || !ingredientQuery.data) {
    return (
      <ErrorState
        message="Не вдалося завантажити інгредієнт або інгредієнт не знайдено."
        onRetry={() => {
          void ingredientQuery.refetch();
        }}
      />
    );
  }

  return <EditIngredientForm key={ingredientQuery.data.id} ingredient={ingredientQuery.data} />;
}

function EditIngredientForm({ ingredient }: { ingredient: LoadedIngredient }) {
  const navigate = useNavigate();
  const { mutateUpdateIngredient, mutateRemoveIngredient } = useIngredientsApi();
  const savedUnit = isMeasurementUnit(ingredient.measurementUnit)
    ? ingredient.measurementUnit
    : null;

  const [form, setForm] = useState<IngredientFormState>(() => formFromIngredient(ingredient));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const saving = mutateUpdateIngredient.isPending || mutateRemoveIngredient.isPending;

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

    const submittedUnit = form.measurementUnit;

    mutateUpdateIngredient.mutate(
      {
        params: {
          id: ingredient.id,
          updateIngredientDto: {
            name: form.name.trim(),
            measurementUnit: submittedUnit,
          },
        },
      },
      {
        onSuccess: () => {
          navigate({ to: "/panel/ingredients" });
        },
        onError: (error) => {
          const message = apiErrorMessage(error);
          setApiError(message);
          if (isUnitChangeRejected(message) && savedUnit && submittedUnit !== savedUnit) {
            setForm((current) => ({ ...current, measurementUnit: savedUnit }));
          }
        },
      },
    );
  };

  const onDelete = () => {
    setApiError(null);
    mutateRemoveIngredient.mutate(
      { params: { id: ingredient.id } },
      {
        onSuccess: () => {
          navigate({ to: "/panel/ingredients" });
        },
        onError: (error) => {
          setApiError(deleteErrorMessage(error));
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Редагування інгредієнта</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ingredient.name}</p>
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
          <CardFooter className="justify-between gap-2">
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" disabled={saving}>
                  Видалити
                </Button>
              }
              title="Видалити інгредієнт?"
              description="Інгредієнт буде видалено без можливості відновлення."
              confirmLabel="Видалити"
              cancelLabel="Скасувати"
              onConfirm={onDelete}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/panel/ingredients" })}
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
