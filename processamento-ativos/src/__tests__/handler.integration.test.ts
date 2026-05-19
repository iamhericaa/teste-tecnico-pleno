import { SQSEvent } from "aws-lambda";
import { createHandler } from "../index";

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

function sqsEvent(records: Array<{ body: string; messageId?: string }>): SQSEvent {
  return {
    Records: records.map((record) => ({
      messageId: record.messageId,
      receiptHandle: "",
      body: record.body,
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:local:000000000000:orders-queue",
      awsRegion: "sa-east-1"
    }))
  } as SQSEvent;
}

describe("Lambda handler", () => {
  it("should process every SQS record successfully", async () => {
    const service = {
      processOrder: jest.fn().mockResolvedValue(undefined)
    };
    const event = sqsEvent([
      { messageId: "msg-1", body: JSON.stringify({ orderId: 1 }) },
      { messageId: "msg-2", body: JSON.stringify({ orderId: 2 }) }
    ]);

    await expect(createHandler(service as any)(event, {} as any)).resolves.toBeUndefined();

    expect(service.processOrder).toHaveBeenCalledTimes(2);
    expect(service.processOrder).toHaveBeenNthCalledWith(1, { orderId: 1 });
    expect(service.processOrder).toHaveBeenNthCalledWith(2, { orderId: 2 });
  });

  it("should throw with failed message ids when a record cannot be processed", async () => {
    const service = {
      processOrder: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("processing failed"))
    };
    const event = sqsEvent([
      { messageId: "msg-1", body: JSON.stringify({ orderId: 1 }) },
      { messageId: "msg-2", body: JSON.stringify({ orderId: 2 }) }
    ]);

    await expect(createHandler(service as any)(event, {} as any)).rejects.toThrow("msg-2");
  });

  it("should use unknown when a failed record has no message id", async () => {
    const service = {
      processOrder: jest.fn().mockRejectedValue(new Error("bad json"))
    };
    const event = sqsEvent([{ body: "{not-json" }]);

    await expect(createHandler(service as any)(event, {} as any)).rejects.toThrow("unknown");
    expect(service.processOrder).not.toHaveBeenCalled();
  });
});
