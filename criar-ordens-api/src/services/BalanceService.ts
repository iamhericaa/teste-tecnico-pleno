import { UserBalance } from "../types";

/**
 * Serviço de saldos - Mock para simular busca de saldo do usuário
 */
export class BalanceService {
  /**
   * Busca o saldo do usuário de forma assíncrona
   * @param userId - ID do usuário
   * @returns Saldo do usuário (dinheiro e ativos)
   */
  async getUserBalance(userId: string): Promise<UserBalance> {
    // Simula delay de rede para busca de saldo
    await this.delay(Math.random() * 300 + 100);

    // Mock de saldos por usuário
    const mockBalances: Record<string, UserBalance> = {
      "user-001": {
        userId: "user-001",
        cash: 10000.0, // R$ 10.000,00 de saldo em dinheiro
        assets: {
          ITUB4: 100,
          USDC: 50,
          PETR4: 200,
        },
      },
      "user-002": {
        userId: "user-002",
        cash: 5000.0, // R$ 5.000,00 de saldo em dinheiro
        assets: {
          BTC: 0.1,
          ETH: 2.5,
        },
      },
      "user-003": {
        userId: "user-003",
        cash: 500.0, // R$ 500,00 de saldo em dinheiro (saldo baixo)
        assets: {
          VALE3: 10,
        },
      },
    };

    const balance = mockBalances[userId];
    if (!balance) {
      // Usuário não encontrado, retorna saldo zerado
      return {
        userId,
        cash: 0,
        assets: {},
      };
    }

    return balance;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}