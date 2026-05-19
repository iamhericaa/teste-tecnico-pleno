const mockSend = jest.fn();
const mockSQSClient = jest.fn(() => ({ send: mockSend }));
const mockSendMessageCommand = jest.fn((input) => ({ input }));

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: mockSQSClient,
  SendMessageCommand: mockSendMessageCommand
}));

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

import { SQSService } from "../services/SQSService";

describe("SQSService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AWS_REGION;
    delete process.env.SQS_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it("should create an SQS client using default LocalStack settings", () => {
    new SQSService();

    expect(mockSQSClient).toHaveBeenCalledWith({
      region: "sa-east-1",
      endpoint: "http://localhost:4566",
      credentials: {
        accessKeyId: "teste",
        secretAccessKey: "teste"
      }
    });
  });

  it("should send an order message to SQS", async () => {
    mockSend.mockResolvedValue({
      MessageId: "message-1",
      $metadata: { httpStatusCode: 200, totalRetryDelay: 0 }
    });

    await new SQSService("orders-test").sendMessage({
      id: 1,
      user_id: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 2,
      price: 30.5,
      status: "PENDENTE",
      created_at: new Date(),
      updated_at: new Date()
    });

    expect(mockSendMessageCommand).toHaveBeenCalledWith(expect.objectContaining({
      QueueUrl: "http://localhost:4566/000000000000/orders-test",
      MessageBody: expect.stringContaining('"orderId":1')
    }));
    expect(mockSend).toHaveBeenCalledWith({ input: expect.any(Object) });
  });

  it("should rethrow SQS send errors", async () => {
    mockSend.mockRejectedValue(new Error("sqs failed"));

    await expect(new SQSService("orders-test").sendMessage({
      id: 1,
      user_id: "user-001",
      symbol: "PETR4",
      type: "COMPRA",
      quantity: 2,
      price: 30.5,
      status: "PENDENTE",
      created_at: new Date(),
      updated_at: new Date()
    })).rejects.toThrow("sqs failed");
  });
});
