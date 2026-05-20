const prisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  position: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn()
  },
  $transaction: jest.fn()
};

class PrismaClientKnownRequestError extends Error {
  code: string;

  constructor(message: string, options: { code: string }) {
    super(message);
    this.code = options.code;
  }
}

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => prisma),
  Prisma: {
    PrismaClientKnownRequestError,
    TransactionIsolationLevel: {
      Serializable: "Serializable"
    }
  }
}));

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

import { OrderService } from "../services/OrderService";

const pendingBuyMessage = {
  orderId: 1,
  userId: "user-001",
  symbol: "PETR4",
  type: "COMPRA" as const,
  quantity: 2,
  price: 30,
  status: "PENDENTE" as const,
  timestamp: "2026-05-18T10:00:00.000Z"
};

describe("OrderService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.update.mockResolvedValue({});
    prisma.position.updateMany.mockResolvedValue({ count: 1 });
  });

  it("should ignore messages with an invalid status", async () => {
    await new OrderService().processOrder({
      ...pendingBuyMessage,
      status: "EXECUTADA" as any
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it("should ignore duplicate pending messages when the order cannot be claimed", async () => {
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.position.create).not.toHaveBeenCalled();
    expect(prisma.position.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "EXECUTADA" }
    });
  });

  it("should cancel a pending or processing order atomically", async () => {
    await new OrderService().processOrder({
      ...pendingBuyMessage,
      status: "CANCELADA"
    });

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        status: { in: ["PENDENTE", "PROCESSANDO"] }
      },
      data: { status: "CANCELADA" }
    });
  });

  it("should create a new position for a claimed pending buy order", async () => {
    prisma.position.findUnique.mockResolvedValue(null);

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "PENDENTE" },
      data: { status: "PROCESSANDO" }
    });
    expect(prisma.position.create).toHaveBeenCalledWith({
      data: {
        userId: "user-001",
        symbol: "PETR4",
        quantity: 2,
        averagePrice: 30,
        totalValue: 60
      }
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "EXECUTADA" }
    });
  });

  it("should update an existing position for a claimed pending buy order", async () => {
    prisma.position.findUnique.mockResolvedValue({
      quantity: { toString: () => "3" },
      averagePrice: { toString: () => "20" },
      totalValue: { toString: () => "60" }
    });

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.position.update).toHaveBeenCalledWith({
      where: { userId_symbol: { userId: "user-001", symbol: "PETR4" } },
      data: {
        quantity: 5,
        averagePrice: 24,
        totalValue: 120
      }
    });
  });

  it("should apply a sell order with an atomic conditional decrement", async () => {
    await new OrderService().processOrder({
      ...pendingBuyMessage,
      type: "VENDA"
    });

    expect(prisma.position.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-001",
        symbol: "PETR4",
        quantity: { gte: 2 }
      },
      data: {
        quantity: { decrement: 2 }
      }
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "EXECUTADA" }
    });
  });

  it("should reject a sell order when the atomic decrement affects no rows", async () => {
    prisma.position.updateMany.mockResolvedValue({ count: 0 });

    await expect(new OrderService().processOrder({
      ...pendingBuyMessage,
      type: "VENDA"
    })).rejects.toThrow("Saldo insuficiente");

    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { status: "REJEITADA" }
    });
  });

  it("should keep the original processing error when rejection update fails", async () => {
    prisma.position.findUnique.mockRejectedValue(new Error("position failed"));
    prisma.order.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("reject update failed"));

    await expect(new OrderService().processOrder(pendingBuyMessage)).rejects.toThrow("position failed");
  });

  it("should retry serializable transaction conflicts before succeeding", async () => {
    const conflict = new PrismaClientKnownRequestError("conflict", { code: "P2034" });

    prisma.$transaction
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (callback) => callback(prisma));
    prisma.position.findUnique.mockResolvedValue(null);

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.position.create).toHaveBeenCalled();
  });

  it("should return false when a safe status update receives P2025", async () => {
    prisma.order.update.mockRejectedValue(new PrismaClientKnownRequestError("missing", { code: "P2025" }));

    await expect((new OrderService() as any).safeUpdateOrderStatus(1, "EXECUTADA")).resolves.toBe(false);
  });

  it("should rethrow unknown errors from safe status updates", async () => {
    prisma.order.update.mockRejectedValue(new Error("database failed"));

    await expect((new OrderService() as any).safeUpdateOrderStatus(1, "EXECUTADA")).rejects.toThrow("database failed");
  });
});
