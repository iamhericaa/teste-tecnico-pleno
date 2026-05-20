const mockPrisma = {
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  },
  user: {
    upsert: jest.fn()
  },
  asset: {
    findUnique: jest.fn()
  },
  $disconnect: jest.fn()
};

const mockGetUserBalance = jest.fn();
const mockSendMessage = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock("../services/BalanceService", () => ({
  BalanceService: jest.fn(() => ({
    getUserBalance: mockGetUserBalance
  }))
}));

jest.mock("../services/SQSService", () => ({
  SQSService: jest.fn(() => ({
    sendMessage: mockSendMessage
  }))
}));

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { OrderService } from "../services/OrderService";

const createdAt = new Date("2026-05-18T10:00:00.000Z");
const updatedAt = new Date("2026-05-18T10:01:00.000Z");

describe("OrderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserBalance.mockResolvedValue({
      userId: "user-001",
      cash: 10000,
      assets: { PETR4: 10 }
    });
  });

  it("should create a pending buy order and send it to SQS", async () => {
    mockPrisma.order.create.mockResolvedValue({
      id: 1,
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: { toString: () => "2" },
      price: { toString: () => "30.50" },
      status: "PENDENTE",
      createdAt,
      updatedAt
    });

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 2,
      price: 30.5
    });

    expect(mockPrisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-001",
        symbol: "PETR4",
        type: "COMPRA",
        quantity: 2,
        price: 30.5,
        status: "PENDENTE"
      }
    });
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
      id: 1,
      user_id: "user-001",
      quantity: 2,
      price: 30.5,
      status: "PENDENTE"
    }));
    expect(result).toEqual({ success: true, message: "Ordem criada com sucesso", orderId: 1, status: "PENDENTE" });
  });

  it("should create a pending sell order when the asset balance is enough", async () => {
    mockPrisma.order.create.mockResolvedValue({
      id: 2,
      userId: "user-001",
      symbol: "PETR4",
      type: "VENDA",
      quantity: { toString: () => "5" },
      price: { toString: () => "31" },
      status: "PENDENTE",
      createdAt,
      updatedAt
    });
    jest.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "VENDA",
      quantity: 5,
      price: 31
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.order.create).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("should reject a buy order when cash is not enough", async () => {
    mockGetUserBalance.mockResolvedValue({ userId: "user-003", cash: 50, assets: {} });
    mockPrisma.order.create.mockResolvedValue({ id: 3, status: "REJEITADA" });

    const result = await new OrderService().createOrder({
      userId: "user-003",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 10,
      price: 30
    });

    expect(result).toEqual(expect.objectContaining({ success: false, status: "REJEITADA" }));
    expect(result.message).toContain("Saldo insuficiente");
    expect(result.orderId).toBe(3);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { id: "user-003" },
      update: {},
      create: { id: "user-003", name: "user-003" }
    });
    expect(mockPrisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-003",
        symbol: "PETR4",
        type: "COMPRA",
        quantity: 10,
        price: 30,
        status: "REJEITADA"
      }
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should reject a sell order when asset balance is not enough", async () => {
    mockGetUserBalance.mockResolvedValue({ userId: "user-001", cash: 10000, assets: { PETR4: 1 } });
    mockPrisma.order.create.mockResolvedValue({ id: 4, status: "REJEITADA" });

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "VENDA",
      quantity: 2,
      price: 30
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Saldo insuficiente do ativo PETR4");
    expect(result.orderId).toBe(4);
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { id: "user-001" },
      update: {},
      create: { id: "user-001", name: "user-001" }
    });
    expect(mockPrisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-001",
        symbol: "PETR4",
        type: "VENDA",
        quantity: 2,
        price: 30,
        status: "REJEITADA"
      }
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should reject non-positive values during service validation", async () => {
    mockPrisma.order.create.mockResolvedValue({ id: 5, status: "REJEITADA" });

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: -1,
      price: 30
    });

    expect(result).toEqual({
      success: false,
      message: "Quantidade e preço devem ser positivos",
      orderId: 5,
      status: "REJEITADA"
    });
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: { id: "user-001" },
      update: {},
      create: { id: "user-001", name: "user-001" }
    });
    expect(mockPrisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-001",
        symbol: "PETR4",
        type: "COMPRA",
        quantity: -1,
        price: 30,
        status: "REJEITADA"
      }
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("should reject an invalid order type during service validation", async () => {
    const result = await (new OrderService() as any).validateOrder("PETR4", "HOLD", 1, 30, {
      userId: "user-001",
      cash: 10000,
      assets: {}
    });

    expect(result).toEqual({
      valid: false,
      message: "Tipo de ordem inválido. Deve ser COMPRA ou VENDA"
    });
  });

  it("should return a rejected response for not found errors", async () => {
    mockGetUserBalance.mockRejectedValue(new Error("Ativo PETR4 não encontrado"));

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 1,
      price: 30
    });

    expect(result).toEqual({
      success: false,
      message: "Ativo PETR4 não encontrado",
      status: "REJEITADA"
    });
  });

  it("should return a rejected response for unexpected errors", async () => {
    mockPrisma.order.create.mockRejectedValue(new Error("database failed"));

    const result = await new OrderService().createOrder({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 1,
      price: 30
    });

    expect(result).toEqual({
      success: false,
      message: "Erro ao processar ordem: database failed",
      status: "REJEITADA"
    });
  });

  it("should return an order by id", async () => {
    const order = { id: 1, status: "PENDENTE" };
    mockPrisma.order.findUnique.mockResolvedValue(order);

    await expect(new OrderService().getById(1)).resolves.toBe(order);
    expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("should return null when an order is not found by id", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(new OrderService().getById(999)).resolves.toBeNull();
  });

  it("should cancel a pending order", async () => {
    mockPrisma.order.findUnique
      .mockResolvedValueOnce({ id: 1, status: "PENDENTE" })
      .mockResolvedValueOnce({ id: 1, status: "CANCELADA" });
    mockPrisma.order.update.mockResolvedValue({ id: 1, status: "CANCELADA" });

    await expect(new OrderService().cancel(1)).resolves.toEqual({ id: 1, status: "CANCELADA" });
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "CANCELADA" }
    });
  });

  it("should return null when cancelling an unknown order", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(new OrderService().cancel(999)).resolves.toBeNull();
  });

  it("should fail when cancelling a non-pending order", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: 1, status: "EXECUTADA" });

    await expect(new OrderService().cancel(1)).rejects.toThrow("EXECUTADA");
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it("should disconnect from Prisma", async () => {
    mockPrisma.$disconnect.mockResolvedValue(undefined);

    await new OrderService().close();

    expect(mockPrisma.$disconnect).toHaveBeenCalled();
  });
});
