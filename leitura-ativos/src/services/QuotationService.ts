import { prisma } from "../database/prisma";
import { RedisQuotation, redisPriceClient, RedisPriceClient } from "../database/redis";
import { logger } from "../utils/Logger";

export interface Asset {
  symbol: string;
  name: string;
  reference_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface PaginatedAssets {
  data: Asset[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

type PrismaAsset = {
  symbol: string;
  name: string;
  referencePrice: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function mapAsset(asset: PrismaAsset): Asset {
  return {
    symbol: asset.symbol,
    name: asset.name,
    reference_price: Number(asset.referencePrice),
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
  };
}

function mapRedisQuotation(asset: RedisQuotation): Asset {
  return { ...asset };
}

function paginateAssets(assets: Asset[], pagination: PaginationParams): PaginatedAssets {
  const total = assets.length;
  const totalPages = Math.ceil(total / pagination.perPage);
  const start = (pagination.page - 1) * pagination.perPage;

  return {
    data: assets.slice(start, start + pagination.perPage),
    pagination: {
      page: pagination.page,
      per_page: pagination.perPage,
      total,
      total_pages: totalPages,
    },
  };
}

export class QuotationService {
  constructor(
    private readonly redisClient: Pick<
      RedisPriceClient,
      "getPrice" | "getQuotation" | "listQuotations" | "close"
    > = redisPriceClient
  ) {}

  async list(pagination: PaginationParams = { page: 1, perPage: 10 }): Promise<PaginatedAssets> {
    logger.info("QuotationService.list", "Listando cotacoes pelo Redis");

    try {
      const assets = await this.redisClient.listQuotations();

      logger.info("QuotationService.list", "Cotacoes listadas pelo Redis com sucesso", {
        count: assets.length,
      });

      return paginateAssets(assets.map(mapRedisQuotation), pagination);
    } catch (error) {
      logger.error("QuotationService.list", "Falha ao consultar Redis; usando banco", error);
      return this.listFromDatabase(pagination);
    }
  }

  async getBySymbol(symbol: string): Promise<Asset | null> {
    logger.info("QuotationService.getBySymbol", "Buscando cotacao por simbolo no Redis", {
      symbol,
    });

    try {
      const asset = await this.redisClient.getQuotation(symbol);
      if (!asset) {
        logger.error("QuotationService.getBySymbol", "Ativo nao encontrado no Redis", {
          symbol,
        });
        return null;
      }

      logger.info("QuotationService.getBySymbol", "Cotacao encontrada no Redis", {
        symbol,
        price: asset.reference_price,
      });

      return mapRedisQuotation(asset);
    } catch (error) {
      logger.error("QuotationService.getBySymbol", "Falha ao consultar Redis; usando banco", {
        symbol,
        error,
      });
      return this.getBySymbolFromDatabase(symbol);
    }
  }

  async getPrice(symbol: string): Promise<number> {
    logger.info("QuotationService.getPrice", "Buscando preco do ativo no Redis", {
      symbol,
    });

    try {
      const redisPrice = await this.redisClient.getPrice(symbol);
      if (redisPrice !== null) {
        logger.info("QuotationService.getPrice", "Preco encontrado no Redis", {
          symbol,
          price: redisPrice,
        });
        return redisPrice;
      }
    } catch (error) {
      logger.error("QuotationService.getPrice", "Falha ao consultar Redis; usando banco", {
        symbol,
        error,
      });

      const asset = await this.getBySymbolFromDatabase(symbol);
      if (!asset) {
        logger.error("QuotationService.getPrice", "Ativo nao encontrado para getPrice", {
          symbol,
        });
        throw new Error(`Ativo ${symbol} nao encontrado`);
      }

      return asset.reference_price;
    }

    logger.error("QuotationService.getPrice", "Preco nao encontrado no Redis", {
      symbol,
    });
    throw new Error(`Ativo ${symbol} nao encontrado`);
  }

  async close(): Promise<void> {
    await this.redisClient.close();
    await prisma.$disconnect();
  }

  private async listFromDatabase(pagination: PaginationParams): Promise<PaginatedAssets> {
    const assets = await prisma.asset.findMany({
      select: {
        symbol: true,
        name: true,
        referencePrice: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        symbol: "asc",
      },
    });

    logger.info("QuotationService.listFromDatabase", "Cotacoes listadas pelo banco com sucesso", {
      count: assets.length,
    });

    return paginateAssets(assets.map(mapAsset), pagination);
  }

  private async getBySymbolFromDatabase(symbol: string): Promise<Asset | null> {
    const asset = await prisma.asset.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        name: true,
        referencePrice: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!asset) {
      logger.error("QuotationService.getBySymbolFromDatabase", "Ativo nao encontrado", {
        symbol,
      });
      return null;
    }

    const mappedAsset = mapAsset(asset);

    logger.info("QuotationService.getBySymbolFromDatabase", "Cotacao encontrada no banco", {
      symbol,
      price: mappedAsset.reference_price,
    });

    return mappedAsset;
  }
}
