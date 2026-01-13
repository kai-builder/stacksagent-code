import { z } from 'zod';
import { PriceService } from '../../core/price.js';
import { DexService } from '../../core/dex.js';
import { SwapService } from '../../core/swap.js';
import { WalletService } from '../../core/wallet.js';
import { configManager } from '../../utils/config.js';
import { resolveToken } from '../../utils/token-resolver.js';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../../utils/constants.js';

export const marketTools = (
  priceService: PriceService,
  dexService: DexService,
  swapService: SwapService,
  walletService: WalletService
) => ({
  market_get_price: {
    description: 'Gets current price for a token in USD and 24h change',
    parameters: z.object({
      symbol: z.string().describe('Token symbol (e.g., STX, WELSH, USDA)'),
    }),
    handler: async (args: { symbol: string }) => {
      try {
        const price = await priceService.getPrice(args.symbol);

        return {
          success: true,
          symbol: price.symbol,
          priceUsd: price.priceUsd,
          priceStx: price.priceStx,
          change24h: price.change24h,
          lastUpdated: new Date(price.lastUpdated).toISOString(),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  market_get_tokens: {
    description: 'Gets list of tokens with metrics (trending, new, or by volume)',
    parameters: z.object({
      filter: z.enum(['trending', 'new', 'volume']).optional().describe('Filter for token list'),
      limit: z.coerce.number().optional().default(10).describe('Maximum number of tokens to return'),
    }),
    handler: async (args: { filter?: string; limit?: number }) => {
      try {
        const filter = (args.filter as 'trending' | 'new' | 'volume') || 'trending';
        const tokens = await priceService.getTrendingTokens(args.limit || 10, filter);

        return {
          success: true,
          filter,
          tokens: tokens.map(token => ({
            symbol: token.symbol,
            name: token.name,
            contractId: token.contractId,
            priceUsd: token.priceUsd,
            change24h: token.change24h,
            liquidityUsd: token.liquidityUsd,
            volume24hUsd: token.volume24hUsd,
            holders: token.holders,
            deployedAt: token.deployedAt,
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

  market_get_pools: {
    description: 'Gets liquidity pools with APY, TVL, and volume data',
    parameters: z.object({
      protocol: z.string().optional().describe('Filter by protocol (alex, velar, bitflow)'),
      limit: z.coerce.number().optional().describe('Maximum number of pools to return (default: 15)'),
    }),
    handler: async (args: { protocol?: string; limit?: number }) => {
      try {
        const pools = await priceService.getPools(args.protocol, args.limit || 15);

        return {
          success: true,
          pools: pools.map(p => ({
            poolId: p.poolId,
            protocol: p.protocol,
            pair: `${p.tokenA}-${p.tokenB}`,
            apy: p.apy,
            tvlUsd: p.tvl,
            volume24hUsd: p.volume24h,
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

  dex_quote: {
    description: 'Gets a quote for swapping tokens (does not execute)',
    parameters: z.object({
      fromToken: z.string().describe('Token to swap from (e.g., STX)'),
      toToken: z.string().describe('Token to swap to (e.g., WELSH)'),
      amount: z.string().describe('Amount of fromToken to swap'),
      preferredDex: z.string().optional().describe('Preferred DEX (alex, velar, bitflow, or auto)'),
    }),
    handler: async (args: {
      fromToken: string;
      toToken: string;
      amount: string;
      preferredDex?: string;
    }) => {
      try {
        const config = configManager.get();
        const quote = await dexService.getQuote(
          args.fromToken,
          args.toToken,
          args.amount,
          args.preferredDex || config.trading.preferredDex
        );

        return {
          success: true,
          quote: {
            from: `${quote.fromAmount} ${quote.fromToken}`,
            to: `${quote.toAmount} ${quote.toToken}`,
            rate: `1 ${quote.fromToken} = ${quote.rate} ${quote.toToken}`,
            slippage: `${quote.slippage}%`,
            fee: `${quote.fee} ${quote.fromToken}`,
            protocol: quote.protocol,
            route: quote.route.join(' → '),
          },
          message: 'This is a quote only. Use dex_swap to execute the trade.',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  dex_swap: {
    description: 'Executes a token swap on a DEX. Coming soon - use DEX UI for now.',
    parameters: z.object({
      fromToken: z.string().describe('Token to swap from (symbol or contract ID, e.g., "STX", "WELSH")'),
      toToken: z.string().describe('Token to swap to (symbol or contract ID, e.g., "WELSH", "sBTC")'),
      amount: z.string().describe('Amount to swap (human-readable, e.g., "0.015" for 0.015 STX)'),
      slippage: z.coerce.number().optional().describe('Slippage tolerance in percent (default: 0.5)'),
    }),
    handler: async (args: {
      fromToken: string;
      toToken: string;
      amount: string;
      slippage?: number;
    }) => {
      return {
        success: false,
        comingSoon: true,
        message: 'Direct swap execution is coming soon! For now, please use one of these DEX interfaces:',
        dexInterfaces: {
          bitflow: 'https://app.bitflow.finance/trade',
          alex: 'https://app.alexlab.co/swap',
          velar: 'https://app.velar.com/swap',
          faktory: 'https://fak.fun/swap',
        },
        requestedSwap: {
          from: args.fromToken,
          to: args.toToken,
          amount: args.amount,
        },
      };
    },
  },

  dex_add_liquidity: {
    description: 'Adds liquidity to a pool. Coming soon - use DEX UI for now.',
    parameters: z.object({
      poolId: z.string().describe('Pool identifier'),
      amountA: z.string().describe('Amount of first token'),
      amountB: z.string().describe('Amount of second token'),
    }),
    handler: async (args: { poolId: string; amountA: string; amountB: string }) => {
      return {
        success: false,
        comingSoon: true,
        message: 'Adding liquidity is coming soon! For now, please use one of these DEX interfaces:',
        dexInterfaces: {
          bitflow: 'https://app.bitflow.finance/trade',
          alex: 'https://app.alexlab.co/swap',
          velar: 'https://app.velar.com/swap',
          faktory: 'https://fak.fun/swap',
        },
        requestedAction: {
          poolId: args.poolId,
          amountA: args.amountA,
          amountB: args.amountB,
        },
      };
    },
  },

  dex_remove_liquidity: {
    description: 'Removes liquidity from a pool. Coming soon - use DEX UI for now.',
    parameters: z.object({
      poolId: z.string().describe('Pool identifier'),
      lpAmount: z.string().describe('Amount of LP tokens to burn'),
    }),
    handler: async (args: { poolId: string; lpAmount: string }) => {
      return {
        success: false,
        comingSoon: true,
        message: 'Removing liquidity is coming soon! For now, please use one of these DEX interfaces:',
        dexInterfaces: {
          bitflow: 'https://app.bitflow.finance/trade',
          alex: 'https://app.alexlab.co/swap',
          velar: 'https://app.velar.com/swap',
          faktory: 'https://fak.fun/swap',
        },
        requestedAction: {
          poolId: args.poolId,
          lpAmount: args.lpAmount,
        },
      };
    },
  },
});
