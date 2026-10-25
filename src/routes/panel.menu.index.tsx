import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { categoryName } from "@/lib/categories";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { MENU_ITEM_KIND_LABELS, SELLING_LABELS } from "@/lib/labels";
import type { MenuItem, MenuItemKind } from "@/types/domain";
import { useCategoriesApi, useMenuApi } from "@horpynka/api-sdk";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  const { getCatalogQuery, mutateUpdateSelling } = useMenuApi();
  const catalogQuery = getCatalogQuery();
  const { data: menuItems, isLoading, isError } = useQuery(catalogQuery);

  const getCategories = useCategoriesApi().getCategoriesQuery;
  const { data: categories } = useQuery(getCategories());

  const categoryOptions = categoriesForKind(categories, kindFilter);

  const handleKindChange = (value: string) => {
    if (!isKindFilter(value)) return;
    setKindFilter(value);
    setCategoryFilter((current) => {
      if (current === "all") return current;
      const allowed = categoriesForKind(categories, value);
      return allowed.some((category) => String(category.id) === current) ? current : "all";
    });
  };

  const toggleSelling = (item: MenuItem, selling: boolean) => {
    queryClient.setQueryData<MenuItem[]>(catalogQuery.queryKey, (current) =>
      current?.map((row) => (row.id === item.id ? { ...row, selling } : row)),
    );
    setPendingIds((current) => new Set(current).add(item.id));

    mutateUpdateSelling.mutate(
      {
        params: {
          id: item.id,
          updateMenuItemSellingDto: { selling },
        },
        onSettledCallback: () => {
          setPendingIds((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
          void queryClient.invalidateQueries({
            queryKey: item.kind === "DISH" ? ["dishes"] : ["products"],
          });
        },
      },
      {
        onError: () => {
          queryClient.setQueryData<MenuItem[]>(catalogQuery.queryKey, (current) =>
            current?.map((row) => (row.id === item.id ? { ...row, selling: item.selling } : row)),
          );
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (isError || !menuItems) return <ErrorState message="Не вдалося завантажити меню." />;

  const query = search.trim().toLowerCase();
  const filteredItems = menuItems.filter((item) => {
    const categoryName = categoryLabel(categories, item);
    const matchesSearch = query
      ? item.name.toLowerCase().includes(query) || categoryName.toLowerCase().includes(query)
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
        <span className="text-sm text-muted-foreground">{categoryLabel(categories, row)}</span>
      ),
      sortValue: (row) => categoryLabel(categories, row),
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
          disabled={pendingIds.has(row.id)}
          onChange={(selling) => toggleSelling(row, selling)}
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
          <Select value={kindFilter} onValueChange={handleKindChange}>
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

      {mutateUpdateSelling.isError ? (
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
  const label = item.selling ? SELLING_LABELS.true : SELLING_LABELS.false;
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
      <label
        htmlFor={switchId}
        className="cursor-pointer text-sm whitespace-nowrap text-muted-foreground"
      >
        {label}
      </label>
    </div>
  );
}

function isKindFilter(value: string): value is KindFilter {
  return value === "all" || value === "DISH" || value === "PRODUCT";
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

  return [...source].sort((left, right) => left.name.localeCompare(right.name, "uk"));
}

function uniqueCategories(categories: ReadonlyArray<NamedCategory>): NamedCategory[] {
  const byId = new Map<number, NamedCategory>();
  for (const category of categories) {
    if (!byId.has(category.id)) byId.set(category.id, category);
  }
  return [...byId.values()];
}

function categoryLabel(categories: CategoryGroups | undefined, item: MenuItem): string {
  if (item.categoryId == null || !categories) return "—";
  const source = item.kind === "DISH" ? categories.dishesCategories : categories.productsCategories;
  return source.find((category) => category.id === item.categoryId)?.name ?? "—";
}
