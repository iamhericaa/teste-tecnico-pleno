import { Quotation, QuotationSaverStrategy, QuotationSourceStrategy } from '../types';
import { logger } from '../logger';

export class QuotationProcessor {
  constructor(
    private sourceStrategy: QuotationSourceStrategy,
    private saverStrategy: QuotationSaverStrategy
  ) { }

  async process(symbol?: string): Promise<Quotation[]> {
    logger.info(`Buscando ${symbol ? `single-symbol (${symbol})` : 'todos os ativos'} no serviço de cotação...`);
    const result = await this.sourceStrategy.fetch(symbol);
    logger.info(`Resultado da busca: ${JSON.stringify(result)}`);
    const quotations = Array.isArray(result) ? result : [result];
    logger.info(`Total de cotações recebidas: ${quotations.length}`);
    const validQuotations = quotations.filter(this.isValidQuotation);

    if (validQuotations.length === 0) {
      if (symbol) {
        throw new Error(`Response invalido ou ausente para o símbolo ${symbol}`);
      }

      logger.info('Nenhuma cotação válida encontrada para atualização');
      return [];
    }

    for (const quotation of validQuotations) {
      logger.info(`Processando cotação: ${JSON.stringify(quotation)}`);
      logger.info(`Salvando asset=${quotation.symbol} price=${quotation.price}`);
      await this.saverStrategy.save(quotation);
    }

    const savedSymbols = validQuotations.map((q) => q.symbol).join(', ');
    logger.info(`Cotações salvas com sucesso! ${savedSymbols}`);

    return validQuotations;
  }

  private isValidQuotation(quotation: Quotation): boolean {
    return Boolean(
      quotation &&
      typeof quotation.symbol === 'string' &&
      quotation.symbol.trim().length > 0 &&
      quotation.price != null
    );
  }
}
