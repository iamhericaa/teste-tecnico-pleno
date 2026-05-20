import { PrismaClient } from "@prisma/client";
import { CreateOrderRequest, Order, OrderStatus, UserBalance } from "../types";
import { BalanceService } from "./BalanceService";
import { SQSService } from "./SQSService";
import { logger} from "./LoggerService";

const prisma = new PrismaClient();

/**
 * Serviço de ordens - Gerencia criação e validação de ordens
 */
export class OrderService {
  private balanceService: BalanceService;
  private sqsService: SQSService;

  constructor() {
    this.balanceService = new BalanceService();
    this.sqsService = new SQSService(process.env.SQS_QUEUE_NAME);
  }

  /**
   * Cria uma nova ordem de forma assíncrona
   * Fluxo:
   * 1. Busca saldo do usuário
   * 2. Valida tipo da ordem e saldo
   * 3. Cria ordem no banco (PENDENTE ou REJEITADA)
   * 4. Envia mensagem para SQS se ordem foi criada com sucesso
   */
  async createOrder(request: CreateOrderRequest): Promise<{ success: boolean; message: string; orderId?: number; status?: OrderStatus }> {
    const { userId, symbol, type, quantity, price } = request;

    logger.info(`[OrderService] Iniciando criação de ordem:`, { userId, symbol, type, quantity, price });

    try {
      // 1. Busca saldo do usuário de forma assíncrona
      logger.info(`[OrderService] Buscando saldo para usuário ${userId}...`);
      const balance = await this.balanceService.getUserBalance(userId);
      logger.info(`[OrderService] Saldo obtido:`, balance);

      // 2. Valida tipo da ordem e saldo
      const validationResult = await this.validateOrder(symbol, type, quantity, price, balance);

      if (!validationResult.valid) {
        logger.info(`[OrderService] Validação falhou: ${validationResult.message}`);
        return this.createRejectedOrder(request, validationResult.message);
      }

      // 3. Cria ordem no banco de dados usando Prisma
      const order = await prisma.order.create({
        data: {
          userId,
          symbol,
          type,
          quantity,
          price,
          status: "PENDENTE" as const,
        },
      });

      logger.info(`[OrderService] Ordem criada com sucesso: ID ${order.id}`);

      // 4. Envia mensagem para SQS de forma assíncrona
      logger.info(`[OrderService] Enviando mensagem para SQS...`);
      await this.sqsService.sendMessage({
        id: order.id,
        user_id: order.userId,
        symbol: order.symbol,
        type: order.type,
        quantity: parseFloat(order.quantity.toString()),
        price: parseFloat(order.price.toString()),
        status: order.status as OrderStatus,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      });
      logger.info(`[OrderService] Mensagem enviada para SQS com sucesso`);

      return {
        success: true,
        message: "Ordem criada com sucesso",
        orderId: order.id,
        status: order.status as OrderStatus,
      };
    } catch (error: any) {
      logger.error(`[OrderService] Erro ao criar ordem:`, error);

      // Se o erro for de ativo não encontrado, retorna mensagem específica
      if (error.message.includes("não encontrado")) {
        return {
          success: false,
          message: error.message,
          status: "REJEITADA",
        };
      }

      // Caso contrário, marca como REJEITADA
      return {
        success: false,
        message: `Erro ao processar ordem: ${error.message}`,
        status: "REJEITADA",
      };
    }
  }

  private async createRejectedOrder(
    request: CreateOrderRequest,
    message: string
  ): Promise<{ success: boolean; message: string; orderId?: number; status?: OrderStatus }> {
    await this.ensureUserExists(request.userId);

    const order = await prisma.order.create({
      data: {
        userId: request.userId,
        symbol: request.symbol,
        type: request.type,
        quantity: request.quantity,
        price: request.price,
        status: "REJEITADA" as const,
      },
    });

    logger.info(`[OrderService] Ordem rejeitada salva no banco: ID ${order.id}`);

    return {
      success: false,
      message,
      orderId: order.id,
      status: "REJEITADA",
    };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        name: userId,
      },
    });
  }

  /**
   * Valida a ordem com base no tipo e saldo do usuário
   * Utiliza o preço recebido no payload sem validação contra cotação
   */
  private async validateOrder(
    symbol: string,
    type: "COMPRA" | "VENDA",
    quantity: number,
    price: number,
    balance: UserBalance
  ): Promise<{ valid: boolean; message: string }> {
    // Valida campos básicos
    if (quantity <= 0 || price <= 0) {
      return {
        valid: false,
        message: "Quantidade e preço devem ser positivos",
      };
    }

    const totalValue = quantity * price;

    if (type === "COMPRA") {
      // Valida se usuário tem saldo suficiente em dinheiro para compra
      if (balance.cash < totalValue) {
        return {
          valid: false,
          message: `Saldo insuficiente para compra. Necessário: R$ ${totalValue.toFixed(2)}`,
        };
      }

      logger.info(`[OrderService] Validação de compra aprovada. Saldo: R$ ${balance.cash.toFixed(2)}, Necessário: R$ ${totalValue.toFixed(2)}`);
    } else if (type === "VENDA") {
      // Valida se usuário tem saldo suficiente do ativo para venda
      const assetQuantity = balance.assets[symbol] || 0;
      if (assetQuantity < quantity) {
        return {
          valid: false,
          message: `Saldo insuficiente do ativo ${symbol} para venda. Necessário: ${quantity}`,
        };
      }

      console.log(`[OrderService] Validação de venda aprovada. Saldo do ativo: ${assetQuantity}, Necessário: ${quantity}`);
    } else {
      return {
        valid: false,
        message: "Tipo de ordem inválido. Deve ser COMPRA ou VENDA",
      };
    }

    return {
      valid: true,
      message: "Ordem validada com sucesso",
    };
  }

  
  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  async getById(orderId: number): Promise<Order | null> {
    logger.info("OrderService.getById", "Buscando ordem por ID", { orderId });

    const order = await prisma.order.findUnique({
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

    // Map Prisma order to local Order type if necessary
    return order as unknown as Order;
  }


  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------
  async cancel(orderId: number): Promise<Order | null> {
    logger.info("OrderService.cancel", "Cancelando ordem", { orderId });

    const order = await this.getById(orderId);

    if (!order) {
      logger.error("OrderService.cancel", "Ordem não encontrada", { orderId });
      return null;
    }

    if (order.status !== "PENDENTE") {
      logger.error(
        "OrderService.cancel",
        "Não é possível cancelar ordem com status diferente de PENDENTE",
        { orderId, currentStatus: order.status }
      );
      throw new Error(`Não é possível cancelar ordem com status ${order.status}`);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELADA" },
    });

    logger.info("OrderService.cancel", "Ordem cancelada com sucesso", { orderId });

    return this.getById(orderId);
  }


  /**
   * Fecha conexão com banco de dados
   */
  async close(): Promise<void> {
    await prisma.$disconnect();
  }
}
