/**
 * Serviço de cotações - Mock para simular busca assíncrona de preços
 */
export class QuotationService {
  /**
   * Busca o preço atual do ativo de forma assíncrona
   * @param symbol - Símbolo do ativo
   * @returns Preço atual do ativo
   */
  async getPrice(symbol: string): Promise<number> {
    // Simula delay de rede para busca de cotação
    await this.delay(Math.random() * 500 + 100);

    // Mock de preços de ativos
    const mockPrices: Record<string, number> = {
      ITUB4: 32.80,
      ITUB3: 15.40,
      USDC: 5.50,
      SOL: 418.07,
      BTC: 350000.00,
      ETH: 18500.00,
      PETR4: 38.50,
      VALE3: 68.90,
    };

    const price = mockPrices[symbol];
    if (price === undefined) {
      throw new Error(`Ativo ${symbol} não encontrado`);
    }

    // Adiciona pequena variação aleatória para simular mercado real
    const variation = (Math.random() - 0.5) * 0.02; // ±1%
    return Math.round(price * (1 + variation) * 100) / 100;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}