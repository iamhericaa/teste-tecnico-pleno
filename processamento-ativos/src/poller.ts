/**
 * POLLER LOCAL (APENAS PARA EXECUÇÃO LOCAL)
 * --------------------------------------------------
 * Este arquivo implementa um poller simples que faz long-polling
 * em uma fila SQS (LocalStack) e invoca o `handler` Lambda para cada
 * mensagem recebida. NÃO use este poller em produção — ele existe
 * somente para facilitar integração local e testes end-to-end.
 */

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { handler } from "./index";
import { SQSEvent } from "aws-lambda";
import { logger } from "./services/LoggerService";

const queueName = process.env.SQS_QUEUE_NAME || "orders-queue";
const endpoint = process.env.SQS_ENDPOINT || "http://localstack:4566";
const region = process.env.AWS_REGION || "sa-east-1";

const sqsClient = new SQSClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "teste",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "teste",
  },
});

const queueUrl = `${endpoint}/000000000000/${queueName}`;

async function pollLoop() {
  logger.info("[Poller] Iniciando poller local para fila:", queueUrl);

  while (true) {
    try {
      const cmd = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
      });

      const res = await sqsClient.send(cmd);

      if (!res.Messages || res.Messages.length === 0) {
        continue; // volta ao loop de polling
      }

      for (const msg of res.Messages) {
        try {
          const event: SQSEvent = {
            Records: [
              {
                messageId: msg.MessageId || "",
                receiptHandle: msg.ReceiptHandle || "",
                body: msg.Body || "",
                attributes: {},
                messageAttributes: {},
                md5OfBody: msg.MD5OfBody || "",
                eventSource: "aws:sqs",
                eventSourceARN: `arn:aws:sqs:local:000000000000:${queueName}`,
                awsRegion: region,
              } as any,
            ],
          } as SQSEvent;

          logger.info(`[Poller] Invocando handler para mensagem ${msg.MessageId}`);
          await handler(event, {} as any);

          if (msg.ReceiptHandle) {
            await sqsClient.send(
              new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle })
            );
            logger.info(`[Poller] Mensagem ${msg.MessageId} deletada da fila`);
          }
        } catch (err) {
          logger.error("[Poller] Erro ao processar mensagem, não será deletada:", err);
          // Não deletar a mensagem — permitirá reprocessamento após VisibilityTimeout
        }
      }
    } catch (err) {
      logger.error("[Poller] Erro no receiveMessage:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

pollLoop().catch((err) => {
  logger.error("[Poller] Falha crítica:", err);
  process.exit(1);
});
