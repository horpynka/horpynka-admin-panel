import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Plus, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { measurementUnitLabel } from "@/lib/format";
import type { Ingredient } from "@/types/domain";
import { useIngredientsApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/ingredients/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Інгредієнти — адмін-панель бістро та магазину" },
      { name: "description", content: "Сировина та її облікові одиниці." },
      { property: "og:title", content: "Інгредієнти — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Сировина та її облікові одиниці." },
    ],
  }),
  component: IngredientsPage,
});

function IngredientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const getIngredients = useIngredientsApi().getIngredientsQuery;
  const { data: ingredients, isLoading, isError } = useQuery(getIngredients());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити інгредієнти." />;
  if (!ingredients) return null;

  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesSearch = search
      ? ingredient.name.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesSearch;
  });

  const columns: DataTableColumn<Ingredient>[] = [
    {
      id: "name",
      header: "Назва",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: "measurementUnit",
      header: "Одиниця вимірювання",
      cell: (row) => (
        <Badge variant="outline" className="font-normal">
          {measurementUnitLabel(row.measurementUnit)}
        </Badge>
      ),
      sortValue: (row) => row.measurementUnit,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Інгредієнти</h1>
          <p className="mt-1 text-sm text-muted-foreground">Сировина та її облікові одиниці.</p>
        </div>
        <Button onClick={() => navigate({ to: "/panel/ingredients/new" })}>
          <Plus className="h-4 w-4 mr-1" />
          Додати інгредієнт
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Пошук за назвою..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filteredIngredients}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({
            to: "/panel/ingredients/$ingredientId/edit",
            params: { ingredientId: String(row.id) },
          })
        }
        emptyState={
          <EmptyState
            icon={FlaskConical}
            title="Інгредієнтів поки немає"
            description="Додайте перший інгредієнт для страв."
            action={
              <Button onClick={() => navigate({ to: "/panel/ingredients/new" })}>
                <Plus className="h-4 w-4 mr-1" />
                Додати інгредієнт
              </Button>
            }
          />
        }
      />
    </div>
  );
}
