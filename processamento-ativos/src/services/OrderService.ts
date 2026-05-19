import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "./LoggerService";
import { SQSMessage } from "../types";

const prisma = new PrismaClient();

/**
 * Serviço de processamento de ordens
 */
export class OrderService {
  /**
   * Processa uma ordem recebida do SQS
   * - Se PENDENTE: atualiza status para PROCESSANDO, processa posição e finaliza
   * - Se CANCELADA: apenas atualiza status para CANCELADA
   */
  async processOrder(message: SQSMessage): Promise<void> {
    const { orderId, userId, symbol, type, quantity, price, status } = message;

    logger.info(
      `[OrderService] Processando ordem ID: ${orderId}, Status: ${status}`
    );

    try {
      // Valida status da mensagem
      if (status !== "PENDENTE" && status !== "CANCELADA") {
        logger.warn(
          `[OrderService] Status inválido na mensagem: ${status}. Ignorando.`
        );
        return;
      }

      // Verifica se a ordem existe antes de tentar atualizar
      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existingOrder) {
        logger.warn(
          `[OrderService] Ordem ID: ${orderId} não encontrada. Ignorando mensagem.`
        );
        return;
      }

      // Se status é CANCELADA
      if (status === "CANCELADA") {
        logger.info(
          `[OrderService] Cancelando ordem ID: ${orderId}, User: ${userId}`
        );
        await this.safeUpdateOrderStatus(orderId, "CANCELADA");
        logger.info(`[OrderService] Ordem ID: ${orderId} cancelada com sucesso`);
        return;
      }

      // Se status é PENDENTE
      if (status === "PENDENTE") {
        logger.info(
          `[OrderService] Processando ordem PENDENTE ID: ${orderId}`
        );

        try {
          // 1. Atualiza status para PROCESSANDO
          await this.safeUpdateOrderStatus(orderId, "PROCESSANDO");
          logger.info(
            `[OrderService] Status atualizado para PROCESSANDO - Ordem ID: ${orderId}`
          );

          // 2. Processa a posição do cliente
          logger.info(
            `[OrderService] Iniciando processamento de posição para usuário: ${userId}, symbol: ${symbol}`
          );
          await this.updatePosition(userId, symbol, quantity, price, type);

          // 3. Se tudo deu certo, atualiza status para EXECUTADA
          await this.safeUpdateOrderStatus(orderId, "EXECUTADA");
          logger.info(
            `[OrderService] Ordem ID: ${orderId} EXECUTADA com sucesso`
          );
        } catch (processingError: any) {
          logger.error(
            `[OrderService] Erro ao processar ordem ID: ${orderId}`,
            processingError
          );

          // Atualiza status para REJEITADA em caso de erro
          try {
            await this.safeUpdateOrderStatus(orderId, "REJEITADA");
            logger.error(
              `[OrderService] Ordem ID: ${orderId} marcada como REJEITADA`
            );
          } catch (updateError) {
            logger.error(
              `[OrderService] Erro ao atualizar ordem para REJEITADA`,
              updateError
            );
          }

          throw processingError;
        }
      }
    } catch (error: any) {
      logger.error(`[OrderService] Erro não tratado ao processar ordem`, error);
      throw error;
    }
  }

  private async safeUpdateOrderStatus(orderId: number, status: string): Promise<boolean> {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: status as any },
      });
      return true;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        logger.warn(
          `[OrderService] Ordem ID: ${orderId} não encontrada ao atualizar status para ${status}.` 
        );
        return false;
      }
      throw err;
    }
  }

  /**
   * Atualiza a posição do cliente
   * - Seleciona posição atual (ou cria se não existir)
   * - Calcula nova quantidade e preço médio
   * - Faz update/insert da posição
   */
  private async updatePosition(
    userId: string,
    symbol: string,
    quantity: number,
    price: number,
    type: "COMPRA" | "VENDA"
  ): Promise<void> {
    logger.info(
      `[PositionService] Atualizando posição - User: ${userId}, Symbol: ${symbol}, Quantity: ${quantity}, Price: ${price}, Type: ${type}`
    );

    try {
      // Busca posição atual
      let position = await prisma.position.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol,
          },
        },
      });

      let newQuantity = 0;
      let newAveragePrice = 0;
      let newTotalValue = 0;

      if (position) {
        // Posição já existe
        const currentQuantity = parseFloat(position.quantity.toString());
        const currentAveragePrice = parseFloat(
          position.averagePrice.toString()
        );
        const currentTotalValue = parseFloat(position.totalValue.toString());

        logger.info(
          `[PositionService] Posição atual - Qtd: ${currentQuantity}, Preço Médio: ${currentAveragePrice}, Total: ${currentTotalValue}`
        );

        if (type === "COMPRA") {
          // Compra: soma quantidade e recalcula preço médio
          const totalCost =
            currentQuantity * currentAveragePrice + quantity * price;
          newQuantity = currentQuantity + quantity;
          newAveragePrice = totalCost / newQuantity;
          newTotalValue = newQuantity * newAveragePrice;
        } else {
          // Venda: reduz quantidade
          newQuantity = currentQuantity - quantity;
          if (newQuantity < 0) {
            throw new Error(
              `Saldo insuficiente do ativo ${symbol} para venda. Posição: ${currentQuantity}, Solicitado: ${quantity}`
            );
          }
          // Preço médio continua o mesmo
          newAveragePrice = currentAveragePrice;
          newTotalValue = newQuantity * newAveragePrice;
        }

        // Atualiza posição
        await prisma.position.update({
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
          `[PositionService] Posição atualizada - Qtd: ${newQuantity}, Preço Médio: ${newAveragePrice}, Total: ${newTotalValue}`
        );
      } else {
        // Cria nova posição (só para COMPRA)
        if (type === "VENDA") {
          throw new Error(
            `Não existe posição do ativo ${symbol} para o usuário ${userId}`
          );
        }

        newQuantity = quantity;
        newAveragePrice = price;
        newTotalValue = quantity * price;

        await prisma.position.create({
          data: {
            userId,
            symbol,
            quantity: newQuantity,
            averagePrice: newAveragePrice,
            totalValue: newTotalValue,
          },
        });

        logger.info(
          `[PositionService] Nova posição criada - Qtd: ${newQuantity}, Preço: ${newAveragePrice}, Total: ${newTotalValue}`
        );
      }
    } catch (error: any) {
      logger.error(`[PositionService] Erro ao atualizar posição`, error);
      throw error;
    }
  }
}
