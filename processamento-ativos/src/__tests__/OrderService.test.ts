const prisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  position: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  }
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
    PrismaClientKnownRequestError
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
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue({ id: 1 });
    prisma.order.update.mockResolvedValue({});
  });

  it("should ignore messages with an invalid status", async () => {
    await new OrderService().processOrder({
      ...pendingBuyMessage,
      status: "EXECUTADA" as any
    });

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("should ignore messages for missing orders", async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("should cancel an existing order", async () => {
    await new OrderService().processOrder({
      ...pendingBuyMessage,
      status: "CANCELADA"
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "CANCELADA" }
    });
  });

  it("should create a new position for a pending buy order", async () => {
    prisma.position.findUnique.mockResolvedValue(null);

    await new OrderService().processOrder(pendingBuyMessage);

    expect(prisma.order.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
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
    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { status: "EXECUTADA" }
    });
  });

  it("should update an existing position for a pending buy order", async () => {
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

  it("should update an existing position for a pending sell order", async () => {
    prisma.position.findUnique.mockResolvedValue({
      quantity: { toString: () => "5" },
      averagePrice: { toString: () => "20" },
      totalValue: { toString: () => "100" }
    });

    await new OrderService().processOrder({
      ...pendingBuyMessage,
      type: "VENDA"
    });

    expect(prisma.position.update).toHaveBeenCalledWith({
      where: { userId_symbol: { userId: "user-001", symbol: "PETR4" } },
      data: {
        quantity: 3,
        averagePrice: 20,
        totalValue: 60
      }
    });
  });

  it("should reject a sell order when the position is missing", async () => {
    prisma.position.findUnique.mockResolvedValue(null);

    await expect(new OrderService().processOrder({
      ...pendingBuyMessage,
      type: "VENDA"
    })).rejects.toThrow("Não existe posição");

    expect(prisma.order.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { status: "REJEITADA" }
    });
  });

  it("should reject a sell order when balance is insufficient", async () => {
    prisma.position.findUnique.mockResolvedValue({
      quantity: { toString: () => "1" },
      averagePrice: { toString: () => "20" },
      totalValue: { toString: () => "20" }
    });

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

  it("should return false when a safe status update receives P2025", async () => {
    prisma.order.update.mockRejectedValue(new PrismaClientKnownRequestError("missing", { code: "P2025" }));

    await expect((new OrderService() as any).safeUpdateOrderStatus(1, "EXECUTADA")).resolves.toBe(false);
  });

  it("should rethrow unknown errors from safe status updates", async () => {
    prisma.order.update.mockRejectedValue(new Error("database failed"));

    await expect((new OrderService() as any).safeUpdateOrderStatus(1, "EXECUTADA")).rejects.toThrow("database failed");
  });

  it("should rethrow unhandled errors from order lookup", async () => {
    prisma.order.findUnique.mockRejectedValue(new Error("lookup failed"));

    await expect(new OrderService().processOrder(pendingBuyMessage)).rejects.toThrow("lookup failed");
  });
});
