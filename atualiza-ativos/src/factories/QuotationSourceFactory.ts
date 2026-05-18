import { HttpQuotationSourceStrategy } from '../strategies/HttpQuotationSourceStrategy';
import { QuotationSourceStrategy } from '../types';

export class QuotationSourceFactory {
  static create(type: 'http'): QuotationSourceStrategy {
    if (type === 'http') {
      return new HttpQuotationSourceStrategy();
    }
    throw new Error(`Unknown source strategy: ${type}`);
  }
}
