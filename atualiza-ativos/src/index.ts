import 'dotenv/config';
import { createApp, createProcessor } from './app';
import { logger } from './logger';

const processor = createProcessor();
const app = createApp(processor);

app.listen(Number(process.env.PORT ?? '62002'), async () => {
  logger.info(`Atualiza-ativos API running on http://localhost:${process.env.PORT ?? '62002'}`);
  logger.info('Background polling started: fetching all quotations every 1 second');

  const executePolling = async () => {
    try {
      const quotations = await processor.process();
      logger.info(`Background polling saved ${quotations.length} quotation(s)`);
    } catch (error: any) {
      logger.error('Background polling failed:', error.message ?? error);
    }
  };

  await executePolling();
  setInterval(executePolling, Number(process.env.POLL_INTERVAL_MS ?? '1000'));
});
