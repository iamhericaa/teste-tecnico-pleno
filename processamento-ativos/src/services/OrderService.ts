import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "./LoggerService";
import { SQSMessage } from "../types";

const prisma = new PrismaClient();
const MAX_TRANSACTION_RETRIES = 3;

type ProcessableOrder = {
  orderId: number;
  userId: string;
  symbol: string;
  type: "COMPRA" | "VENDA";
  quantity: number;
  price: number;
};

/**
 * Servico de processamento de ordens recebidas via SQS.
 */
export class OrderService {
  async processOrder(message: SQSMessage): Promise<void> {
    const { orderId, userId, symbol, type, quantity, price, status } = message;

    logger.info(
      `[OrderService] Processando ordem ID: ${orderId}, Status: ${status}`
    );

    try {
      if (status !== "PENDENTE" && status !== "CANCELADA") {
        logger.warn(
          `[OrderService] Status invalido na mensagem: ${status}. Ignorando.`
        );
        return;
      }

      if (status === "CANCELADA") {
        logger.info(
          `[OrderService] Cancelando ordem ID: ${orderId}, User: ${userId}`
        );
        await this.cancelPendingOrder(orderId);
        return;
      }

      logger.info(`[OrderService] Processando ordem PENDENTE ID: ${orderId}`);

      try {
        const processed = await this.processPendingOrderWithRetry({
          orderId,
          userId,
          symbol,
          type,
          quantity,
          price,
        });

        if (!processed) {
          logger.info(
            `[OrderService] Ordem ID: ${orderId} ja foi capturada/processada. Ignorando mensagem duplicada.`
          );
        }
      } catch (processingError: any) {
        logger.error(
          `[OrderService] Erro ao processar ordem ID: ${orderId}`,
          processingError
        );

        try {
          await this.safeUpdateOrderStatus(orderId, "REJEITADA");
          logger.error(`[OrderService] Ordem ID: ${orderId} marcada como REJEITADA`);
        } catch (updateError) {
          logger.error(
            `[OrderService] Erro ao atualizar ordem para REJEITADA`,
            updateError
          );
        }

        throw processingError;
      }
    } catch (error: any) {
      logger.error(`[OrderService] Erro nao tratado ao processar ordem`, error);
      throw error;
    }
  }

  private async processPendingOrderWithRetry(order: ProcessableOrder): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await this.processPendingOrder(order);
      } catch (error) {
        if (attempt < MAX_TRANSACTION_RETRIES && this.isRetryableTransactionError(error)) {
          logger.warn(
            `[OrderService] Conflito transacional na ordem ID: ${order.orderId}. Tentativa ${attempt}/${MAX_TRANSACTION_RETRIES}`
          );
          continue;
        }

        throw error;
      }
    }

    return false;
  }

  private async processPendingOrder(order: ProcessableOrder): Promise<boolean> {
    return prisma.$transaction(
      async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: order.orderId,
            status: "PENDENTE",
          },
          data: { status: "PROCESSANDO" },
        });

        if (claimed.count === 0) {
          return false;
        }

        logger.info(
          `[OrderService] Status atualizado para PROCESSANDO - Ordem ID: ${order.orderId}`
        );

        await this.updatePosition(
          tx,
          order.userId,
          order.symbol,
          order.quantity,
          order.price,
          order.type
        );

        await tx.order.update({
          where: { id: order.orderId },
          data: { status: "EXECUTADA" },
        });

        logger.info(`[OrderService] Ordem ID: ${order.orderId} EXECUTADA com sucesso`);

        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private async cancelPendingOrder(orderId: number): Promise<boolean> {
    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: {
          in: ["PENDENTE", "PROCESSANDO"],
        },
      },
      data: { status: "CANCELADA" },
    });

    if (updated.count === 0) {
      logger.warn(
        `[OrderService] Ordem ID: ${orderId} nao encontrada ou nao cancelavel. Ignorando cancelamento.`
      );
      return false;
    }

    logger.info(`[OrderService] Ordem ID: ${orderId} cancelada com sucesso`);
    return true;
  }

  private isRetryableTransactionError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }

  private async safeUpdateOrderStatus(orderId: number, status: string): Promise<boolean> {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: status as any },
      });
      return true;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        logger.warn(
          `[OrderService] Ordem ID: ${orderId} nao encontrada ao atualizar status para ${status}.`
        );
        return false;
      }
      throw err;
    }
  }

  private async updatePosition(
    tx: Prisma.TransactionClient,
    userId: string,
    symbol: string,
    quantity: number,
    price: number,
    type: "COMPRA" | "VENDA"
  ): Promise<void> {
    logger.info(
      `[PositionService] Atualizando posicao - User: ${userId}, Symbol: ${symbol}, Quantity: ${quantity}, Price: ${price}, Type: ${type}`
    );

    if (type === "VENDA") {
      const updated = await tx.position.updateMany({
        where: {
          userId,
          symbol,
          quantity: {
            gte: quantity,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      if (updated.count === 0) {
        throw new Error(`Saldo insuficiente do ativo ${symbol} para venda. Solicitado: ${quantity}`);
      }

      logger.info(`[PositionService] Venda aplicada - Qtd decrementada: ${quantity}`);
      return;
    }

    const reservedAsset = await tx.asset.updateMany({
      where: {
        symbol,
        quantity: {
          gte: quantity,
        },
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    });

    if (reservedAsset.count === 0) {
      throw new Error(`Quantidade indisponivel do ativo ${symbol} para compra. Solicitado: ${quantity}`);
    }

    const position = await tx.position.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol,
        },
      },
    });

    if (position) {
      const currentQuantity = Number(position.quantity);
      const currentAveragePrice = Number(position.averagePrice);
      const totalCost = currentQuantity * currentAveragePrice + quantity * price;
      const newQuantity = currentQuantity + quantity;
      const newAveragePrice = totalCost / newQuantity;
      const newTotalValue = newQuantity * newAveragePrice;

      await tx.position.update({
        where: {
          userId_symbol: {
            userId,
            symbol,
          },
        },
        data: {
          quantity: newQuantity,
          averagePrice: newAveragePrice,
          totalValue: newTotalValue,
        },
      });

      logger.info(
        `[PositionService] Posicao atualizada - Qtd: ${newQuantity}, Preco Medio: ${newAveragePrice}, Total: ${newTotalValue}`
      );
      return;
    }

    await tx.position.create({
      data: {
        userId,
        symbol,
        quantity,
        averagePrice: price,
        totalValue: quantity * price,
      },
    });

    logger.info(
      `[PositionService] Nova posicao criada - Qtd: ${quantity}, Preco: ${price}, Total: ${quantity * price}`
    );
  }
}
