import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed, Plus, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDateTime } from "@/lib/format";
import type { Dish } from "@/types/domain";
import { useCategoriesApi, useDishesApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/dishes/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Страви — адмін-панель бістро та магазину" },
      { name: "description", content: "Каталог страв бістро та їх склад." },
      { property: "og:title", content: "Страви — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Каталог страв бістро та їх склад." },
    ],
  }),
  component: DishesPage,
});

function DishesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const getDishes = useDishesApi().getDishesQuery;
  const { data: dishes, isLoading, isError } = useQuery(getDishes());

  const getCategories = useCategoriesApi().getCategoriesQuery;
  const { data: categories } = useQuery(getCategories());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити страви." />;
  if (!dishes) return null;

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return "—";
    return (
      [...categories.dishesCategories, ...categories.productsCategories].find(
        (c) => c.id === categoryId,
      )?.name ?? "—"
    );
  };

  const filteredDishes = dishes.filter((dish) => {
    const matchesSearch = search
      ? dish.name.toLowerCase().includes(search.toLowerCase()) ||
        getCategoryName(dish.categoryId).toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesSearch;
  });

  const columns: DataTableColumn<Dish>[] = [
    {
      id: "name",
      header: "Назва",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: "category",
      header: "Категорія",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{getCategoryName(row.categoryId)}</span>
      ),
      sortValue: (row) => getCategoryName(row.categoryId),
      hideBelow: "md",
    },
    {
      id: "ownPrice",
      header: "Собівартість",
      cell: (row) => formatMoney(row.ownPrice),
      sortValue: (row) => row.ownPrice,
      align: "right",
      hideBelow: "lg",
    },
    {
      id: "sellingPrice",
      header: "Ціна продажу",
      cell: (row) => <span className="font-semibold">{formatMoney(row.sellingPrice)}</span>,
      sortValue: (row) => row.sellingPrice,
      align: "right",
    },
    {
      id: "selling",
      header: "Статус",
      cell: (row) =>
        row.selling ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Продається
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Не продається
          </Badge>
        ),
      sortValue: (row) => (row.selling ? "1" : "0"),
      hideBelow: "xl",
    },
    {
      id: "updatedAt",
      header: "Оновлено",
      cell: (row) => formatDateTime(row.updatedAt),
      sortValue: (row) => row.updatedAt,
      hideBelow: "xl",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Страви</h1>
          <p className="mt-1 text-sm text-muted-foreground">Каталог страв бістро та їх склад.</p>
        </div>
        <Button onClick={() => navigate({ to: "/panel/dishes/new" })}>
          <Plus className="h-4 w-4 mr-1" />
          Додати страву
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Пошук за назвою або категорією..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filteredDishes}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({ to: "/panel/dishes/$dishId/edit", params: { dishId: String(row.id) } })
        }
        emptyState={
          <EmptyState
            icon={UtensilsCrossed}
            title="Страв поки немає"
            description="Додайте першу страву до каталогу."
            action={
              <Button onClick={() => navigate({ to: "/panel/dishes/new" })}>
                <Plus className="h-4 w-4 mr-1" />
                Додати страву
              </Button>
            }
          />
        }
      />
    </div>
  );
}
