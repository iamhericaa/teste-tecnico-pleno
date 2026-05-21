import { Request, Response } from "express";
import { QuotationService } from "../services/QuotationService";
import { logger } from "../utils/Logger";

function parsePositiveInteger(value: unknown, defaultValue: number): number {
  const parsedValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(parsedValue);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return parsed;
}

export class QuotationController {
  constructor(private readonly quotationService = new QuotationService()) {}

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parsePositiveInteger(req.query.page, 1);
      const perPage = parsePositiveInteger(req.query.per_page ?? req.query.perPage, 10);

      logger.info("QuotationController.list", "Listando cotacoes", {
        page,
        perPage,
      });

      const assets = await this.quotationService.list({ page, perPage });

      logger.info("QuotationController.list", "Cotacoes listadas com sucesso", {
        count: assets.data.length,
        total: assets.pagination.total,
      });

      res.json(assets);
    } catch (error) {
      logger.error("QuotationController.list", "Erro ao listar cotacoes", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };

  get = async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = req.params.symbol;

      logger.info("QuotationController.get", "Buscando cotacao", { symbol });

      const asset = await this.quotationService.getBySymbol(symbol);
      if (!asset) {
        logger.error("QuotationController.get", "Ativo nao encontrado", { symbol });
        res.status(404).json({ error: "Ativo não encontrado" });
        return;
      }

      logger.info("QuotationController.get", "Cotacao encontrada", {
        symbol,
        price: asset.reference_price,
      });

      res.json(asset);
    } catch (error) {
      logger.error("QuotationController.get", "Erro ao buscar cotacao", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  };
}
