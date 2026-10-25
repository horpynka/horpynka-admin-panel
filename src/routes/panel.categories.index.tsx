import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCategoriesApi } from "@horpynka/api-sdk";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateCategoryName } from "@/lib/categories";

type CategoryRow = {
  id: number;
  name: string;
  productsCount: number;
  dishesCount: number;
};

export const Route = createFileRoute("/panel/categories/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Категорії — адмін-панель бістро та магазину" },
      { name: "description", content: "Категорії товарів і страв." },
      { property: "og:title", content: "Категорії — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Категорії товарів і страв." },
    ],
  }),
  component: CategoriesPage,
});

function readApiMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error) || error.response == null) return null;

  const data: unknown = error.response.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (!data || typeof data !== "object" || !("message" in data)) return null;

  const message = (data as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (Array.isArray(message)) {
    const lines = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (lines.length > 0) return lines.join(" ");
  }

  return null;
}

function saveErrorMessage(error: unknown): string {
  const message = readApiMessage(error);
  if (message) return message;
  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }
  if (error.response.status === 403) return "Недостатньо прав, щоб змінити категорії.";
  return "Не вдалося зберегти категорію. Спробуйте ще раз.";
}

function deleteErrorMessage(error: unknown): string {
  const message = readApiMessage(error);
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return message ?? "Категорію не можна видалити, поки її використовують.";
  }
  if (message) return message;
  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }
  if (error.response.status === 403) return "Недостатньо прав, щоб видалити категорію.";
  return "Не вдалося видалити категорію. Спробуйте ще раз.";
}

function categoryInUse(category: CategoryRow): boolean {
  return category.productsCount > 0 || category.dishesCount > 0;
}

function CategoriesPage() {
  const queryClient = useQueryClient();
  const { getCategoriesQuery, mutateCreateCategory, mutateUpdateCategory, mutateRemoveCategory } =
    useCategoriesApi();
  const categoriesQuery = useQuery(getCategoriesQuery());

  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categories = categoriesQuery.data?.allCategories ?? [];
  const saving =
    mutateCreateCategory.isPending ||
    mutateUpdateCategory.isPending ||
    mutateRemoveCategory.isPending;

  const invalidateCategories = () => {
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const onCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateCategoryName(name, categories);
    setCreateError(error);
    if (error) return;

    mutateCreateCategory.mutate(
      { params: { createCategoryDto: { name: name.trim() } } },
      {
        onSuccess: () => {
          setName("");
          setCreateError(null);
          invalidateCategories();
        },
        onError: (error) => {
          setCreateError(saveErrorMessage(error));
        },
      },
    );
  };

  const startRename = (category: CategoryRow) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditError(null);
    setDeleteError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditName("");
    setEditError(null);
  };

  const saveRename = (category: CategoryRow) => {
    const trimmed = editName.trim();
    const error = validateCategoryName(editName, categories, category.id);
    setEditError(error);
    if (error) return;

    if (trimmed === category.name.trim()) {
      cancelRename();
      return;
    }

    mutateUpdateCategory.mutate(
      { params: { id: category.id, updateCategoryDto: { name: trimmed } } },
      {
        onSuccess: () => {
          cancelRename();
          invalidateCategories();
        },
        onError: (requestError) => {
          setEditError(saveErrorMessage(requestError));
        },
      },
    );
  };

  const removeCategory = (category: CategoryRow) => {
    if (categoryInUse(category)) return;

    setDeleteError(null);
    mutateRemoveCategory.mutate(
      { params: { id: category.id } },
      {
        onSuccess: () => {
          if (editingId === category.id) cancelRename();
          invalidateCategories();
        },
        onError: (error) => {
          setDeleteError(deleteErrorMessage(error));
        },
      },
    );
  };

  if (categoriesQuery.isLoading) return <LoadingState />;
  if (categoriesQuery.isError) {
    return (
      <ErrorState
        message="Не вдалося завантажити категорії."
        onRetry={() => {
          void categoriesQuery.refetch();
        }}
      />
    );
  }
  if (!categoriesQuery.data) return null;

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      id: "name",
      header: "Назва",
      cell: (row) =>
        editingId === row.id ? (
          <div className="space-y-1">
            <Input
              value={editName}
              autoFocus
              autoComplete="off"
              aria-label={`Нова назва категорії ${row.name}`}
              aria-invalid={editError ? true : undefined}
              disabled={saving}
              onChange={(event) => {
                setEditName(event.target.value);
                setEditError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveRename(row);
                }
                if (event.key === "Escape") cancelRename();
              }}
            />
            {editError ? <FieldError message={editError} /> : null}
          </div>
        ) : (
          <span className="font-medium">{row.name}</span>
        ),
      sortValue: (row) => row.name,
    },
    {
      id: "productsCount",
      header: "Товарів",
      cell: (row) => row.productsCount,
      sortValue: (row) => row.productsCount,
      align: "right",
    },
    {
      id: "dishesCount",
      header: "Страв",
      cell: (row) => row.dishesCount,
      sortValue: (row) => row.dishesCount,
      align: "right",
    },
    {
      id: "actions",
      header: "Дії",
      align: "right",
      className: "w-[1%] whitespace-nowrap",
      cell: (row) =>
        editingId === row.id ? (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={cancelRename}
            >
              Скасувати
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => saveRename(row)}>
              Зберегти
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => startRename(row)}
            >
              Перейменувати
            </Button>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="destructive" size="sm" disabled={saving}>
                  Видалити
                </Button>
              }
              title={categoryInUse(row) ? "Неможливо видалити категорію" : "Видалити категорію?"}
              description={
                categoryInUse(row)
                  ? `Видалити не вдасться, поки категорію «${row.name}» використовують. Товарів: ${row.productsCount}. Страв: ${row.dishesCount}.`
                  : `Категорію «${row.name}» буде видалено. Цю дію не можна скасувати.`
              }
              confirmLabel="Видалити"
              cancelLabel="Скасувати"
              onConfirm={() => removeCategory(row)}
            />
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Категорії</h1>
        <p className="mt-1 text-sm text-muted-foreground">Назви для товарів і страв.</p>
      </div>

      <Card className="p-4">
        <form
          onSubmit={onCreate}
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="category-name">Назва</Label>
            <Input
              id="category-name"
              value={name}
              autoComplete="off"
              placeholder="Наприклад, Напої"
              disabled={saving}
              aria-invalid={createError ? true : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setCreateError(null);
              }}
            />
            {createError ? <FieldError message={createError} /> : null}
          </div>
          <Button type="submit" disabled={saving}>
            Зберегти
          </Button>
        </form>
      </Card>

      {deleteError ? (
        <p className="text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={categories}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyState
            title="Категорій поки немає"
            description="Додайте першу категорію, щоб використовувати її для товарів і страв."
          />
        }
      />
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="text-[0.8rem] font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}
