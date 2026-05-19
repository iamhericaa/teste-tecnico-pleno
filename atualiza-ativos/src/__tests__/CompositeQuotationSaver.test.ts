import { CompositeQuotationSaver } from '../strategies/CompositeQuotationSaver';
import { QuotationSaverStrategy } from '../types';

describe('CompositeQuotationSaver', () => {
  it('should save the quotation using each configured saver in order', async () => {
    const first: jest.Mocked<QuotationSaverStrategy> = { save: jest.fn().mockResolvedValue(undefined) };
    const second: jest.Mocked<QuotationSaverStrategy> = { save: jest.fn().mockResolvedValue(undefined) };
    const quotation = { symbol: 'PETR4', price: 35.1 };

    await new CompositeQuotationSaver([first, second]).save(quotation);

    expect(first.save).toHaveBeenCalledWith(quotation);
    expect(second.save).toHaveBeenCalledWith(quotation);
    expect(first.save.mock.invocationCallOrder[0]).toBeLessThan(second.save.mock.invocationCallOrder[0]);
  });

  it('should stop saving when one saver fails', async () => {
    const first: jest.Mocked<QuotationSaverStrategy> = { save: jest.fn().mockRejectedValue(new Error('db down')) };
    const second: jest.Mocked<QuotationSaverStrategy> = { save: jest.fn() };

    await expect(new CompositeQuotationSaver([first, second]).save({ symbol: 'PETR4', price: 35.1 })).rejects.toThrow('db down');
    expect(second.save).not.toHaveBeenCalled();
  });
});
