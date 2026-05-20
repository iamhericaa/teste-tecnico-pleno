import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/Logger";

type LatestQuotation = {
  symbol?: unknown;
  name?: unknown;
  price?: unknown;
  reference_price?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  timestamp?: unknown;
};

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

function parseDate(value: unknown): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  const date = new Date(String(value ?? 0));
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

export type RedisQuotation = {
  symbol: string;
  name: string;
  reference_price: number;
  created_at: Date;
  updated_at: Date;
};

export class RedisPriceClient {
  private readonly client: RedisClientType;
  private connected = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL ?? "redis://localhost:6379",
    });

    this.client.on("error", (error) => {
      logger.error("RedisPriceClient", "Erro no cliente Redis", error);
    });
  }

  async getPrice(symbol: string): Promise<number | null> {
    const quotation = await this.getQuotation(symbol);
    return quotation?.reference_price ?? null;
  }

  async getQuotation(symbol: string): Promise<RedisQuotation | null> {
    await this.connect();

    const latest = await this.client.get(`asset:${symbol}:latest`);
    if (latest) {
      const parsed = JSON.parse(latest) as LatestQuotation;
      const price = parsePrice(parsed.price ?? parsed.reference_price);
      if (price !== null) {
        const updatedAt = parseDate(parsed.updated_at ?? parsed.timestamp);
        return {
          symbol,
          name: typeof parsed.name === "string" ? parsed.name : "",
          reference_price: price,
          created_at: parseDate(parsed.created_at ?? updatedAt),
          updated_at: updatedAt,
        };
      }
    }

    const seededPrice = await this.client.get(`price:${symbol}`);
    const price = parsePrice(seededPrice);
    if (price === null) {
      return null;
    }

    return {
      symbol,
      name: "",
      reference_price: price,
      created_at: new Date(0),
      updated_at: new Date(0),
    };
  }

  async listQuotations(): Promise<RedisQuotation[]> {
    await this.connect();

    const latestKeys = await this.client.keys("asset:*:latest");
    const latestSymbols = latestKeys
      .map((key) => key.match(/^asset:(.+):latest$/)?.[1])
      .filter((symbol): symbol is string => Boolean(symbol));

    const latestQuotations = await Promise.all(
      latestSymbols.map((symbol) => this.getQuotation(symbol))
    );

    const quotations = latestQuotations.filter(
      (quotation): quotation is RedisQuotation => quotation !== null
    );

    const symbols = new Set(quotations.map((quotation) => quotation.symbol));
    const seededKeys = await this.client.keys("price:*");
    const seededSymbols = seededKeys.flatMap((key) => {
      const symbol = key.match(/^price:(.+)$/)?.[1];
      return symbol && !symbols.has(symbol) ? [symbol] : [];
    });

    const seededQuotations = await Promise.all(
      seededSymbols.map((symbol) => this.getQuotation(symbol))
    );

    return quotations
      .concat(seededQuotations.filter((quotation): quotation is RedisQuotation => quotation !== null))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client.disconnect();
    this.connected = false;
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await this.client.connect();
    this.connected = true;
  }
}

export const redisPriceClient = new RedisPriceClient();
