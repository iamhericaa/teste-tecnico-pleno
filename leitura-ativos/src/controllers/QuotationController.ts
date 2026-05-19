import { Request, Response } from "express";
import { QuotationService } from "../services/QuotationService";
import { logger } from "../utils/Logger";

export class QuotationController {
  constructor(private readonly quotationService = new QuotationService()) {}

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info("QuotationController.list", "Listando cotações");

      const assets = await this.quotationService.list();

      logger.info("QuotationController.list", "Cotações listadas com sucesso", {
        count: assets.length,
      });

      res.json(assets);
    } catch (error) {
      logger.error("QuotationController.list", "Erro ao listar cotações", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = req.params.symbol;

      logger.info("QuotationController.get", "Buscando cotação", { symbol });

      const asset = await this.quotationService.getBySymbol(symbol);
      if (!asset) {
        logger.error("QuotationController.get", "Ativo não encontrado", { symbol });
        res.status(404).json({ error: "Ativo não encontrado" });
        return;
      }

      logger.info("QuotationController.get", "Cotação encontrada", {
        symbol,
        price: asset.reference_price,
      });

      res.json(asset);
    } catch (error) {
      logger.error("QuotationController.get", "Erro ao buscar cotação", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };
}
