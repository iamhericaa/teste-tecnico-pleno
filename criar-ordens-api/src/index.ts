import { createApp } from "./app";
import { logger } from "./services/LoggerService";

const PORT = process.env.PORT || 62001;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Servidor iniciado na porta ${PORT}`);
  logger.info(`Endpoint principal: POST http://localhost:${PORT}/criar-ordens`);
  logger.info(`Health check: GET http://localhost:${PORT}/health`);
});

process.on("SIGINT", async () => {
  logger.info("Recebido sinal de interrupcao. Encerrando servidor...");
  process.exit(0);
});
