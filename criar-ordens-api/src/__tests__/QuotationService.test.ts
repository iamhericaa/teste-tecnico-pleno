const mockPrisma = {
  asset: {
    findUnique: jest.fn()
  }
};

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock("../services/LoggerService", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { QuotationService } from "../services/QuotationService";

describe("QuotationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the reference price for an existing asset", async () => {
    mockPrisma.asset.findUnique.mockResolvedValue({
      symbol: "PETR4",
      name: "Petrobras",
      referencePrice: { toFixed: () => "35.10", valueOf: () => 35.1 }
    });

    await expect(new QuotationService().getPrice("PETR4")).resolves.toBe(35.1);
    expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
      where: { symbol: "PETR4" },
      select: { symbol: true, name: true, referencePrice: true }
    });
  });

  it("should fail when the asset does not exist", async () => {
    mockPrisma.asset.findUnique.mockResolvedValue(null);

    await expect(new QuotationService().getPrice("XXXX")).rejects.toThrow("Ativo XXXX");
  });
});
