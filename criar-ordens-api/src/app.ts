import express, { Request, Response } from "express";
import { OrderController } from "./controllers/OrderController";
import { logger } from "./services/LoggerService";

export function createApp(orderController = new OrderController()) {
  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  app.use((req: Request, res: Response, next) => {
    logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });

  app.get("/health", (req, res) => orderController.healthCheck(req, res));
  app.post("/criar-ordens", (req, res) => orderController.createOrder(req, res));
  app.post("/orders/:id/cancel", orderController.cancel);

  return app;
}
