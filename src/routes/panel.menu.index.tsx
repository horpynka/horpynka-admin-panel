import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { MENU_ITEM_KIND_LABELS } from "@/lib/labels";
import { menuCatalogQuery, useUpdateMenuItemSelling } from "@/lib/menu";
import type { MenuItem, MenuItemKind } from "@/types/domain";
import { useCategoriesApi } from "@horpynka/api-sdk";

type KindFilter = "all" | MenuItemKind;

type NamedCategory = {
  id: number;
  name: string;
};

type CategoryGroups = {
  dishesCategories: ReadonlyArray<NamedCategory>;
  productsCategories: ReadonlyArray<NamedCategory>;
};

const PAGE_DESCRIPTION = "Усі страви та продукти. Каса показує лише ті, що продаються.";

export const Route = createFileRoute("/panel/menu/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Меню — адмін-панель бістро та магазину" },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: "Меню — адмін-панель бістро та магазину" },
      { property: "og:description", content: PAGE_DESCRIPTION },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: menuItems, isLoading, isError } = useQuery(menuCatalogQuery());
  const updateSelling = useUpdateMenuItemSelling();

  const getCategories = useCategoriesApi().getCategoriesQuery;
  const { data: categories } = useQuery(getCategories());

  const categoryOptions = categoriesForKind(categories, kindFilter);

  const handleKindChange = (value: KindFilter) => {
    setKindFilter(value);
    setCategoryFilter((current) => {
      if (current === "all") return current;
      const allowed = categoriesForKind(categories, value);
      return allowed.some((category) => String(category.id) === current) ? current : "all";
    });
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Не вдалося завантажити меню." />;
  if (!menuItems) return null;

  const getCategoryName = (categoryId: number | null) => categoryName(categories, categoryId);

  const query = search.trim().toLowerCase();
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = query
      ? item.name.toLowerCase().includes(query) ||
        getCategoryName(item.categoryId).toLowerCase().includes(query)
      : true;
    const matchesKind = kindFilter === "all" || item.kind === kindFilter;
    const matchesCategory = categoryFilter === "all" || item.categoryId === Number(categoryFilter);
    return matchesSearch && matchesKind && matchesCategory;
  });

  const filtersActive = query !== "" || kindFilter !== "all" || categoryFilter !== "all";

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
    {
      id: "selling",
      header: "Продаж",
      cell: (row) => (
        <SellingSwitch
          item={row}
          disabled={updateSelling.isPending}
          onChange={(selling) => updateSelling.mutate({ id: row.id, selling })}
        />
      ),
      sortValue: (row) => (row.selling ? 1 : 0),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Меню</h1>
        <p className="mt-1 text-sm text-muted-foreground">{PAGE_DESCRIPTION}</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-50 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Пошук за назвою або категорією..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={kindFilter}
            onValueChange={(value) => handleKindChange(value as KindFilter)}
          >
            <SelectTrigger className="w-40" aria-label="Тип">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              <SelectItem value="DISH">Страва</SelectItem>
              <SelectItem value="PRODUCT">Продукт</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-52" aria-label="Категорія">
              <SelectValue placeholder="Категорія" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі категорії</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {updateSelling.isError ? (
        <p className="text-sm text-destructive">Не вдалося змінити продаж. Спробуйте ще раз.</p>
      ) : null}

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
          filtersActive ? (
            <EmptyState
              title="Нічого не знайдено"
              description="Спробуйте змінити пошук або фільтри."
            />
          ) : (
            <EmptyState
              title="Меню порожнє"
              description="Додайте страви або продукти, і вони з'являться тут."
            />
          )
        }
      />
    </div>
  );
}

function SellingSwitch({
  item,
  disabled,
  onChange,
}: {
  item: MenuItem;
  disabled: boolean;
  onChange: (selling: boolean) => void;
}) {
  const label = item.selling ? "Продається" : "Не продається";
  const switchId = `menu-selling-${item.id}`;

  return (
    <div
      className="flex items-center gap-2"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Switch
        id={switchId}
        checked={item.selling}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={`${item.name}: ${label}`}
      />
      <label htmlFor={switchId} className="text-sm text-muted-foreground">
        {label}
      </label>
    </div>
  );
}

function categoriesForKind(
  categories: CategoryGroups | undefined,
  kind: KindFilter,
): NamedCategory[] {
  if (!categories) return [];

  const source =
    kind === "DISH"
      ? categories.dishesCategories
      : kind === "PRODUCT"
        ? categories.productsCategories
        : uniqueCategories([...categories.dishesCategories, ...categories.productsCategories]);

  return [...source].sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

function uniqueCategories(categories: ReadonlyArray<NamedCategory>): NamedCategory[] {
  const byId = new Map<number, NamedCategory>();
  for (const category of categories) {
    if (!byId.has(category.id)) byId.set(category.id, category);
  }
  return [...byId.values()];
}

function categoryName(categories: CategoryGroups | undefined, categoryId: number | null): string {
  if (categoryId == null || !categories) return "—";
  return (
    [...categories.dishesCategories, ...categories.productsCategories].find(
      (category) => category.id === categoryId,
    )?.name ?? "—"
  );
}
