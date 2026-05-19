import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { CreateOrderRequest } from "../types";
import { logger } from "../services/LoggerService";

/**
 * Controller para operações de ordens
 */
export class OrderController {
  private orderService: OrderService;


  constructor(orderService = new OrderService()) {
    this.orderService = orderService;
  }


  cancel = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = Number(req.params.id);

      logger.info(`OrderController.cancel - Cancelando ordem ID: ${orderId}`);

      if (isNaN(orderId)) {
        logger.error(`OrderController.cancel - ID inválido recebido: ${req.params.id}`);
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const order = await this.orderService.cancel(orderId);
      if (!order) {
        logger.info(`OrderController.cancel - Ordem não encontrada ID: ${orderId}`);
        res.status(404).json({ error: "Ordem não encontrada" });
        return;
      }

      logger.info(`OrderController.cancel - Ordem cancelada com sucesso ID: ${orderId}, Status anterior: ${order.status}`);

      res.json(order);
    } catch (error: any) {
      // logger.error(`OrderController.cancel - Erro ao cancelar ordem ID: ${orderId}`, error);
      res.status(400).json({ error: error.message || "Erro ao cancelar ordem" });
    }
  };


  /**
   * POST /criar-ordens
   * Cria uma nova ordem de investimento
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { userId, symbol, type, quantity, price } = req.body as CreateOrderRequest;

      // Validação básica dos campos obrigatórios
      if (!userId || !symbol || !type || !quantity || !price) {
        res.status(400).json({
          success: false,
          message: "Campos obrigatórios faltando: userId, symbol, type, quantity, price",
        });
        return;
      }

      // Validação do tipo
      if (type !== "COMPRA" && type !== "VENDA") {
        res.status(400).json({
          success: false,
          message: "Tipo de ordem inválido. Deve ser COMPRA ou VENDA",
        });
        return;
      }

      // Validação de quantidade e preço
      if (quantity <= 0 || price <= 0) {
        res.status(400).json({
          success: false,
          message: "Quantidade e preço devem ser positivos",
        });
        return;
      }

      logger.info(`[OrderController] Recebida requisição para criar ordem: ${type} ${quantity}x ${symbol} por R$ ${price} - Usuário: ${userId}`);

      // Chama o serviço para criar a ordem
      const result = await this.orderService.createOrder({
        userId,
        symbol,
        type,
        quantity,
        price,
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error(`[OrderController] Erro ao processar requisição de criação de ordem`, error);
      res.status(500).json({
        success: false,
        message: "Erro interno ao processar requisição",
        error: error.message,
      });
    }
  }

  /**
   * GET /health
   * Health check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
    });
  }
}
