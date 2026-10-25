import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryName, listCategories } from "@/lib/categories";
import { formatMoney, formatDateTime, measurementUnitLabel } from "@/lib/format";
import type { MeasurementUnit } from "@/types/domain";
import { useCategoriesApi, useProductsApi } from "@horpynka/api-sdk";

type SellingFilter = "all" | "selling" | "not-selling";

function isMeasurementUnit(value: string): value is MeasurementUnit {
  return value === "g" || value === "ml" || value === "pcs";
}

export const Route = createFileRoute("/panel/products/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Товари — адмін-панель бістро та магазину" },
      { name: "description", content: "Каталог товарів магазину." },
      { property: "og:title", content: "Товари — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Каталог товарів магазину." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sellingFilter, setSellingFilter] = useState<SellingFilter>("all");

  const getProducts = useProductsApi().getProductsQuery;
  const { data: products, isLoading, isError } = useQuery(getProducts());

  const getCategories = useCategoriesApi().getCategoriesQuery;
  const { data: categories } = useQuery(getCategories());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити товари." />;
  if (!products) return null;

  const getCategoryName = (categoryId: number | null) => categoryName(categories, categoryId);

  const categoryOptions = categories ? listCategories(categories) : [];

  const filteredProducts = products.filter((product) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = query
      ? product.name.toLowerCase().includes(query) ||
        getCategoryName(product.categoryId).toLowerCase().includes(query)
      : true;
    const matchesCategory =
      categoryFilter === "all" || product.categoryId === Number(categoryFilter);
    const matchesSelling =
      sellingFilter === "all" || (sellingFilter === "selling" ? product.selling : !product.selling);
    return matchesSearch && matchesCategory && matchesSelling;
  });

  const columns: DataTableColumn<(typeof products)[number]>[] = [
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
      id: "measurementUnit",
      header: "Фасування",
      cell: (row) =>
        isMeasurementUnit(row.measurementUnit) ? measurementUnitLabel(row.measurementUnit) : "—",
      sortValue: (row) =>
        isMeasurementUnit(row.measurementUnit) ? measurementUnitLabel(row.measurementUnit) : "",
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
          <h1 className="text-2xl font-semibold tracking-tight">Товари</h1>
          <p className="mt-1 text-sm text-muted-foreground">Каталог товарів магазину.</p>
        </div>
        <Button onClick={() => navigate({ to: "/panel/products/new" })}>
          <Plus className="h-4 w-4 mr-1" />
          Додати товар
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-50 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Пошук за назвою або категорією..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" aria-label="Категорія">
              <SelectValue placeholder="Категорія" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sellingFilter}
            onValueChange={(value) => setSellingFilter(value as SellingFilter)}
          >
            <SelectTrigger className="w-44" aria-label="Статус">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              <SelectItem value="selling">Продається</SelectItem>
              <SelectItem value="not-selling">Не продається</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={filteredProducts}
        rowKey={(row) => row.id}
        onRowClick={(row) =>
          navigate({ to: "/panel/products/$productId/edit", params: { productId: String(row.id) } })
        }
        emptyState={
          products.length === 0 ? (
            <EmptyState
              title="Товарів поки немає"
              description="Додайте перший товар до каталогу."
              action={
                <Button onClick={() => navigate({ to: "/panel/products/new" })}>
                  <Plus className="h-4 w-4 mr-1" />
                  Додати товар
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Нічого не знайдено"
              description="Змініть пошук або фільтри, щоб побачити товари."
            />
          )
        }
      />
    </div>
  );
}
