import { Order as PrismaOrder, Prisma } from "@prisma/client";
import { prisma } from "../database/prisma";
import { logger } from "../utils/Logger";
import { CreateOrderInput, Order, QuotationService } from "../types";

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const QUOTATION_MAX_RETRIES = numberFromEnv("QUOTATION_MAX_RETRIES", 3);
const QUOTATION_BASE_DELAY_MS = numberFromEnv("QUOTATION_BASE_DELAY_MS", 300);
const QUOTATION_MAX_AGE_SECONDS = numberFromEnv("QUOTATION_MAX_AGE_SECONDS", 10);
const PRICE_DIFFERENCE_TOLERANCE_PERCENT = numberFromEnv("PRICE_DIFFERENCE_TOLERANCE_PERCENT", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapOrder(order: PrismaOrder): Order {
  return {
    id: order.id,
    user_id: order.userId,
    symbol: order.symbol,
    type: order.type,
    quantity: Number(order.quantity),
    price: Number(order.price),
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

export class OrderService {
  constructor(private readonly quotationService: QuotationService) {}

  private async validateQuotationFreshness(
    symbol: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    logger.info("OrderService.validateQuotationFreshness", "Validando freshness da cotação", {
      symbol,
      maxAgeSeconds: QUOTATION_MAX_AGE_SECONDS,
    });

    const asset = await tx.asset.findUnique({
      where: { symbol },
      select: { updatedAt: true },
    });

    if (!asset) {
      throw new Error(`Ativo ${symbol} não encontrado`);
    }

    const now = new Date();
    const ageSeconds = (now.getTime() - asset.updatedAt.getTime()) / 1000;

    logger.info("OrderService.validateQuotationFreshness", "Idade da cotação", {
      symbol,
      ageSeconds: Math.round(ageSeconds),
      maxAgeSeconds: QUOTATION_MAX_AGE_SECONDS,
    });

    if (ageSeconds > QUOTATION_MAX_AGE_SECONDS) {
      throw new Error(
        `Cotação do ativo ${symbol} está desatualizada (${Math.round(ageSeconds)}s > ${QUOTATION_MAX_AGE_SECONDS}s). Rejeição solicitada.`
      );
    }
  }

  private async validatePriceDifference(
    symbol: string,
    requestedPrice: number,
    tx: Prisma.TransactionClient
  ): Promise<number> {
    logger.info("OrderService.validatePriceDifference", "Validando diferença de preço", {
      symbol,
      requestedPrice,
      tolerancePercent: PRICE_DIFFERENCE_TOLERANCE_PERCENT,
    });

    const asset = await tx.asset.findUnique({
      where: { symbol },
      select: { referencePrice: true },
    });

    if (!asset) {
      throw new Error(`Ativo ${symbol} não encontrado`);
    }

    const currentPrice = Number(asset.referencePrice);
    const priceDifference = Math.abs(currentPrice - requestedPrice) / currentPrice * 100;

    logger.info("OrderService.validatePriceDifference", "Diferença de preço calculada", {
      symbol,
      currentPrice,
      requestedPrice,
      differencePercent: Math.round(priceDifference * 100) / 100,
    });

    if (priceDifference > PRICE_DIFFERENCE_TOLERANCE_PERCENT) {
      throw new Error(
        `Diferença de preço ${Math.round(priceDifference * 100) / 100}% excede a tolerância de ${PRICE_DIFFERENCE_TOLERANCE_PERCENT}%. Rejeição solicitada.`
      );
    }

    return currentPrice;
  }

  private async fetchPriceWithResilience(symbol: string): Promise<number> {
    for (let attempt = 1; attempt <= QUOTATION_MAX_RETRIES; attempt++) {
      try {
        const price = await this.quotationService.getPrice(symbol);

        logger.info("OrderService.fetchPriceWithResilience", "Preço obtido", {
          symbol,
          price,
          attempt,
        });

        return price;
      } catch (err) {
        logger.error(
          "OrderService.fetchPriceWithResilience",
          `Tentativa ${attempt} falhou`,
          { symbol, err }
        );

        if (attempt < QUOTATION_MAX_RETRIES) {
          await sleep(QUOTATION_BASE_DELAY_MS * attempt);
        }
      }
    }

    logger.error(
      "OrderService.fetchPriceWithResilience",
      "Serviço de cotações indisponível e fallback no banco falhou",
      { symbol }
    );

    throw new Error(
      `Serviço de cotações indisponível para ${symbol} e fallback no banco falhou`
    );
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const { userId, symbol, type, quantity, price } = input;

    logger.info("OrderService.create", "Criando nova ordem", {
      userId,
      symbol,
      type,
      quantity,
      price,
    });

    const order = await prisma.$transaction(async (tx) => {
      if (type === "VENDA") {
        logger.info("OrderService.create", "Validando saldo para venda", {
          userId,
          symbol,
          quantity,
        });

        const position = await tx.position.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol,
            },
          },
          select: { quantity: true },
        });

        const currentQty = position ? Number(position.quantity) : 0;

        logger.info("OrderService.create", "Saldo verificado", {
          userId,
          symbol,
          currentQty,
          requestedQty: quantity,
        });

        if (currentQty < quantity) {
          logger.error("OrderService.create", "Saldo insuficiente", {
            userId,
            symbol,
            currentQty,
            requestedQty: quantity,
          });
          throw new Error("Saldo insuficiente para venda");
        }
      }

      return tx.order.create({
        data: {
          userId,
          symbol,
          type,
          quantity,
          price,
          status: "PENDENTE",
        },
      });
    });

    logger.info("OrderService.create", "Ordem criada com sucesso", {
      orderId: order.id,
      userId,
      symbol,
    });

    return mapOrder(order);
  }

  async listByUser(userId: string): Promise<Order[]> {
    logger.info("OrderService.listByUser", "Listando ordens do usuário", { userId });

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    logger.info("OrderService.listByUser", "Ordens listadas com sucesso", {
      userId,
      count: orders.length,
    });

    return orders.map(mapOrder);
  }

  async getById(orderId: number, tx?: Prisma.TransactionClient): Promise<Order | null> {
    logger.info("OrderService.getById", "Buscando ordem por ID", { orderId });

    const client = tx ?? prisma;
    const order = await client.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      logger.error("OrderService.getById", "Ordem não encontrada", { orderId });
      return null;
    }

    logger.info("OrderService.getById", "Ordem encontrada", {
      orderId,
      status: order.status,
    });

    return mapOrder(order);
  }

  async processOrder(orderId: number): Promise<Order> {
    logger.info("OrderService.processOrder", "Iniciando processamento da ordem", {
      orderId,
    });

    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new Error("Ordem não encontrada");
        }

        if (order.status !== "PENDENTE") {
          logger.error(
            "OrderService.processOrder",
            "Ordem não está em estado PENDENTE",
            { orderId, currentStatus: order.status }
          );
          throw new Error(`Ordem já foi processada (status: ${order.status})`);
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: "PROCESSANDO" },
        });

        await this.validateQuotationFreshness(order.symbol, tx);

        const currentPrice = await this.validatePriceDifference(
          order.symbol,
          Number(order.price),
          tx
        );

        logger.info("OrderService.processOrder", "Validações de cotação OK", {
          orderId,
          symbol: order.symbol,
          requestedPrice: Number(order.price),
          currentPrice,
        });

        const finalPrice = await this.fetchPriceWithResilience(order.symbol);

        logger.info("OrderService.processOrder", "Preço final obtido", {
          orderId,
          symbol: order.symbol,
          finalPrice,
        });

        if (order.type === "COMPRA") {
          logger.info("OrderService.processOrder", "Processando compra", {
            orderId,
            userId: order.userId,
            symbol: order.symbol,
            quantity: Number(order.quantity),
            finalPrice,
          });

          const existingPosition = await tx.position.findUnique({
            where: {
              userId_symbol: {
                userId: order.userId,
                symbol: order.symbol,
              },
            },
          });
          const orderQuantity = Number(order.quantity);

          if (existingPosition) {
            const currentQuantity = Number(existingPosition.quantity);
            const currentAveragePrice = Number(existingPosition.averagePrice);
            const newQuantity = currentQuantity + orderQuantity;
            const newAveragePrice =
              (currentAveragePrice * currentQuantity + finalPrice * orderQuantity) / newQuantity;

            await tx.position.update({
              where: {
                userId_symbol: {
                  userId: order.userId,
                  symbol: order.symbol,
                },
              },
              data: {
                quantity: newQuantity,
                averagePrice: newAveragePrice,
                totalValue: newQuantity * newAveragePrice,
              },
            });
          } else {
            await tx.position.create({
              data: {
                userId: order.userId,
                symbol: order.symbol,
                quantity: orderQuantity,
                averagePrice: finalPrice,
                totalValue: orderQuantity * finalPrice,
              },
            });
          }
        } else {
          const updateResult = await tx.position.updateMany({
            where: {
              userId: order.userId,
              symbol: order.symbol,
              quantity: {
                gte: order.quantity,
              },
            },
            data: {
              quantity: {
                decrement: order.quantity,
              },
            },
          });

          const requestedQty = Number(order.quantity);

          if (updateResult.count === 0) {
            logger.error(
              "OrderService.processOrder",
              "Saldo insuficiente na execução, ordem rejeitada",
              { orderId, requestedQty }
            );
            throw new Error("Saldo insuficiente para executar a venda");
          }

          logger.info("OrderService.processOrder", "Processando venda", {
            orderId,
            userId: order.userId,
            symbol: order.symbol,
            quantity: requestedQty,
            finalPrice,
          });
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: "EXECUTADA" },
        });
      });

      logger.info("OrderService.processOrder", "Ordem executada com sucesso", {
        orderId,
      });

      const order = await this.getById(orderId);
      if (!order) {
        throw new Error("Ordem não encontrada após processamento");
      }

      return order;
    } catch (error) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { status: "REJEITADA" },
        });
      } catch (innerErr) {
        logger.error(
          "OrderService.processOrder",
          "Falha ao marcar ordem como REJEITADA",
          innerErr
        );
      }

      logger.error(
        "OrderService.processOrder",
        "Erro durante processamento, ordem marcada como REJEITADA",
        error
      );

      throw error;
    }
  }

  async close(): Promise<void> {
    await prisma.$disconnect();
  }
}
