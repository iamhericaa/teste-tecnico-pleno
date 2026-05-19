import { prisma } from "../database/prisma";
import { logger } from "../utils/Logger";

export interface Position {
  id: number;
  user_id: string;
  symbol: string;
  quantity: number;
  average_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface PositionWithAsset extends Position {
  asset_name: string;
  current_price: number;
  profit_loss: number;
}

export class PositionService {
  async listByUser(userId: string): Promise<PositionWithAsset[]> {
    logger.info("PositionService.listByUser", "Listando posições do usuário", {
      userId,
    });

    const positions = await prisma.position.findMany({
      where: {
        userId,
        quantity: { gt: 0 },
      },
      include: {
        asset: {
          select: {
            name: true,
            referencePrice: true,
          },
        },
      },
    });

    const result = positions
      .map((position) => {
        const quantity = Number(position.quantity);
        const averagePrice = Number(position.averagePrice);
        const currentPrice = Number(position.asset.referencePrice);

        return {
          id: position.id,
          user_id: position.userId,
          symbol: position.symbol,
          quantity,
          average_price: averagePrice,
          created_at: position.createdAt,
          updated_at: position.updatedAt,
          asset_name: position.asset.name,
          current_price: currentPrice,
          profit_loss: quantity * (currentPrice - averagePrice),
        };
      })
      .sort((a, b) => b.quantity * b.current_price - a.quantity * a.current_price);

    logger.info("PositionService.listByUser", "Posições listadas com sucesso", {
      userId,
      count: result.length,
    });

    return result;
  }

  async getByUserAndSymbol(userId: string, symbol: string): Promise<Position | null> {
    logger.info("PositionService.getByUserAndSymbol", "Buscando posição", {
      userId,
      symbol,
    });

    const position = await prisma.position.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol,
        },
      },
    });

    if (!position) {
      logger.info("PositionService.getByUserAndSymbol", "Posição não encontrada", {
        userId,
        symbol,
      });
      return null;
    }

    logger.info("PositionService.getByUserAndSymbol", "Posição encontrada", {
      userId,
      symbol,
      quantity: Number(position.quantity),
    });

    return {
      id: position.id,
      user_id: position.userId,
      symbol: position.symbol,
      quantity: Number(position.quantity),
      average_price: Number(position.averagePrice),
      created_at: position.createdAt,
      updated_at: position.updatedAt,
    };
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
  }
}
