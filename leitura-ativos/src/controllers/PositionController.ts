import { Request, Response } from "express";
import { PositionService } from "../services/PositionService";
import { logger } from "../utils/Logger";

export class PositionController {
  constructor(private readonly positionService = new PositionService()) {}

  /**
   * GET /positions
   * Consultar posição do usuário em cada ativo (saldo)
   * Query: userId (obrigatório)
   */
  listByUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.query.userId as string;

      logger.info("PositionController.listByUser", "Listando posições do usuário", {
        userId,
      });

      if (!userId) {
        logger.error(
          "PositionController.listByUser",
          "userId é obrigatório"
        );
        res.status(400).json({ error: "userId é obrigatório" });
        return;
      }

      const positions = await this.positionService.listByUser(userId);


      res.json(positions);
    } catch (error) {
      logger.error("PositionController.listByUser", "Erro ao listar posições", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };
}
