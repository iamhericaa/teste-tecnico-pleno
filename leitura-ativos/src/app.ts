import express, { json } from "express";
import { QuotationController } from "./controllers/QuotationController";
import { OrderController } from "./controllers/OrderController";
import { PositionController } from "./controllers/PositionController";
import { logger } from "./utils/Logger";

export function createApp(
  quotationController = new QuotationController(),
  orderController = new OrderController(),
  positionController = new PositionController()
) {
  const app = express();

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  app.use(json());

  app.use((req, res, next) => {
    logger.info("HTTP", `[${req.method}] ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
    });
    next();
  });

  app.get("/quotations", quotationController.list);
  app.get("/quotations/:symbol", quotationController.get);
  app.get("/orders", orderController.listByUser);
  app.get("/orders/:id", orderController.get);
  app.get("/positions", positionController.listByUser);
  app.get("/", (req, res) => {
    logger.info("HTTP", "Health check realizado");
    res.send("API de Investimentos funcionando!");
  });

  return app;
}
