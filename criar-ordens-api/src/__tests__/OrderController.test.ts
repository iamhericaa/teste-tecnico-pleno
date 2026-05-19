import { OrderController } from "../controllers/OrderController";

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

function createResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  return res;
}

describe("OrderController", () => {
  it("should return a health check response", async () => {
    const controller = new OrderController({} as any);
    const res = createResponse();

    await controller.healthCheck({} as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "OK" }));
  });

  it("should reject an order with missing required fields", async () => {
    const controller = new OrderController({ createOrder: jest.fn() } as any);
    const res = createResponse();

    await controller.createOrder({ body: { userId: "user-001" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("should reject an order with an invalid type", async () => {
    const controller = new OrderController({ createOrder: jest.fn() } as any);
    const res = createResponse();

    await controller.createOrder({
      body: { userId: "user-001", symbol: "PETR4", type: "HOLD", quantity: 1, price: 10 }
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Tipo") }));
  });

  it("should reject an order with non-positive quantity or price", async () => {
    const controller = new OrderController({ createOrder: jest.fn() } as any);
    const res = createResponse();

    await controller.createOrder({
      body: { userId: "user-001", symbol: "PETR4", type: "COMPRA", quantity: -1, price: 10 }
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("positivos") }));
  });

  it("should create an order and return 201 when the service succeeds", async () => {
    const service = {
      createOrder: jest.fn().mockResolvedValue({ success: true, message: "ok", orderId: 10, status: "PENDENTE" })
    };
    const controller = new OrderController(service as any);
    const res = createResponse();

    await controller.createOrder({
      body: { userId: "user-001", symbol: "PETR4", type: "COMPRA", quantity: 2, price: 30 }
    } as any, res);

    expect(service.createOrder).toHaveBeenCalledWith({
      userId: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 2,
      price: 30
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should return 400 when the service rejects business validation", async () => {
    const service = {
      createOrder: jest.fn().mockResolvedValue({ success: false, message: "no balance", status: "REJEITADA" })
    };
    const controller = new OrderController(service as any);
    const res = createResponse();

    await controller.createOrder({
      body: { userId: "user-001", symbol: "PETR4", type: "COMPRA", quantity: 1000, price: 30 }
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "no balance", status: "REJEITADA" });
  });

  it("should return 500 when order creation throws", async () => {
    const service = {
      createOrder: jest.fn().mockRejectedValue(new Error("database unavailable"))
    };
    const controller = new OrderController(service as any);
    const res = createResponse();

    await controller.createOrder({
      body: { userId: "user-001", symbol: "PETR4", type: "COMPRA", quantity: 1, price: 30 }
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: "database unavailable" }));
  });

  it("should reject cancellation with an invalid id", async () => {
    const controller = new OrderController({ cancel: jest.fn() } as any);
    const res = createResponse();

    await controller.cancel({ params: { id: "abc" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ID inválido" });
  });

  it("should return 404 when the order to cancel is not found", async () => {
    const controller = new OrderController({ cancel: jest.fn().mockResolvedValue(null) } as any);
    const res = createResponse();

    await controller.cancel({ params: { id: "123" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Ordem não encontrada" });
  });

  it("should cancel an order", async () => {
    const order = { id: 123, status: "CANCELADA" };
    const service = { cancel: jest.fn().mockResolvedValue(order) };
    const controller = new OrderController(service as any);
    const res = createResponse();

    await controller.cancel({ params: { id: "123" } } as any, res);

    expect(service.cancel).toHaveBeenCalledWith(123);
    expect(res.json).toHaveBeenCalledWith(order);
  });

  it("should return 400 when cancellation throws", async () => {
    const controller = new OrderController({ cancel: jest.fn().mockRejectedValue(new Error("already executed")) } as any);
    const res = createResponse();

    await controller.cancel({ params: { id: "123" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "already executed" });
  });
});
