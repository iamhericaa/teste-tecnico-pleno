import { Quotation, QuotationSaverStrategy } from '../types';

export class CompositeQuotationSaver implements QuotationSaverStrategy {
  constructor(private savers: QuotationSaverStrategy[]) {}

  async save(quotation: Quotation): Promise<void> {
    for (const saver of this.savers) {
      await saver.save(quotation);
    }
  }
}
