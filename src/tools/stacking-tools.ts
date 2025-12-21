import { z } from 'zod';
import { StackingService } from '../services/stacking.js';
import { PortfolioService } from '../services/portfolio.js';
import { WalletService } from '../services/wallet.js';

export const stackingAndPortfolioTools = (
  stackingService: StackingService,
  portfolioService: PortfolioService,
  walletService: WalletService
) => ({
  stacking_get_info: {
    description: 'Gets current Stacking/PoX cycle information and APY',
    parameters: z.object({}),
    handler: async () => {
      try {
        const info = await stackingService.getStackingInfo();

        return {
          success: true,
          currentCycle: info.currentCycle,
          nextCycleStart: new Date(info.nextCycleStart).toISOString(),
          minStackingAmount: `${info.minStackingAmount} STX`,
          estimatedApy: `${info.estimatedApy}%`,
          message: 'Stacking allows you to earn BTC rewards by locking STX',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_status: {
    description: 'Gets stacking status for an address',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
    }),
    handler: async (args: { address?: string }) => {
      try {
        const address = args.address || walletService.getAddress();
        const status = await stackingService.getStackingStatus(address);

        if (!status.isStacking) {
          return {
            success: true,
            isStacking: false,
            message: 'This address is not currently stacking',
          };
        }

        return {
          success: true,
          isStacking: true,
          stackedAmount: `${status.stackedAmount} STX`,
          unlockHeight: status.unlockHeight,
          poxAddress: status.poxAddress,
          cyclesRemaining: status.cyclesRemaining,
          estimatedRewards: `${status.estimatedRewards} BTC`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_stack: {
    description: 'Stacks STX to earn Bitcoin rewards (locks STX for specified cycles)',
    parameters: z.object({
      amount: z.string().describe('Amount of STX to stack'),
      cycles: z.coerce.number().describe('Number of cycles to stack (1-12)'),
      poxAddress: z.string().describe('Bitcoin address to receive rewards'),
    }),
    handler: async (args: { amount: string; cycles: number; poxAddress: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const txHash = await stackingService.stackStx(
          args.amount,
          args.cycles,
          args.poxAddress,
          privateKey,
          address
        );

        // Calculate estimated rewards
        const info = await stackingService.getStackingInfo();
        const estimatedRewards = stackingService.calculateEstimatedRewards(
          args.amount,
          args.cycles,
          info.estimatedApy
        );

        return {
          success: true,
          txHash,
          stackedAmount: `${args.amount} STX`,
          cycles: args.cycles,
          estimatedRewards: `~${estimatedRewards} BTC`,
          message: `Stacking transaction submitted. Your STX will be locked for ${args.cycles} cycles.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_delegate: {
    description: 'Delegates STX to a stacking pool',
    parameters: z.object({
      amount: z.string().describe('Amount of STX to delegate'),
      delegateTo: z.string().describe('Pool address to delegate to'),
    }),
    handler: async (args: { amount: string; delegateTo: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const txHash = await stackingService.delegateStx(
          args.amount,
          args.delegateTo,
          privateKey,
          address
        );

        return {
          success: true,
          txHash,
          delegatedAmount: `${args.amount} STX`,
          delegatedTo: args.delegateTo,
          message: 'STX delegation successful',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_summary: {
    description: 'Gets comprehensive portfolio summary with total value and breakdown',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
    }),
    handler: async (args: { address?: string }) => {
      try {
        const summary = await portfolioService.getPortfolioSummary(args.address);

        // Format the response
        const stxBalance = (parseFloat(summary.stxBalance) / 1000000).toFixed(6);

        return {
          success: true,
          address: summary.address,
          totalValue: `$${summary.totalValueUsd.toFixed(2)}`,
          stx: {
            balance: `${stxBalance} STX`,
            value: `$${summary.stxValueUsd.toFixed(2)}`,
          },
          tokens: summary.tokens.map(t => ({
            symbol: t.symbol,
            balance: (parseFloat(t.balance) / Math.pow(10, t.decimals)).toFixed(t.decimals),
            value: t.usdValue ? `$${t.usdValue.toFixed(2)}` : 'N/A',
          })),
          stacking: summary.stackingValue
            ? `$${summary.stackingValue.toFixed(2)}`
            : 'Not stacking',
          defiPositions: summary.defiPositions || [],
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_transactions: {
    description: 'Gets recent transaction history for an address',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
      limit: z.coerce.number().optional().default(20).describe('Number of transactions to fetch'),
    }),
    handler: async (args: { address?: string; limit?: number }) => {
      try {
        const transactions = await portfolioService.getTransactionHistory(
          args.address,
          args.limit || 20
        );

        return {
          success: true,
          transactions: transactions.map(tx => ({
            txHash: tx.txHash,
            timestamp: new Date(tx.timestamp * 1000).toISOString(),
            type: tx.type,
            status: tx.status,
            description: tx.description,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_history: {
    description: 'Gets portfolio value history over time with P&L',
    parameters: z.object({
      address: z.string().describe('Address to analyze'),
      days: z.coerce.number().default(30).describe('Number of days of history'),
    }),
    handler: async (args: { address: string; days: number }) => {
      try {
        const history = await portfolioService.getPortfolioHistory(args.address, args.days);
        const pnl = await portfolioService.calculatePnL(args.address, args.days);

        return {
          success: true,
          history,
          pnl: {
            total: `$${pnl.totalPnL.toFixed(2)}`,
            percentage: `${pnl.percentageChange.toFixed(2)}%`,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },
});
