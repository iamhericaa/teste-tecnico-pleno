import { createClient, RedisClientType } from 'redis';
import { Quotation, QuotationSaverStrategy } from '../types';
import { logger } from '../logger';

export class RedisQuotationSaver implements QuotationSaverStrategy {
  private client: RedisClientType;
  private connected = false;

  constructor() {
    this.client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
    this.client.on('error', (error) => {
      logger.error('Redis client error', error);
    });
  }

  async save(quotation: Quotation): Promise<void> {
    await this.connect();
    const key = `asset:${quotation.symbol}:quotes`;
    const payload = {
      ...quotation,
      updated_at: quotation.updated_at ?? new Date().toISOString()
    };
    await this.client.zAdd(key, [{
      score: Date.parse(quotation.timestamp),
      value: JSON.stringify(payload),
    }]);

    logger.info(`[Redis] Salvando asset=${quotation.symbol} price=${quotation.price}`);
    await this.client.set(key, JSON.stringify(payload));
    logger.info(`[Redis] Salvo asset=${quotation.symbol} price=${quotation.price} com sucesso.`);
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect();
    this.connected = true;
  }
}
