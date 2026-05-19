import request from "supertest";
import { createApp } from "../app";

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe("Criar Ordens API", () => {
  it("should respond to the health endpoint", async () => {
    const controller = {
      healthCheck: jest.fn((req, res) => res.status(200).json({ status: "OK" })),
      createOrder: jest.fn(),
      cancel: jest.fn()
    };

    const response = await request(createApp(controller as any)).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "OK" });
  });

  it("should handle CORS preflight requests", async () => {
    const controller = {
      healthCheck: jest.fn(),
      createOrder: jest.fn(),
      cancel: jest.fn()
    };

    const response = await request(createApp(controller as any)).options("/criar-ordens");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("should create an order through the endpoint", async () => {
    const controller = {
      healthCheck: jest.fn(),
      createOrder: jest.fn((req, res) => res.status(201).json({ success: true, orderId: 1 })),
      cancel: jest.fn()
    };

    const response = await request(createApp(controller as any))
      .post("/criar-ordens")
      .send({ userId: "user-001", symbol: "PETR4", type: "COMPRA", quantity: 1, price: 30 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, orderId: 1 });
    expect(controller.createOrder).toHaveBeenCalled();
  });

  it("should cancel an order through the endpoint", async () => {
    const controller = {
      healthCheck: jest.fn(),
      createOrder: jest.fn(),
      cancel: jest.fn((req, res) => res.json({ id: Number(req.params.id), status: "CANCELADA" }))
    };

    const response = await request(createApp(controller as any)).post("/orders/7/cancel");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 7, status: "CANCELADA" });
  });
});
