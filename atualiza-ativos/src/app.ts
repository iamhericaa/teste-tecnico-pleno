import express from 'express';
import { QuotationProcessor } from './services/QuotationProcessor';
import { QuotationSaverFactory } from './factories/QuotationSaverFactory';
import { QuotationSourceFactory } from './factories/QuotationSourceFactory';
import { logger } from './logger';

export function createProcessor(): QuotationProcessor {
  const source = QuotationSourceFactory.create('http');
  const saver = QuotationSaverFactory.create('composite');
  return new QuotationProcessor(source, saver);
}

export function createApp(processor: QuotationProcessor = createProcessor()) {
  const app = express();

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

  return app;
}
