/**
 * Доменні типи, що відповідають існуючій PostgreSQL-схемі POS-системи.
 * Усі поля — camelCase. Грошові значення зберігаються як integer (копійки).
 */

export type MeasurementUnit = "g" | "ml" | "pcs";

export interface Category {
  id: number;
  name: string;
}

export interface Dish {
  id: number;
  name: string;
  categoryId: number | null;
  ownPrice: number;
  sellingPrice: number;
  selling: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: number;
  name: string;
  measurementUnit: MeasurementUnit;
}

export interface DishIngredient {
  id: number;
  dishId: number | null;
  ingredientId: number | null;
}

export interface Product {
  id: number;
  name: string;
  ownPrice: number;
  sellingPrice: number;
  categoryId: number | null;
  selling: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "CREATED" | "PAID" | "CLOSED" | "REFUNDED" | "CANCELED";

export interface Order {
  id: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  orderPrice: number;
  paidWithCash: number;
  paidWithCard: number;
  refundedWithCash: number;
  refundedWithCard: number;
}

export type DiscountType = "NONE" | "PERCENT" | "AMOUNT";

export interface OrderItem {
  id: number;
  sellingPrice: number;
  discount: string | null;
  discountType: DiscountType;
  dishId: number | null;
  productId: number | null;
  orderId: number | null;
}

/** Користувач без пароля — саме ця модель використовується в UI. */
export interface User {
  id: number;
  email: string;
  username: string;
  roles: string[];
}

/* ---------- Frontend-only view-моделі (немає окремих таблиць у БД) ---------- */

export type MenuItemKind = "DISH" | "PRODUCT";

export interface MenuItem {
  /** Складений ідентифікатор виду `dish-12` / `product-4`. */
  id: string;
  kind: MenuItemKind;
  entityId: number;
  name: string;
  categoryId: number | null;
  sellingPrice: number;
  ownPrice: number;
  selling: boolean;
  updatedAt: string;
}

export type TransactionKind = "SALE" | "REFUND";
export type PaymentMethod = "CASH" | "CARD" | "MIXED";

export interface Transaction {
  id: string;
  orderId: number;
  createdAt: string;
  kind: TransactionKind;
  paymentMethod: PaymentMethod;
  amount: number;
  refundedAmount: number;
  orderStatus: OrderStatus;
}

export type CashShiftStatus = "OPEN" | "CLOSED";

export interface CashShift {
  id: number;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  refunds: number;
  closingBalance: number;
  actualClosingBalance: number | null;
  difference: number | null;
  ordersCount: number;
  status: CashShiftStatus;
  cashierName: string;
}

export type InventoryStatus = "COMPLETED" | "WITH_DIFFERENCES" | "IN_PROGRESS";

export interface InventoryItem {
  id: number;
  name: string;
  measurementUnit: MeasurementUnit;
  expectedQuantity: number;
  /** Порожнє, доки фактичну кількість не збережено. */
  actualQuantity: number | null;
}

export interface Inventory {
  id: number;
  createdAt: string;
  finishedAt: string | null;
  status: InventoryStatus;
  responsible: string;
  items: InventoryItem[];
}

export interface DashboardStats {
  todaySales: number;
  ordersCount: number;
  openOrders: number;
  closedOrders: number;
  cashSales: number;
  cardSales: number;
  refunds: number;
  averageOrder: number;
  currentShift: CashShift | null;
  salesByDay: { date: string; sales: number; orders: number }[];
  paymentSplit: { name: string; value: number }[];
}
