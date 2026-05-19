const prisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  order: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn()
  },
  position: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  priceCache: {
    upsert: jest.fn(),
    findUnique: jest.fn()
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn()
};

jest.mock("../database/prisma", () => ({ prisma }));
jest.mock("../utils/Logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { OrderService } from "../services/OrderService";
import { PositionService } from "../services/PositionService";
import { QuotationService } from "../services/QuotationService";
import { User } from "../models/User";

const createdAt = new Date("2026-05-18T10:00:00.000Z");
const updatedAt = new Date("2026-05-18T10:01:00.000Z");
const freshUpdatedAt = new Date();

function prismaOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: "user-001",
    symbol: "PETR4",
    type: "COMPRA",
    quantity: 2,
    price: 35,
    status: "PENDENTE",
    createdAt,
    updatedAt,
    ...overrides
  } as any;
}

function resetPrisma() {
  Object.values(prisma).forEach((value) => {
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
      return;
    }

    Object.values(value as Record<string, jest.Mock>).forEach((mock) => mock.mockReset());
  });
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
}

describe("QuotationService", () => {
  beforeEach(resetPrisma);

  it("should list mapped quotations", async () => {
    prisma.asset.findMany.mockResolvedValue([
      { symbol: "PETR4", name: "Petrobras", referencePrice: 35.1, createdAt, updatedAt }
    ]);

    await expect(new QuotationService().list()).resolves.toEqual([
      { symbol: "PETR4", name: "Petrobras", reference_price: 35.1, created_at: createdAt, updated_at: updatedAt }
    ]);
  });

  it("should get a quotation by symbol", async () => {
    prisma.asset.findUnique.mockResolvedValue({ symbol: "VALE3", name: "Vale", referencePrice: 62.2, createdAt, updatedAt });

    await expect(new QuotationService().getBySymbol("VALE3")).resolves.toEqual({
      symbol: "VALE3",
      name: "Vale",
      reference_price: 62.2,
      created_at: createdAt,
      updated_at: updatedAt
    });
  });

  it("should return null when a quotation is missing", async () => {
    prisma.asset.findUnique.mockResolvedValue(null);

    await expect(new QuotationService().getBySymbol("XXXX")).resolves.toBeNull();
  });

  it("should return the price for an existing quotation", async () => {
    prisma.asset.findUnique.mockResolvedValue({ symbol: "ITUB4", name: "Itau", referencePrice: 30, createdAt, updatedAt });

    await expect(new QuotationService().getPrice("ITUB4")).resolves.toBe(30);
  });

  it("should fail when getting the price for a missing quotation", async () => {
    prisma.asset.findUnique.mockResolvedValue(null);

    await expect(new QuotationService().getPrice("XXXX")).rejects.toThrow("Ativo XXXX");
  });

  it("should disconnect from Prisma", async () => {
    prisma.$disconnect.mockResolvedValue(undefined);

    await new QuotationService().close();

    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});

describe("PositionService", () => {
  beforeEach(resetPrisma);

  it("should list positions ordered by current value", async () => {
    prisma.position.findMany.mockResolvedValue([
      {
        id: 1,
        userId: "user-001",
        symbol: "PETR4",
        quantity: 2,
        averagePrice: 20,
        createdAt,
        updatedAt,
        asset: { name: "Petrobras", referencePrice: 30 }
      },
      {
        id: 2,
        userId: "user-001",
        symbol: "VALE3",
        quantity: 1,
        averagePrice: 50,
        createdAt,
        updatedAt,
        asset: { name: "Vale", referencePrice: 100 }
      }
    ]);

    const result = await new PositionService().listByUser("user-001");

    expect(result.map((position) => position.symbol)).toEqual(["VALE3", "PETR4"]);
    expect(result[1].profit_loss).toBe(20);
  });

  it("should get one position by user and symbol", async () => {
    prisma.position.findUnique.mockResolvedValue({
      id: 1,
      userId: "user-001",
      symbol: "PETR4",
      quantity: 2,
      averagePrice: 20,
      createdAt,
      updatedAt
    });

    await expect(new PositionService().getByUserAndSymbol("user-001", "PETR4")).resolves.toEqual({
      id: 1,
      user_id: "user-001",
      symbol: "PETR4",
      quantity: 2,
      average_price: 20,
      created_at: createdAt,
      updated_at: updatedAt
    });
  });

  it("should return null when a position is missing", async () => {
    prisma.position.findUnique.mockResolvedValue(null);

    await expect(new PositionService().getByUserAndSymbol("user-001", "XXXX")).resolves.toBeNull();
  });

  it("should disconnect from Prisma", async () => {
    prisma.$disconnect.mockResolvedValue(undefined);

    await new PositionService().close();

    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});

describe("OrderService", () => {
  beforeEach(resetPrisma);

  it("should create a buy order", async () => {
    prisma.order.create.mockResolvedValue(prismaOrder());

    await expect(new OrderService({ getPrice: jest.fn() }).create({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 2,
      price: 35
    })).resolves.toEqual(expect.objectContaining({ id: 1, user_id: "user-001", status: "PENDENTE" }));
  });

  it("should create a sell order when the position balance is enough", async () => {
    prisma.$queryRaw.mockResolvedValue([{ quantity: 10 }]);
    prisma.order.create.mockResolvedValue(prismaOrder({ type: "VENDA" }));

    await expect(new OrderService({ getPrice: jest.fn() }).create({
      userId: "user-001",
      symbol: "PETR4",
      type: "VENDA",
      quantity: 2,
      price: 35
    })).resolves.toEqual(expect.objectContaining({ type: "VENDA" }));
  });

  it("should fail when creating a sell order with insufficient balance", async () => {
    prisma.$queryRaw.mockResolvedValue([{ quantity: 1 }]);

    await expect(new OrderService({ getPrice: jest.fn() }).create({
      userId: "user-001",
      symbol: "PETR4",
      type: "VENDA",
      quantity: 2,
      price: 35
    })).rejects.toThrow("Saldo insuficiente");
  });

  it("should list orders by user", async () => {
    prisma.order.findMany.mockResolvedValue([prismaOrder({ id: 2 })]);

    await expect(new OrderService({ getPrice: jest.fn() }).listByUser("user-001")).resolves.toEqual([
      expect.objectContaining({ id: 2, user_id: "user-001" })
    ]);
  });

  it("should get an order by id", async () => {
    prisma.order.findUnique.mockResolvedValue(prismaOrder({ id: 3 }));

    await expect(new OrderService({ getPrice: jest.fn() }).getById(3)).resolves.toEqual(expect.objectContaining({ id: 3 }));
  });

  it("should return null when an order is not found", async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(new OrderService({ getPrice: jest.fn() }).getById(99)).resolves.toBeNull();
  });

  it("should process a buy order successfully", async () => {
    const quotationService = { getPrice: jest.fn().mockResolvedValue(35) };
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.order.update.mockResolvedValue({});
    prisma.priceCache.upsert.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.order.findUnique.mockResolvedValue(prismaOrder({ status: "EXECUTADA" }));

    await expect(new OrderService(quotationService).processOrder(1)).resolves.toEqual(expect.objectContaining({ status: "EXECUTADA" }));
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it("should process a sell order successfully", async () => {
    const quotationService = { getPrice: jest.fn().mockResolvedValue(35) };
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ quantity: 5 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder({ type: "VENDA" }));
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.order.update.mockResolvedValue({});
    prisma.priceCache.upsert.mockResolvedValue({});
    prisma.position.update.mockResolvedValue({});
    prisma.order.findUnique.mockResolvedValue(prismaOrder({ type: "VENDA", status: "EXECUTADA" }));

    await expect(new OrderService(quotationService).processOrder(1)).resolves.toEqual(expect.objectContaining({ type: "VENDA" }));
    expect(prisma.position.update).toHaveBeenCalled();
  });

  it("should reject processing when the order lock is missing", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(99)).rejects.toThrow("Ordem não encontrada");
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 99 }, data: { status: "REJEITADA" } });
  });

  it("should reject processing when the order is not pending", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder({ status: "EXECUTADA" }));
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("status: EXECUTADA");
  });

  it("should reject processing when quotation freshness asset is missing", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique.mockResolvedValue(null);
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("Ativo PETR4");
  });

  it("should reject processing when quotation is stale", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique.mockResolvedValue({ updatedAt: new Date("2020-01-01T00:00:00.000Z") });
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("desatualizada");
  });

  it("should reject processing when price asset is missing", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce(null);
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("Ativo PETR4");
  });

  it("should reject processing when price difference is above tolerance", async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder({ price: 100 }));
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("Diferença de preço");
  });

  it("should use cached price when quotation service fails", async () => {
    const quotationService = { getPrice: jest.fn().mockRejectedValue(new Error("quotes down")) };
    jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
      callback();
      return 0 as any;
    });
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.priceCache.findUnique.mockResolvedValue({ lastPrice: 35 });
    prisma.order.update.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.order.findUnique.mockResolvedValue(prismaOrder({ status: "EXECUTADA" }));

    await expect(new OrderService(quotationService).processOrder(1)).resolves.toEqual(expect.objectContaining({ status: "EXECUTADA" }));
    expect(prisma.priceCache.findUnique).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("should fail when quotation service and cache are unavailable", async () => {
    const quotationService = { getPrice: jest.fn().mockRejectedValue(new Error("quotes down")) };
    jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
      callback();
      return 0 as any;
    });
    prisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.priceCache.findUnique.mockResolvedValue(null);
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService(quotationService).processOrder(1)).rejects.toThrow("não há preço em cache");
    jest.restoreAllMocks();
  });

  it("should reject a sell order during execution when balance is insufficient", async () => {
    const quotationService = { getPrice: jest.fn().mockResolvedValue(35) };
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ quantity: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder({ type: "VENDA" }));
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.priceCache.upsert.mockResolvedValue({});
    prisma.order.update.mockResolvedValue({});

    await expect(new OrderService(quotationService).processOrder(1)).rejects.toThrow("Saldo insuficiente");
  });

  it("should keep the original error when marking an order as rejected fails", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.order.update.mockRejectedValue(new Error("update failed"));

    await expect(new OrderService({ getPrice: jest.fn() }).processOrder(1)).rejects.toThrow("Ordem não encontrada");
  });

  it("should fail when the processed order cannot be reloaded", async () => {
    const quotationService = { getPrice: jest.fn().mockResolvedValue(35) };
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]);
    prisma.order.findUniqueOrThrow.mockResolvedValue(prismaOrder());
    prisma.asset.findUnique
      .mockResolvedValueOnce({ updatedAt: freshUpdatedAt })
      .mockResolvedValueOnce({ referencePrice: 35 });
    prisma.order.update.mockResolvedValue({});
    prisma.priceCache.upsert.mockResolvedValue({});
    prisma.$executeRaw.mockResolvedValue(1);
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(new OrderService(quotationService).processOrder(1)).rejects.toThrow("após processamento");
  });

  it("should disconnect from Prisma", async () => {
    prisma.$disconnect.mockResolvedValue(undefined);

    await new OrderService({ getPrice: jest.fn() }).close();

    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});

describe("User", () => {
  it("should store user properties", () => {
    expect(new User(1, "Ada", "ada@example.com")).toEqual({
      id: 1,
      name: "Ada",
      email: "ada@example.com"
    });
  });
});
