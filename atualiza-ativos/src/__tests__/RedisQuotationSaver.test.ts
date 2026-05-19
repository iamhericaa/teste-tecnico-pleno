const client = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  type: jest.fn().mockResolvedValue('none'),
  del: jest.fn().mockResolvedValue(1),
  zAdd: jest.fn().mockResolvedValue(1),
  set: jest.fn().mockResolvedValue('OK')
};

const createClient = jest.fn(() => client);

jest.mock('redis', () => ({
  createClient
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('RedisQuotationSaver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    client.type.mockResolvedValue('none');
    delete process.env.REDIS_URL;
  });

  it('should create a Redis client using the default URL', async () => {
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');

    new RedisQuotationSaver();

    expect(createClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should log Redis client errors', async () => {
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');
    const { logger } = require('../logger');

    new RedisQuotationSaver();
    const errorHandler = client.on.mock.calls[0][1];
    errorHandler(new Error('redis failed'));

    expect(logger.error).toHaveBeenCalledWith('Redis client error', expect.any(Error));
  });

  it('should store a quotation in the sorted set and latest key', async () => {
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');
    const saver = new RedisQuotationSaver();

    await saver.save({
      symbol: 'PETR4',
      price: 35.1,
      timestamp: '2026-05-18T10:00:00.000Z'
    });

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.type).toHaveBeenCalledWith('asset:PETR4:quotes');
    expect(client.zAdd).toHaveBeenCalledWith('asset:PETR4:quotes', [{
      score: Date.parse('2026-05-18T10:00:00.000Z'),
      value: expect.stringContaining('"symbol":"PETR4"')
    }]);
    expect(client.set).toHaveBeenCalledWith('asset:PETR4:latest', expect.stringContaining('"price":35.1'));
  });

  it('should not reconnect after the first save', async () => {
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');
    const saver = new RedisQuotationSaver();

    await saver.save({ symbol: 'PETR4', price: 35.1, updated_at: '2026-05-18T10:00:00.000Z' });
    await saver.save({ symbol: 'VALE3', price: 62.2, updated_at: '2026-05-18T10:01:00.000Z' });

    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it('should delete an incompatible quotes key before writing', async () => {
    client.type.mockResolvedValue('string');
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');

    await new RedisQuotationSaver().save({ symbol: 'ITUB4', price: 30 });

    expect(client.del).toHaveBeenCalledWith('asset:ITUB4:quotes');
  });

  it('should keep an existing sorted set key', async () => {
    client.type.mockResolvedValue('zset');
    const { RedisQuotationSaver } = require('../strategies/RedisQuotationSaver');

    await new RedisQuotationSaver().save({ symbol: 'BBDC4', price: 14 });

    expect(client.del).not.toHaveBeenCalled();
  });
});
