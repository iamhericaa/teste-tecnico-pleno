import { prisma } from "../database/prisma";
import { logger } from "../utils/Logger";

export interface Asset {
  symbol: string;
  name: string;
  reference_price: number;
  created_at: Date;
  updated_at: Date;
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

export class QuotationService {
  async list(): Promise<Asset[]> {
    logger.info("QuotationService.list", "Listando todas as cotações");

    const assets = await prisma.asset.findMany({
      select: {
        symbol: true,
        name: true,
        referencePrice: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info("QuotationService.list", "Cotações listadas com sucesso", {
      count: assets.length,
    });

    return assets.map(mapAsset);
  }

  async getBySymbol(symbol: string): Promise<Asset | null> {
    logger.info("QuotationService.getBySymbol", "Buscando cotação por símbolo", {
      symbol,
    });

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
      logger.error("QuotationService.getBySymbol", "Ativo não encontrado", {
        symbol,
      });
      return null;
    }

    logger.info("QuotationService.getBySymbol", "Cotação encontrada", {
      symbol,
      price: Number(asset.referencePrice),
    });

    return mapAsset(asset);
  }

  async getPrice(symbol: string): Promise<number> {
    logger.info("QuotationService.getPrice", "Buscando preço do ativo", {
      symbol,
    });

    const asset = await this.getBySymbol(symbol);
    if (!asset) {
      logger.error("QuotationService.getPrice", "Ativo não encontrado para getPrice", {
        symbol,
      });
      throw new Error(`Ativo ${symbol} não encontrado`);
    }

    return asset.reference_price;
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
  }
}
