import { QuotationSaverFactory } from '../factories/QuotationSaverFactory';
import { QuotationSourceFactory } from '../factories/QuotationSourceFactory';
import { CompositeQuotationSaver } from '../strategies/CompositeQuotationSaver';
import { DbQuotationSaver } from '../strategies/DbQuotationSaver';
import { HttpQuotationSourceStrategy } from '../strategies/HttpQuotationSourceStrategy';
import { RedisQuotationSaver } from '../strategies/RedisQuotationSaver';

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    type: jest.fn(),
    del: jest.fn(),
    zAdd: jest.fn(),
    set: jest.fn()
  }))
}));

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    execute: jest.fn()
  }))
}));

describe('QuotationSourceFactory', () => {
  it('should create an HTTP quotation source', () => {
    expect(QuotationSourceFactory.create('http')).toBeInstanceOf(HttpQuotationSourceStrategy);
  });

  it('should fail for an unknown source strategy', () => {
    expect(() => QuotationSourceFactory.create('queue' as any)).toThrow('Unknown source strategy: queue');
  });
});

describe('QuotationSaverFactory', () => {
  it('should create a Redis quotation saver', () => {
    expect(QuotationSaverFactory.create('redis')).toBeInstanceOf(RedisQuotationSaver);
  });

  it('should create a database quotation saver', () => {
    expect(QuotationSaverFactory.create('db')).toBeInstanceOf(DbQuotationSaver);
  });

  it('should create a composite quotation saver', () => {
    expect(QuotationSaverFactory.create('composite')).toBeInstanceOf(CompositeQuotationSaver);
  });

  it('should fail for an unknown saver strategy', () => {
    expect(() => QuotationSaverFactory.create('file' as any)).toThrow('Unknown saver strategy: file');
  });
});
