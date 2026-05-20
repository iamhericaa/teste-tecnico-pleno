import 'dotenv/config';
import { createApp, createProcessor } from './app';
import { logger } from './logger';

const redisProcessor = createProcessor('redis');
const dbProcessor = createProcessor('db');
const manualProcessor = createProcessor('composite');
const app = createApp(manualProcessor);

const redisPollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? '1000');
const dbPollIntervalMs = Number(process.env.DB_POLL_INTERVAL_MS ?? '10000');

app.listen(Number(process.env.PORT ?? '62002'), async () => {
  logger.info(`Atualiza-ativos API running on http://localhost:${process.env.PORT ?? '62002'}`);
  logger.info(`Redis polling started: saving quotations every ${redisPollIntervalMs}ms`);
  logger.info(`Database polling started: saving quotations every ${dbPollIntervalMs}ms`);

  const executeRedisPolling = async () => {
    try {
      const quotations = await redisProcessor.process();
      logger.info(`Redis polling saved ${quotations.length} quotation(s)`);
    } catch (error: any) {
      logger.error('Redis polling failed:', error.message ?? error);
    }
  };

  const executeDbPolling = async () => {
    try {
      const quotations = await dbProcessor.process();
      logger.info(`Database polling saved ${quotations.length} quotation(s)`);
    } catch (error: any) {
      logger.error('Database polling failed:', error.message ?? error);
    }
  };

  await executeRedisPolling();
  await executeDbPolling();

  setInterval(executeRedisPolling, redisPollIntervalMs);
  setInterval(executeDbPolling, dbPollIntervalMs);
});
