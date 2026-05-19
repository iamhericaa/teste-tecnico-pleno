import { BalanceService } from "../services/BalanceService";

describe("BalanceService", () => {
  beforeEach(() => {
    jest.spyOn(BalanceService.prototype as any, "delay").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return the configured balance for a known user", async () => {
    await expect(new BalanceService().getUserBalance("user-001")).resolves.toEqual({
      userId: "user-001",
      cash: 10000,
      assets: {
        ITUB4: 100,
        USDC: 50,
        PETR4: 200
      }
    });
  });

  it("should return an empty balance for an unknown user", async () => {
    await expect(new BalanceService().getUserBalance("missing-user")).resolves.toEqual({
      userId: "missing-user",
      cash: 0,
      assets: {}
    });
  });

  it("should resolve the delay helper", async () => {
    jest.restoreAllMocks();
    await expect((new BalanceService() as any).delay(0)).resolves.toBeUndefined();
  });
});
