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
    const quotesKey = `asset:${quotation.symbol}:quotes`;
    const latestKey = `asset:${quotation.symbol}:latest`;
    const payload = {
      ...quotation,
      updated_at: quotation.updated_at ?? new Date().toISOString()
    };

    logger.info(`[Redis] Salvando asset=${quotation.symbol} price=${quotation.price}`);

    await this.ensureSortedSet(quotesKey);
    await this.client.zAdd(quotesKey, [{
      score: Date.parse(String(quotation.timestamp ?? payload.updated_at)),
      value: JSON.stringify(payload),
    }]);

    await this.client.set(latestKey, JSON.stringify(payload));
    logger.info(`[Redis] Salvo asset=${quotation.symbol} price=${quotation.price} com sucesso.`);
  }

  private async ensureSortedSet(key: string): Promise<void> {
    const type = await this.client.type(key);
    if (type !== 'none' && type !== 'zset') {
      logger.info(`[Redis] Removendo chave ${key} com tipo incompatível (${type})`);
      await this.client.del(key);
    }
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect();
    this.connected = true;
  }
}
