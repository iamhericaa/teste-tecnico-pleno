import { handler } from "./index";
import { SQSEvent } from "aws-lambda";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const filePath = path.resolve(__dirname, "../../body-conteudo-sqs.json");

  if (!fs.existsSync(filePath)) {
    console.error(`Evento SQS de exemplo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const body = fs.readFileSync(filePath, "utf-8");
  const message = JSON.parse(body);

  const event: SQSEvent = {
    Records: [
      {
        messageId: "local-1",
        receiptHandle: "",
        body: JSON.stringify(message),
        attributes: {},
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:local:000000000000:orders-queue",
        awsRegion: process.env.AWS_REGION || "sa-east-1",
      },
    ],
  } as SQSEvent;

  try {
    await handler(event, {} as any);
    console.log("Invocação local concluída com sucesso");
  } catch (err) {
    console.error("Erro na invocação local:", err);
    process.exit(1);
  }
}

main();
