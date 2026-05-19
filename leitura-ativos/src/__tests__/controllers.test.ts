import { OrderController } from "../controllers/OrderController";
import { PositionController } from "../controllers/PositionController";
import { QuotationController } from "../controllers/QuotationController";

jest.mock("../utils/Logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn()
  } as any;
}

describe("QuotationController", () => {
  it("should list quotations", async () => {
    const service = { list: jest.fn().mockResolvedValue([{ symbol: "PETR4" }]) };
    const res = createResponse();

    await new QuotationController(service as any).list({} as any, res);

    expect(res.json).toHaveBeenCalledWith([{ symbol: "PETR4" }]);
  });

  it("should return 500 when listing quotations fails", async () => {
    const service = { list: jest.fn().mockRejectedValue(new Error("db failed")) };
    const res = createResponse();

    await new QuotationController(service as any).list({} as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Erro interno do servidor" });
  });

  it("should get one quotation by symbol", async () => {
    const asset = { symbol: "PETR4", reference_price: 35.1 };
    const service = { getBySymbol: jest.fn().mockResolvedValue(asset) };
    const res = createResponse();

    await new QuotationController(service as any).get({ params: { symbol: "PETR4" } } as any, res);

    expect(service.getBySymbol).toHaveBeenCalledWith("PETR4");
    expect(res.json).toHaveBeenCalledWith(asset);
  });

  it("should return 404 when a quotation is not found", async () => {
    const service = { getBySymbol: jest.fn().mockResolvedValue(null) };
    const res = createResponse();

    await new QuotationController(service as any).get({ params: { symbol: "XXXX" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Ativo não encontrado" });
  });

  it("should return 500 when getting a quotation fails", async () => {
    const service = { getBySymbol: jest.fn().mockRejectedValue(new Error("db failed")) };
    const res = createResponse();

    await new QuotationController(service as any).get({ params: { symbol: "PETR4" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("OrderController", () => {
  it("should list orders by user", async () => {
    const service = { listByUser: jest.fn().mockResolvedValue([{ id: 1 }]) };
    const res = createResponse();

    await new OrderController(service as any).listByUser({ query: { userId: "user-001" } } as any, res);

    expect(service.listByUser).toHaveBeenCalledWith("user-001");
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it("should reject listing orders without userId", async () => {
    const service = { listByUser: jest.fn() };
    const res = createResponse();

    await new OrderController(service as any).listByUser({ query: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "userId é obrigatório" });
  });

  it("should return 500 when listing orders fails", async () => {
    const service = { listByUser: jest.fn().mockRejectedValue(new Error("db failed")) };
    const res = createResponse();

    await new OrderController(service as any).listByUser({ query: { userId: "user-001" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("should get one order by id", async () => {
    const order = { id: 10 };
    const service = { getById: jest.fn().mockResolvedValue(order) };
    const res = createResponse();

    await new OrderController(service as any).get({ params: { id: "10" } } as any, res);

    expect(service.getById).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(order);
  });

  it("should reject an invalid order id", async () => {
    const service = { getById: jest.fn() };
    const res = createResponse();

    await new OrderController(service as any).get({ params: { id: "abc" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ID inválido" });
  });

  it("should return 404 when an order is not found", async () => {
    const service = { getById: jest.fn().mockResolvedValue(null) };
    const res = createResponse();

    await new OrderController(service as any).get({ params: { id: "99" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Ordem não encontrada" });
  });

  it("should return 500 when getting an order fails", async () => {
    const service = { getById: jest.fn().mockRejectedValue(new Error("db failed")) };
    const res = createResponse();

    await new OrderController(service as any).get({ params: { id: "10" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("PositionController", () => {
  it("should list positions by user", async () => {
    const service = { listByUser: jest.fn().mockResolvedValue([{ id: 1 }]) };
    const res = createResponse();

    await new PositionController(service as any).listByUser({ query: { userId: "user-001" } } as any, res);

    expect(service.listByUser).toHaveBeenCalledWith("user-001");
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it("should reject listing positions without userId", async () => {
    const service = { listByUser: jest.fn() };
    const res = createResponse();

    await new PositionController(service as any).listByUser({ query: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "userId é obrigatório" });
  });

  it("should return 500 when listing positions fails", async () => {
    const service = { listByUser: jest.fn().mockRejectedValue(new Error("db failed")) };
    const res = createResponse();

    await new PositionController(service as any).listByUser({ query: { userId: "user-001" } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
