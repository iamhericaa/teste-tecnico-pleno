import { QuotationProcessor } from '../services/QuotationProcessor';
import { QuotationSaverStrategy, QuotationSourceStrategy } from '../types';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('QuotationProcessor', () => {
  let source: jest.Mocked<QuotationSourceStrategy>;
  let saver: jest.Mocked<QuotationSaverStrategy>;

  beforeEach(() => {
    source = {
      fetch: jest.fn()
    };
    saver = {
      save: jest.fn().mockResolvedValue(undefined)
    };
  });

  it('should save every valid quotation returned by the source', async () => {
    source.fetch.mockResolvedValue([
      { symbol: 'PETR4', price: 35.1 },
      { symbol: 'VALE3', price: 62.2 }
    ]);

    const processor = new QuotationProcessor(source, saver);

    const result = await processor.process();

    expect(result).toEqual([
      { symbol: 'PETR4', price: 35.1 },
      { symbol: 'VALE3', price: 62.2 }
    ]);
    expect(source.fetch).toHaveBeenCalledWith(undefined);
    expect(saver.save).toHaveBeenNthCalledWith(1, { symbol: 'PETR4', price: 35.1 });
    expect(saver.save).toHaveBeenNthCalledWith(2, { symbol: 'VALE3', price: 62.2 });
  });

  it('should wrap a single quotation response before saving it', async () => {
    source.fetch.mockResolvedValue({ symbol: 'ITUB4', price: 30 });

    const processor = new QuotationProcessor(source, saver);

    await expect(processor.process('ITUB4')).resolves.toEqual([{ symbol: 'ITUB4', price: 30 }]);
    expect(source.fetch).toHaveBeenCalledWith('ITUB4');
    expect(saver.save).toHaveBeenCalledTimes(1);
  });

  it('should ignore invalid quotations during a full refresh', async () => {
    source.fetch.mockResolvedValue([
      { symbol: 'BBDC4', price: 14 },
      { symbol: '', price: 20 },
      { symbol: 'ABEV3', price: null as any },
      undefined as any
    ]);

    const processor = new QuotationProcessor(source, saver);

    await expect(processor.process()).resolves.toEqual([{ symbol: 'BBDC4', price: 14 }]);
    expect(saver.save).toHaveBeenCalledTimes(1);
  });

  it('should return an empty list when a full refresh has no valid quotations', async () => {
    source.fetch.mockResolvedValue([{ symbol: ' ', price: 20 }]);

    const processor = new QuotationProcessor(source, saver);

    await expect(processor.process()).resolves.toEqual([]);
    expect(saver.save).not.toHaveBeenCalled();
  });

  it('should fail when a single-symbol refresh has no valid quotation', async () => {
    source.fetch.mockResolvedValue({ symbol: '', price: undefined as any });

    const processor = new QuotationProcessor(source, saver);

    await expect(processor.process('MISSING')).rejects.toThrow('Response invalido ou ausente');
    expect(saver.save).not.toHaveBeenCalled();
  });
});
