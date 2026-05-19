import { PrismaClient } from "@prisma/client";
import { logger } from "./LoggerService";

const prisma = new PrismaClient();

/**
 * Serviço de cotações - Busca preços de referência no banco de dados
 */
export class QuotationService {
  /**
   * Busca o preço atual do ativo de forma assíncrona
   * @param symbol - Símbolo do ativo
   * @returns Preço atual do ativo
   */
  async getPrice(symbol: string): Promise<number> {
    const asset = await prisma.asset.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        name: true,
        referencePrice: true,
      },
    });

    if (!asset) {
      throw new Error(`Ativo ${symbol} não encontrado`);
    }
    
    logger.info(`[QuotationService] Preço obtido para ${symbol}: R$ ${asset.referencePrice.toFixed(2)}`);

    return Number(asset.referencePrice);
  }
}
