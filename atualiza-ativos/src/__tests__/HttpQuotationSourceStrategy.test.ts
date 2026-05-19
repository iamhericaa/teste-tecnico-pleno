import axios from 'axios';
import { HttpQuotationSourceStrategy } from '../strategies/HttpQuotationSourceStrategy';

jest.mock('axios');
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HttpQuotationSourceStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.QUOTATIONS_URL;
    delete process.env.RETRY_ATTEMPTS;
    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  it('should fetch and normalize all quotations from a data envelope', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        timestamp: '2026-05-18T10:00:00.000Z',
        data: [{ symbol: ' PETR4 ', price: '35.10', name: ' Petrobras ' }]
      }
    });

    await expect(new HttpQuotationSourceStrategy().fetch()).resolves.toEqual([
      {
        symbol: 'PETR4',
        price: 35.1,
        name: 'Petrobras',
        timestamp: '2026-05-18T10:00:00.000Z'
      }
    ]);
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:3001/quotations', expect.objectContaining({
      timeout: 10000,
      validateStatus: expect.any(Function)
    }));
  });

  it('should fetch and normalize a single symbol from a custom URL', async () => {
    process.env.QUOTATIONS_URL = 'http://quotes.test/quotations';
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: { symbol: ' VALE3 ', price: '62.20', updated_at: '2026-05-18T10:00:00.000Z' }
    });

    await expect(new HttpQuotationSourceStrategy().fetch('VALE3')).resolves.toEqual({
      symbol: 'VALE3',
      price: 62.2,
      name: '',
      timestamp: '2026-05-18T10:00:00.000Z',
      updated_at: '2026-05-18T10:00:00.000Z'
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('http://quotes.test/quotations/VALE3', expect.any(Object));
  });

  it('should normalize array payloads', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: [{ symbol: 'ITUB4', price: 30 }]
    });

    await expect(new HttpQuotationSourceStrategy().fetch()).resolves.toEqual([
      { symbol: 'ITUB4', price: 30, name: '', timestamp: undefined }
    ]);
  });

  it('should retry unavailable responses before succeeding', async () => {
    process.env.RETRY_ATTEMPTS = '10';
    mockedAxios.get
      .mockResolvedValueOnce({ status: 503, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { symbol: 'BBDC4', price: 14 } });
    const strategy = new HttpQuotationSourceStrategy();
    jest.spyOn(strategy as any, 'delay').mockResolvedValue(undefined);

    await expect(strategy.fetch()).resolves.toEqual({ symbol: 'BBDC4', price: 14, name: '', timestamp: undefined });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect((strategy as any).delay).toHaveBeenCalledWith(1000);
  });

  it('should fail after retrying unavailable responses', async () => {
    process.env.RETRY_ATTEMPTS = '2';
    mockedAxios.get.mockResolvedValue({ status: 504, data: {} });
    const strategy = new HttpQuotationSourceStrategy();
    jest.spyOn(strategy as any, 'delay').mockResolvedValue(undefined);

    await expect(strategy.fetch()).rejects.toThrow(/504.*2 tentativas/);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should fail fast for unexpected statuses', async () => {
    mockedAxios.get.mockResolvedValue({ status: 404, data: {} });

    await expect(new HttpQuotationSourceStrategy().fetch('XXXX')).rejects.toThrow('Status inesperado 404');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should fail when a slow 502 response is received', async () => {
    mockedAxios.get.mockResolvedValue({ status: 502, data: {} });
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1901);

    await expect(new HttpQuotationSourceStrategy().fetch()).rejects.toThrow('Request cancelada');
  });

  it('should retry axios timeout errors and then fail', async () => {
    process.env.RETRY_ATTEMPTS = '2';
    const timeoutError = Object.assign(new Error('timeout of 10000ms exceeded'), {
      code: 'ECONNABORTED',
      config: { url: 'http://localhost:3001/quotations', method: 'get' }
    });
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue(timeoutError);
    const strategy = new HttpQuotationSourceStrategy();
    jest.spyOn(strategy as any, 'delay').mockResolvedValue(undefined);

    await expect(strategy.fetch()).rejects.toThrow('Request timed out after 2 attempts');
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should fail with an axios non-timeout error', async () => {
    const axiosError = Object.assign(new Error('network failed'), {
      code: 'ECONNRESET',
      response: { status: 500, data: { error: 'down' } },
      config: { url: 'http://localhost:3001/quotations', method: 'get' }
    });
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValue(axiosError);

    await expect(new HttpQuotationSourceStrategy().fetch()).rejects.toThrow('network failed');
  });

  it('should fail with a generic fetch error', async () => {
    mockedAxios.get.mockRejectedValue(new Error('boom'));

    await expect(new HttpQuotationSourceStrategy().fetch()).rejects.toThrow('boom');
  });

  it('should resolve the delay helper', async () => {
    await expect((new HttpQuotationSourceStrategy() as any).delay(0)).resolves.toBeUndefined();
  });
});
