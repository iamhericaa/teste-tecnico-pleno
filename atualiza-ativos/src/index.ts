import 'dotenv/config';
import express from 'express';
import { QuotationProcessor } from './services/QuotationProcessor';
import { QuotationSaverFactory } from './factories/QuotationSaverFactory';
import { QuotationSourceFactory } from './factories/QuotationSourceFactory';
import { logger } from './logger';

const app = express();
const source = QuotationSourceFactory.create('http');
const saver = QuotationSaverFactory.create('composite');
const processor = new QuotationProcessor(source, saver);

app.post('/assets/:symbol?', async (req, res) => {
  const symbol = req.params.symbol?.trim() || undefined;
  logger.info(`Received manual update request: ${symbol ?? 'all assets'}`);

  try {
    const quotations = await processor.process(symbol);
    logger.info(
      symbol
        ? `Manual update completed for symbol ${symbol} (${quotations.length} quotation(s))`
        : `Manual full refresh completed (${quotations.length} quotation(s))`
    );

    return res.status(200).json({ updated: quotations.length, symbol: symbol ?? 'all' });
  } catch (error: any) {
    logger.error(`Manual update failed for ${symbol ?? 'all assets'}:`, error.message ?? error);
    return res.status(500).json({ error: error.message ?? 'Failed to update asset' });
  }
});

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
