import { createApp } from "./app";
import { logger } from "./utils/Logger";

const port = 62000;
const app = createApp();

app.listen(port, () => {
  logger.info("Server", `Servidor iniciado na porta ${port}`, { port });
});
