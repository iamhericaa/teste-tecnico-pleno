import { SQSEvent, Context } from "aws-lambda";
import { OrderService } from "./services/OrderService";
import { logger } from "./services/LoggerService";

type ProcessOrderService = Pick<OrderService, "processOrder">;

export function createHandler(orderService: ProcessOrderService) {
  return async (
    event: SQSEvent,
    _context: Context
  ): Promise<void> => {
    logger.info("[Lambda] Evento SQS recebido", {
      recordCount: event.Records.length,
    });

    const failedRecords: string[] = [];

    for (const record of event.Records) {
      try {
        const payload = JSON.parse(record.body);
        logger.info(`[Lambda] Processando ordem ${payload.orderId}`);
        await orderService.processOrder(payload);
        logger.info(`[Lambda] Ordem ${payload.orderId} processada com sucesso`);
      } catch (error: any) {
        logger.error("[Lambda] Erro ao processar registro SQS", error);
        failedRecords.push(record.messageId || "unknown");
      }
    }

    if (failedRecords.length > 0) {
      throw new Error(
        `[Lambda] Falha ao processar ${failedRecords.length} registro(s): ${failedRecords.join(", ")}`
      );
    }
  };
}

const orderService = new OrderService();

export const handler = createHandler(orderService);
