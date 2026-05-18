import { CompositeQuotationSaver } from '../strategies/CompositeQuotationSaver';
import { DbQuotationSaver } from '../strategies/DbQuotationSaver';
import { QuotationSaverStrategy } from '../types';
import { RedisQuotationSaver } from '../strategies/RedisQuotationSaver';

export class QuotationSaverFactory {
  static create(type: 'redis' | 'db' | 'composite'): QuotationSaverStrategy {
    if (type === 'redis') {
      return new RedisQuotationSaver();
    }

    if (type === 'db') {
      return new DbQuotationSaver();
    }

    if (type === 'composite') {
      return new CompositeQuotationSaver([new RedisQuotationSaver(), new DbQuotationSaver()]);
    }

    throw new Error(`Unknown saver strategy: ${type}`);
  }
}
