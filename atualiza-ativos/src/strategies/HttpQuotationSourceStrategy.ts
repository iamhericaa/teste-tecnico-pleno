import axios from 'axios';
import { Quotation, QuotationSourceStrategy } from '../types';
import { logger } from '../logger';

export class HttpQuotationSourceStrategy implements QuotationSourceStrategy {
  async fetch(symbol?: string): Promise<Quotation | Quotation[]> {
    const baseUrl = process.env.QUOTATIONS_URL ?? 'http://localhost:3001/quotations';
    const url = symbol ? `${baseUrl}/${symbol}` : baseUrl;
    const maxAttempts = Math.min(Number(process.env.RETRY_ATTEMPTS ?? '3'), 3);
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      const start = Date.now();

      try {
        const response = await axios.get<Quotation | Quotation[]>(url, {
          validateStatus: () => true,
          timeout: 10000
        });

        const duration = Date.now() - start;

        if (response.status === 502 && duration > 800) {
          const err = new Error('Quotes request canceled because 502 response took longer than 800ms');
          logger.error(err.message, { status: response.status, duration, url, symbol });
          throw err;
        }

        if (response.status === 503 || response.status === 504) {
          logger.info('Remote service unavailable, will retry if attempts remain', { status: response.status, attempt, url });
          if (attempt >= maxAttempts) {
            lastError = new Error(`Remote service returned ${response.status} after ${attempt} attempts`);
            logger.error(lastError.message, { status: response.status, attempt, url });
            break;
          }
          await this.delay(1000 * 2 ** (attempt - 1));
          continue;
        }

        if (response.status !== 200) {
          lastError = new Error(`Unexpected status ${response.status} from quote source`);
          logger.error(lastError.message, { status: response.status, url, symbol });
          break;
        }

        const payload = response.data;
        const normalized = this.normalizeResponse(payload);
        return normalized;
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          const axiosErr = error;
          const details = {
            message: axiosErr.message,
            code: axiosErr.code,
            status: axiosErr.response?.status,
            responseData: axiosErr.response?.data,
            config: axiosErr.config ? { url: axiosErr.config.url, method: axiosErr.config.method } : undefined,
            stack: axiosErr.stack
          };
          lastError = new Error(axiosErr.message || 'Axios request failed');
          logger.error('Axios error while fetching quotations', details);

          const isTimeout = axiosErr.code === 'ECONNABORTED' || axiosErr.message?.includes('timeout');
          if (isTimeout) {
            if (attempt < maxAttempts) {
              const backoff = 1000 * 2 ** (attempt - 1);
              logger.info('Timeout occurred, retrying with backoff', { attempt, retryAfterMs: backoff, url, symbol, maxAttempts });
              await this.delay(backoff);
              continue;
            }

            lastError = new Error(`Request timed out after ${attempt} attempts`);
            logger.error(lastError.message, { url, symbol });
            break;
          }
        } else {
          lastError = error instanceof Error ? error : new Error('Unknown fetch error');
          logger.error('Non-Axios fetch error', { message: lastError.message, stack: lastError.stack, url, symbol });
        }

        logger.error('Fetch error', { lastError });
        break;
      }
    }

    logger.error('Failed to fetch quotations after attempts', { lastError, url, symbol });
    throw lastError ?? new Error('Failed to fetch quotations');
  }

  private normalizeResponse(payload: any): Quotation | Quotation[] {
    if (payload && Array.isArray(payload.data)) {
      return payload.data.map((item: any) => this.normalizeQuotation(item, payload.timestamp));
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.normalizeQuotation(item));
    }

    return this.normalizeQuotation(payload);
  }

  private normalizeQuotation(item: any, timestamp?: string): Quotation {
    return {
      ...item,
      symbol: String(item?.symbol ?? '').trim(),
      price: Number(item?.price),
      name: String(item?.name ?? '').trim(),
      timestamp: item?.timestamp ?? timestamp ?? item?.updated_at
    };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
