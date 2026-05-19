import mysql from 'mysql2/promise';
import { Quotation, QuotationSaverStrategy } from '../types';
import { logger } from '../logger';

export class DbQuotationSaver implements QuotationSaverStrategy {
  private pool = mysql.createPool({
    host: process.env.DB_HOST ?? 'mysql',
    port: Number(process.env.DB_PORT ?? '3306'),
    user: process.env.DB_USER ?? 'app_user',
    password: process.env.DB_PASSWORD ?? 'app_password',
    database: process.env.DB_NAME ?? 'investment_orders',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? '10'),
    queueLimit: 0,
    decimalNumbers: true
  });

  async save(quotation: Quotation): Promise<void> {
    if (!quotation.symbol || quotation.price == null) {
      throw new Error('Cotação precisa ter um symbol e um price');
    }

    logger.info(`Salvando asset=${quotation.symbol} price=${quotation.price}`);

    const query = `
      INSERT INTO assets (symbol, name, reference_price, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        reference_price = VALUES(reference_price),
        updated_at = NOW()
    `;


    try {
      const [result] = await this.pool.execute(query, [
        quotation.symbol,
        quotation.name ?? null,
        quotation.price,
      ]) as [mysql.ResultSetHeader, any];

      logger.info(`[DB]Salvo asset=${quotation.symbol} price=${quotation.price} com sucesso.`, {
        affectedRows: result.affectedRows,
        changedRows: result.changedRows,
      });
    } catch (error) {
      logger.error(`[DB]Falha ao salvar asset=${quotation.symbol} price=${quotation.price}`, error);
      throw error;
    }
  }
}
