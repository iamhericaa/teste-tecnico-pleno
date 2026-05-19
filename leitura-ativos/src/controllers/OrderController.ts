import { Request, Response } from "express";
import { OrderService } from "../services/OrderService";
import { logger } from "../utils/Logger";
import { QuotationService } from "../services/QuotationService";

export class OrderController {
  constructor(
    private readonly orderService = new OrderService(new QuotationService())
  ) {}

  listByUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.query.userId as string;

      logger.info("OrderController.listByUser", "Listando ordens do usuário", {
        userId,
      });

      if (!userId) {
        logger.error("OrderController.listByUser", "userId é obrigatório");
        res.status(400).json({ error: "userId é obrigatório" });
        return;
      }

      const orders = await this.orderService.listByUser(userId);

      logger.info("OrderController.listByUser", "Ordens listadas com sucesso", {
        userId,
        count: orders.length,
      });

      res.json(orders);
    } catch (error: any) {
      logger.error("OrderController.listByUser", "Erro ao listar ordens", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    try {
      const orderId = Number(req.params.id);

      logger.info("OrderController.get", "Buscando detalhe da ordem", {
        orderId,
      });

      if (isNaN(orderId)) {
        logger.error("OrderController.get", "ID inválido", { orderId: req.params.id });
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const order = await this.orderService.getById(orderId);
      if (!order) {
        logger.error("OrderController.get", "Ordem não encontrada", { orderId });
        res.status(404).json({ error: "Ordem não encontrada" });
        return;
      }


      res.json(order);
    } catch (error: any) {
      logger.error("OrderController.get", "Erro ao buscar ordem", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };


}
