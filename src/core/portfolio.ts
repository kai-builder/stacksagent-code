import { PortfolioSummary, Transaction, DefiPosition } from '../types/index.js';
import { WalletService } from './wallet.js';
import { PriceService } from './price.js';
import { StacksApiClient } from './stacks-api.js';
import { StackingService } from './stacking.js';

export class PortfolioService {
  private walletService: WalletService;
  private priceService: PriceService;
  private apiClient: StacksApiClient;
  private stackingService: StackingService;
  private defaultNetwork: 'mainnet' | 'testnet';

  constructor(
    walletService: WalletService,
    network: 'mainnet' | 'testnet' = 'mainnet'
  ) {
    this.walletService = walletService;
    this.priceService = new PriceService();
    this.apiClient = new StacksApiClient(network);
    this.stackingService = new StackingService(network);
    this.defaultNetwork = network;
  }

  /**
   * Gets comprehensive portfolio summary
   */
  async getPortfolioSummary(address?: string): Promise<PortfolioSummary> {
    try {
      const targetAddress = address || this.walletService.getAddress();

      // Get wallet balances
      const balance = await this.walletService.getBalance(targetAddress);

      // Get STX price
      const stxPrice = await this.priceService.getPrice('STX');
      const stxBalanceNum = parseFloat(balance.stx) / 1000000; // Convert from microSTX
      const stxValueUsd = stxBalanceNum * stxPrice.priceUsd;

      let totalValueUsd = stxValueUsd;

      // Calculate token values
      for (const token of balance.tokens) {
        try {
          const price = await this.priceService.getPrice(token.symbol);
          const tokenBalance = parseFloat(token.balance) / Math.pow(10, token.decimals);
          const tokenValue = tokenBalance * price.priceUsd;
          token.usdValue = tokenValue;
          totalValueUsd += tokenValue;
        } catch (error) {
          console.error(`Failed to get price for ${token.symbol}:`, error);
        }
      }

      // Get stacking info
      let stackingValue = 0;
      try {
        const stackingStatus = await this.stackingService.getStackingStatus(targetAddress);
        if (stackingStatus.isStacking && stackingStatus.stackedAmount) {
          stackingValue = parseFloat(stackingStatus.stackedAmount) * stxPrice.priceUsd;
          totalValueUsd += stackingValue;
        }
      } catch (error) {
        console.error('Failed to get stacking status:', error);
      }

      // Get DeFi positions (mock for now)
      const defiPositions: DefiPosition[] = [];
      // In a real implementation, this would query:
      // - LP positions from Alex, Velar, Bitflow
      // - Lending positions from Zest, Granite
      // - Any other protocol positions

      return {
        address: targetAddress,
        totalValueUsd,
        stxBalance: balance.stx,
        stxValueUsd,
        tokens: balance.tokens,
        stackingValue: stackingValue > 0 ? stackingValue : undefined,
        defiPositions: defiPositions.length > 0 ? defiPositions : undefined,
      };
    } catch (error: any) {
      throw new Error(`Failed to get portfolio summary: ${error.message}`);
    }
  }

  /**
   * Detects network from address prefix
   */
  private detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' {
    if (address.startsWith('SP')) return 'mainnet';
    if (address.startsWith('ST')) return 'testnet';
    // Default to constructor network if we can't detect
    return this.defaultNetwork;
  }

  /**
   * Gets transaction history for an address
   */
  async getTransactionHistory(
    address?: string,
    limit: number = 50
  ): Promise<Transaction[]> {
    try {
      const targetAddress = address || this.walletService.getAddress();

      // Detect network from address and use appropriate API client
      const detectedNetwork = this.detectNetworkFromAddress(targetAddress);
      const apiClient = new StacksApiClient(detectedNetwork);

      return await apiClient.getTransactions(targetAddress, limit);
    } catch (error: any) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Gets portfolio value history over time
   */
  async getPortfolioHistory(
    address: string,
    days: number
  ): Promise<{ date: string; value: number }[]> {
    try {
      // In a real implementation, this would:
      // 1. Query historical balances
      // 2. Query historical prices
      // 3. Calculate portfolio value at each point in time

      // Mock implementation
      const history: { date: string; value: number }[] = [];
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * dayMs);
        history.push({
          date: date.toISOString().split('T')[0],
          value: 10000 + Math.random() * 2000, // Mock values
        });
      }

      return history;
    } catch (error: any) {
      throw new Error(`Failed to get portfolio history: ${error.message}`);
    }
  }

  /**
   * Calculates profit & loss
   */
  async calculatePnL(address: string, days: number): Promise<{
    totalPnL: number;
    percentageChange: number;
  }> {
    try {
      const history = await this.getPortfolioHistory(address, days);

      if (history.length < 2) {
        return { totalPnL: 0, percentageChange: 0 };
      }

      const startValue = history[0].value;
      const endValue = history[history.length - 1].value;
      const totalPnL = endValue - startValue;
      const percentageChange = (totalPnL / startValue) * 100;

      return { totalPnL, percentageChange };
    } catch (error: any) {
      throw new Error(`Failed to calculate P&L: ${error.message}`);
    }
  }
}
