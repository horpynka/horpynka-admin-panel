import type { CashShift } from "@/types/domain";

const mockCashShifts: CashShift[] = [
  {
    id: 1,
    openedAt: "2024-08-19T08:00:00Z",
    closedAt: null,
    openingBalance: 50000,
    cashSales: 120000,
    cardSales: 85000,
    refunds: 7500,
    closingBalance: 162500,
    ordersCount: 25,
    status: "OPEN",
    cashierName: "Олександр Петренко",
  },
  {
    id: 2,
    openedAt: "2024-08-18T08:00:00Z",
    closedAt: "2024-08-18T20:00:00Z",
    openingBalance: 50000,
    cashSales: 185000,
    cardSales: 130000,
    refunds: 0,
    closingBalance: 235000,
    ordersCount: 37,
    status: "CLOSED",
    cashierName: "Марія Коваленко",
  },
  {
    id: 3,
    openedAt: "2024-08-17T08:00:00Z",
    closedAt: "2024-08-17T20:00:00Z",
    openingBalance: 50000,
    cashSales: 165000,
    cardSales: 124000,
    refunds: 0,
    closingBalance: 215000,
    ordersCount: 34,
    status: "CLOSED",
    cashierName: "Олександр Петренко",
  },
  {
    id: 4,
    openedAt: "2024-08-16T08:00:00Z",
    closedAt: "2024-08-16T20:00:00Z",
    openingBalance: 50000,
    cashSales: 192000,
    cardSales: 133000,
    refunds: 0,
    closingBalance: 242000,
    ordersCount: 41,
    status: "CLOSED",
    cashierName: "Марія Коваленко",
  },
  {
    id: 5,
    openedAt: "2024-08-15T08:00:00Z",
    closedAt: "2024-08-15T20:00:00Z",
    openingBalance: 50000,
    cashSales: 175000,
    cardSales: 123000,
    refunds: 0,
    closingBalance: 225000,
    ordersCount: 35,
    status: "CLOSED",
    cashierName: "Олександр Петренко",
  },
];

class CashShiftsRepository {
  async getAll(): Promise<CashShift[]> {
    await this.simulateDelay();
    return [...mockCashShifts].sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
  }

  async getById(id: number): Promise<CashShift | null> {
    await this.simulateDelay();
    return mockCashShifts.find((shift) => shift.id === id) ?? null;
  }

  private simulateDelay() {
    return new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
  }
}

export const cashShiftsRepository = new CashShiftsRepository();
