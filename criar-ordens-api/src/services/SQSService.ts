import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Order } from "../types";
import { logger } from "./LoggerService";

/**
 * Serviço SQS - Integração real com LocalStack
 */
export class SQSService {
  private sqsClient: SQSClient;
  private queueName: string;
  private queueUrl: string;

  constructor(queueName: string = process.env.SQS_QUEUE_NAME || "orders-queue") {
    this.queueName = queueName;
    
    // Configura cliente SQS para LocalStack
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "sa-east-1",
      endpoint: process.env.SQS_ENDPOINT || "http://localhost:4566",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "teste",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "teste",
      },
    });

    // Monta URL da fila padrão para LocalStack
    const endpoint = process.env.SQS_ENDPOINT || "http://localhost:4566";
    this.queueUrl = `${endpoint}/000000000000/${this.queueName}`;
  }

  /**
   * Envia uma mensagem para a fila SQS com os dados da ordem
   * @param order - Ordem criada
   */
  async sendMessage(order: Order): Promise<void> {
    const message = {
      orderId: order.id,
      userId: order.user_id,
      symbol: order.symbol,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      timestamp: new Date().toISOString(),
    };

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      });

      const response = await this.sqsClient.send(command);
      
      logger.info(`✅ [SQS] Mensagem enviada com sucesso! Fila: ${this.queueName}`);
      logger.debug(`MessageId: ${response.MessageId}`);
      logger.debug(`Status HTTP: ${response.$metadata.httpStatusCode}`);
      logger.debug(`Request ID: ${response.$metadata.requestId}`);
      logger.debug(`Latência: ${response.$metadata.totalRetryDelay}ms`);

    } catch (error) {
      logger.error(`❌ [SQS] Erro ao enviar mensagem para fila ${this.queueName}`, error);
      throw error;
    }
  }
}