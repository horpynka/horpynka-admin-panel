import type { Transaction } from "@/types/domain";
import { mockOrders } from "@/data/orders";

class TransactionsRepository {
  async getAll(): Promise<Transaction[]> {
    await this.simulateDelay();

    return mockOrders
      .filter(
        (order) =>
          order.status === "CLOSED" || order.status === "PAID" || order.status === "REFUNDED",
      )
      .map((order) => {
        const totalRefund = order.refundedWithCash + order.refundedWithCard;
        const kind = totalRefund > 0 ? "REFUND" : "SALE";

        let paymentMethod: "CASH" | "CARD" | "MIXED";
        if (order.paidWithCash > 0 && order.paidWithCard > 0) {
          paymentMethod = "MIXED";
        } else if (order.paidWithCash > 0) {
          paymentMethod = "CASH";
        } else {
          paymentMethod = "CARD";
        }

        return {
          id: `order-${order.id}`,
          orderId: order.id,
          createdAt: order.createdAt,
          kind,
          paymentMethod,
          amount: order.orderPrice,
          refundedAmount: totalRefund,
          orderStatus: order.status,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private simulateDelay() {
    return new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));
  }
}

export const transactionsRepository = new TransactionsRepository();
