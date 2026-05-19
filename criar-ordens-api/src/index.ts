import express, { Request, Response } from "express";
import { OrderController } from "./controllers/OrderController";
import { logger } from "./services/LoggerService";

const app = express();
const PORT = process.env.PORT || 62001;

// Middleware
app.use(express.json());

// Logging middleware
app.use((req: Request, res: Response, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Controller
const orderController = new OrderController();

// Routes
app.get("/health", (req, res) => orderController.healthCheck(req, res));
app.post("/criar-ordens", (req, res) => orderController.createOrder(req, res));
// POST /orders/:id/cancel - Cancelar uma ordem pendente
app.post("/orders/:id/cancel", orderController.cancel);


// Start server
app.listen(PORT, () => {
  logger.info(`Servidor iniciado na porta ${PORT}`);
  logger.info(`Endpoint principal: POST http://localhost:${PORT}/criar-ordens`);
  logger.info(`Health check: GET http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Recebido sinal de interrupção. Encerrando servidor...");
  process.exit(0);
});
