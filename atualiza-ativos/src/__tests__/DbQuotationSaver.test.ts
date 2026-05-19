const execute = jest.fn();
const createPool = jest.fn(() => ({ execute }));

jest.mock('mysql2/promise', () => ({
  createPool
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('DbQuotationSaver', () => {
  beforeEach(() => {
    jest.resetModules();
    execute.mockReset();
    createPool.mockClear();
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_CONNECTION_LIMIT;
  });

  it('should create a pool using default connection settings', async () => {
    const { DbQuotationSaver } = require('../strategies/DbQuotationSaver');

    new DbQuotationSaver();

    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'mysql',
      port: 3306,
      user: 'app_user',
      password: 'app_password',
      database: 'investment_orders',
      connectionLimit: 10
    }));
  });

  it('should insert or update a valid quotation', async () => {
    execute.mockResolvedValue([{ affectedRows: 1, changedRows: 0 }, undefined]);
    const { DbQuotationSaver } = require('../strategies/DbQuotationSaver');

    await new DbQuotationSaver().save({ symbol: 'PETR4', name: 'Petrobras', price: 35.1 });

    expect(execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO assets'), [
      'PETR4',
      'Petrobras',
      35.1
    ]);
  });

  it('should store null when the quotation has no name', async () => {
    execute.mockResolvedValue([{ affectedRows: 1, changedRows: 0 }, undefined]);
    const { DbQuotationSaver } = require('../strategies/DbQuotationSaver');

    await new DbQuotationSaver().save({ symbol: 'VALE3', price: 62.2 });

    expect(execute).toHaveBeenCalledWith(expect.any(String), ['VALE3', null, 62.2]);
  });

  it('should fail when symbol or price is missing', async () => {
    const { DbQuotationSaver } = require('../strategies/DbQuotationSaver');

    await expect(new DbQuotationSaver().save({ symbol: '', price: 10 })).rejects.toThrow('symbol e um price');
    await expect(new DbQuotationSaver().save({ symbol: 'PETR4', price: null as any })).rejects.toThrow('symbol e um price');
    expect(execute).not.toHaveBeenCalled();
  });

  it('should rethrow database errors', async () => {
    execute.mockRejectedValue(new Error('database failed'));
    const { DbQuotationSaver } = require('../strategies/DbQuotationSaver');

    await expect(new DbQuotationSaver().save({ symbol: 'PETR4', price: 35.1 })).rejects.toThrow('database failed');
  });
});
