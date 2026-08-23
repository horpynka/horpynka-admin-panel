import type { DashboardStats, CashShift } from "@/types/domain";
import { mockOrders } from "@/data/orders";

class DashboardRepository {
  async getStats(): Promise<DashboardStats> {
    await this.simulateDelay();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = mockOrders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= today;
    });

    const todaySales = todayOrders
      .filter((o) => o.status === "CLOSED" || o.status === "PAID")
      .reduce((sum, o) => sum + o.orderPrice, 0);

    const ordersCount = todayOrders.filter(
      (o) => o.status === "CLOSED" || o.status === "PAID",
    ).length;

    const openOrders = todayOrders.filter((o) => o.status === "CREATED").length;
    const closedOrders = todayOrders.filter((o) => o.status === "CLOSED").length;

    const cashSales = todayOrders.reduce((sum, o) => sum + o.paidWithCash, 0);
    const cardSales = todayOrders.reduce((sum, o) => sum + o.paidWithCard, 0);

    const refunds = todayOrders.reduce(
      (sum, o) => sum + o.refundedWithCash + o.refundedWithCard,
      0,
    );

    const averageOrder = ordersCount > 0 ? todaySales / ordersCount : 0;

    const currentShift: CashShift = {
      id: 1,
      openedAt: new Date().toISOString().split("T")[0] + "T08:00:00Z",
      closedAt: null,
      openingBalance: 50000,
      cashSales,
      cardSales,
      refunds,
      closingBalance: 50000 + cashSales - refunds,
      ordersCount,
      status: "OPEN",
      cashierName: "Олександр Петренко",
    };

    const salesByDay = [
      { date: "2024-08-13", sales: 285000, orders: 32 },
      { date: "2024-08-14", sales: 312000, orders: 38 },
      { date: "2024-08-15", sales: 298000, orders: 35 },
      { date: "2024-08-16", sales: 325000, orders: 41 },
      { date: "2024-08-17", sales: 289000, orders: 34 },
      { date: "2024-08-18", sales: 315000, orders: 37 },
      { date: "2024-08-19", sales: todaySales, orders: ordersCount },
    ];

    const paymentSplit = [
      { name: "Готівка", value: cashSales },
      { name: "Картка", value: cardSales },
    ];

    return {
      todaySales,
      ordersCount,
      openOrders,
      closedOrders,
      cashSales,
      cardSales,
      refunds,
      averageOrder,
      currentShift,
      salesByDay,
      paymentSplit,
    };
  }

  private simulateDelay() {
    return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
  }
}

export const dashboardRepository = new DashboardRepository();
