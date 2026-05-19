import request from "supertest";
import { createApp } from "../app";

jest.mock("../utils/Logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

function createControllers() {
  return {
    quotations: {
      list: jest.fn((req, res) => res.json([{ symbol: "PETR4" }])),
      get: jest.fn((req, res) => res.json({ symbol: req.params.symbol }))
    },
    orders: {
      listByUser: jest.fn((req, res) => res.json([{ user_id: req.query.userId }])),
      get: jest.fn((req, res) => res.json({ id: Number(req.params.id) }))
    },
    positions: {
      listByUser: jest.fn((req, res) => res.json([{ user_id: req.query.userId }]))
    }
  };
}

describe("Leitura Ativos API", () => {
  it("should respond to the health endpoint", async () => {
    const response = await request(createApp()).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("API de Investimentos funcionando!");
  });

  it("should handle CORS preflight requests", async () => {
    const controllers = createControllers();

    const response = await request(createApp(controllers.quotations as any, controllers.orders as any, controllers.positions as any))
      .options("/orders");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("should route quotation requests", async () => {
    const controllers = createControllers();
    const app = createApp(controllers.quotations as any, controllers.orders as any, controllers.positions as any);

    await expect(request(app).get("/quotations")).resolves.toMatchObject({ status: 200, body: [{ symbol: "PETR4" }] });
    await expect(request(app).get("/quotations/VALE3")).resolves.toMatchObject({ status: 200, body: { symbol: "VALE3" } });
  });

  it("should route order and position requests", async () => {
    const controllers = createControllers();
    const app = createApp(controllers.quotations as any, controllers.orders as any, controllers.positions as any);

    await expect(request(app).get("/orders?userId=user-001")).resolves.toMatchObject({ status: 200 });
    await expect(request(app).get("/orders/7")).resolves.toMatchObject({ status: 200, body: { id: 7 } });
    await expect(request(app).get("/positions?userId=user-001")).resolves.toMatchObject({ status: 200 });
  });
});
