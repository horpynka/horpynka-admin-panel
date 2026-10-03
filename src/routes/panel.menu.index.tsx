import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu as MenuIcon, Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { MENU_ITEM_KIND_LABELS } from "@/lib/labels";
import type { MenuItem } from "@/types/domain";
import { useCategoriesApi, useMenuApi } from "@horpynka/api-sdk";

export const Route = createFileRoute("/panel/menu/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Меню — адмін-панель бістро та магазину" },
      { name: "description", content: "Позиції, доступні на касі." },
      { property: "og:title", content: "Меню — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Позиції, доступні на касі." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const getMenu = useMenuApi().getMenuQuery;
  const { data: menuItems, isLoading, isError } = useQuery(getMenu());

  const getCategories = useCategoriesApi().getCategoriesQuery;

  const { data: categories } = useQuery(getCategories());

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити меню." />;
  if (!menuItems) return null;

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return "—";
    return (
      [...categories.dishesCategories, ...categories.productsCategories].find(
        (c) => c.id === categoryId,
      )?.name ?? "—"
    );
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = search
      ? item.name.toLowerCase().includes(search.toLowerCase()) ||
        getCategoryName(item.categoryId).toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesSearch;
  });

  const columns: DataTableColumn<MenuItem>[] = [
    {
      id: "name",
      header: "Назва",
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      id: "kind",
      header: "Тип",
      cell: (row) => (
        <Badge variant="outline" className="font-normal">
          {MENU_ITEM_KIND_LABELS[row.kind]}
        </Badge>
      ),
      sortValue: (row) => row.kind,
      hideBelow: "md",
    },
    {
      id: "category",
      header: "Категорія",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{getCategoryName(row.categoryId)}</span>
      ),
      sortValue: (row) => getCategoryName(row.categoryId),
      hideBelow: "lg",
    },
    {
      id: "sellingPrice",
      header: "Ціна продажу",
      cell: (row) => <span className="font-semibold">{formatMoney(row.sellingPrice)}</span>,
      sortValue: (row) => row.sellingPrice,
      align: "right",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Меню</h1>
        <p className="mt-1 text-sm text-muted-foreground">Позиції, доступні на касі.</p>
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
        rows={filteredItems}
        rowKey={(row) => row.id}
        onRowClick={(row) => {
          if (row.kind === "DISH") {
            navigate({
              to: "/panel/dishes/$dishId/edit",
              params: { dishId: String(row.entityId) },
            });
          } else {
            navigate({
              to: "/panel/products/$productId/edit",
              params: { productId: String(row.entityId) },
            });
          }
        }}
        emptyState={
          <EmptyState
            icon={MenuIcon}
            title="Меню порожнє"
            description="Додайте страви або товари, які продаються, і вони з'являться тут."
          />
        }
      />
    </div>
  );
}
