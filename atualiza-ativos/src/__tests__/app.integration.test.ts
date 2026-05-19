import request from 'supertest';
import { createApp, createProcessor } from '../app';
import { QuotationProcessor } from '../services/QuotationProcessor';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../factories/QuotationSourceFactory', () => ({
  QuotationSourceFactory: {
    create: jest.fn(() => ({ fetch: jest.fn() }))
  }
}));

jest.mock('../factories/QuotationSaverFactory', () => ({
  QuotationSaverFactory: {
    create: jest.fn(() => ({ save: jest.fn() }))
  }
}));

describe('Atualiza Ativos API', () => {
  it('should update all assets through the endpoint', async () => {
    const processor = {
      process: jest.fn().mockResolvedValue([
        { symbol: 'PETR4', price: 35.1 },
        { symbol: 'VALE3', price: 62.2 }
      ])
    } as unknown as QuotationProcessor;

    const response = await request(createApp(processor)).post('/assets');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 2, symbol: 'all' });
    expect(processor.process).toHaveBeenCalledWith(undefined);
  });

  it('should update one asset through the endpoint', async () => {
    const processor = {
      process: jest.fn().mockResolvedValue([{ symbol: 'ITUB4', price: 30 }])
    } as unknown as QuotationProcessor;

    const response = await request(createApp(processor)).post('/assets/ITUB4');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: 1, symbol: 'ITUB4' });
    expect(processor.process).toHaveBeenCalledWith('ITUB4');
  });

  it('should return an error response when the update fails', async () => {
    const processor = {
      process: jest.fn().mockRejectedValue(new Error('quotation service is down'))
    } as unknown as QuotationProcessor;

    const response = await request(createApp(processor)).post('/assets/PETR4');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'quotation service is down' });
  });

  it('should create the default processor from configured factories', () => {
    expect(createProcessor()).toBeInstanceOf(QuotationProcessor);
  });
});
