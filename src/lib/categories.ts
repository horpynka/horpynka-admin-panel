export type NamedCategory = {
  id: number;
  name: string;
};

export type CategoryLists = {
  dishesCategories: ReadonlyArray<NamedCategory>;
  productsCategories: ReadonlyArray<NamedCategory>;
  allCategories?: ReadonlyArray<NamedCategory>;
};

export function listCategories(categories: CategoryLists): NamedCategory[] {
  const byId = new Map<number, NamedCategory>();

  for (const category of categories.allCategories ?? []) {
    byId.set(category.id, { id: category.id, name: category.name });
  }

  for (const category of [...categories.dishesCategories, ...categories.productsCategories]) {
    if (!byId.has(category.id)) {
      byId.set(category.id, { id: category.id, name: category.name });
    }
  }

  return [...byId.values()];
}

export function categoryName(
  categories: CategoryLists | undefined,
  categoryId: number | null,
): string {
  if (!categoryId || !categories) return "—";
  return listCategories(categories).find((category) => category.id === categoryId)?.name ?? "—";
}

export function validateCategoryName(
  name: string,
  categories: ReadonlyArray<NamedCategory>,
  currentId?: number,
): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Вкажіть назву.";

  const normalized = trimmed.toLowerCase();
  const duplicate = categories.some(
    (category) => category.id !== currentId && category.name.trim().toLowerCase() === normalized,
  );
  if (duplicate) return "Категорія з такою назвою вже існує.";

  return null;
}
