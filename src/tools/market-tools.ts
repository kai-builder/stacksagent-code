import { z } from 'zod';
import { PriceService } from '../services/price.js';
import { DexService } from '../services/dex.js';
import { SwapService } from '../services/swap.js';
import { WalletService } from '../services/wallet.js';
import { configManager } from '../utils/config.js';
import { resolveToken } from '../utils/token-resolver.js';

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
    description: 'Executes a token swap on a DEX (Bitflow, Alex, Velar, or Faktory). Automatically finds the best rate across all DEXes. Requires wallet to be unlocked.',
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
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first with wallet_unlock.',
          };
        }

        const config = configManager.get();
        const slippage = args.slippage || config.trading.defaultSlippage;

        // Validate slippage
        if (slippage > config.trading.maxSlippage) {
          return {
            success: false,
            error: `Slippage exceeds maximum allowed (${config.trading.maxSlippage}%)`,
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        // Step 1: Resolve tokens to contract IDs
        const fromTokenInfo = resolveToken(args.fromToken);
        const toTokenInfo = resolveToken(args.toToken);

        console.log(`[dex_swap] Resolved tokens:`, {
          from: fromTokenInfo,
          to: toTokenInfo,
        });

        // Step 2: Get quotes from all AMMs
        const amountNum = parseFloat(args.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return {
            success: false,
            error: `Invalid amount: ${args.amount}`,
          };
        }

        console.log(`[dex_swap] Getting quotes for ${amountNum} ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}`);

        const quotes = await swapService.getAllQuotes(
          fromTokenInfo.contractId,
          toTokenInfo.contractId,
          amountNum
        );

        if (quotes.length === 0) {
          return {
            success: false,
            error: `No swap routes available for ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}. Try a different pair or amount.`,
          };
        }

        // Step 3: Select best quote (highest output)
        const bestQuote = quotes.reduce((best, current) =>
          current.amountOut > best.amountOut ? current : best
        );

        console.log(`[dex_swap] Best quote from ${bestQuote.amm}: ${bestQuote.amountOut.toFixed(6)} ${toTokenInfo.symbol}`);
        console.log(`[dex_swap] All quotes:`, quotes.map(q => `${q.amm}: ${q.amountOut.toFixed(6)}`));

        // Step 4: Execute swap
        const result = await swapService.executeSwap(
          bestQuote,
          address,
          privateKey,
          slippage
        );

        return {
          success: true,
          txId: result.txId,
          amm: bestQuote.amm,
          swap: {
            from: `${amountNum} ${fromTokenInfo.symbol}`,
            to: `~${bestQuote.amountOut.toFixed(6)} ${toTokenInfo.symbol}`,
            rate: `1 ${fromTokenInfo.symbol} = ${(bestQuote.amountOut / amountNum).toFixed(6)} ${toTokenInfo.symbol}`,
          },
          allQuotes: quotes.map(q => ({
            amm: q.amm,
            amountOut: q.amountOut.toFixed(6),
            rate: `1 ${fromTokenInfo.symbol} = ${(q.amountOut / amountNum).toFixed(6)} ${toTokenInfo.symbol}`,
          })),
          message: `Swap executed on ${bestQuote.amm}. Expected output: ~${bestQuote.amountOut.toFixed(6)} ${toTokenInfo.symbol}. Transaction: ${result.txId}`,
        };
      } catch (error: any) {
        console.error('[dex_swap] Error:', error);
        return {
          success: false,
          error: error.message || 'Swap failed',
          details: error.stack,
        };
      }
    },
  },

  dex_add_liquidity: {
    description: 'Adds liquidity to a pool (receives LP tokens)',
    parameters: z.object({
      poolId: z.string().describe('Pool identifier'),
      amountA: z.string().describe('Amount of first token'),
      amountB: z.string().describe('Amount of second token'),
    }),
    handler: async (args: { poolId: string; amountA: string; amountB: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const result = await dexService.addLiquidity(
          args.poolId,
          args.amountA,
          args.amountB,
          privateKey,
          address
        );

        return {
          success: true,
          txHash: result.txHash,
          lpTokensReceived: result.lpTokens,
          message: 'Liquidity added successfully',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  dex_remove_liquidity: {
    description: 'Removes liquidity from a pool (burns LP tokens)',
    parameters: z.object({
      poolId: z.string().describe('Pool identifier'),
      lpAmount: z.string().describe('Amount of LP tokens to burn'),
    }),
    handler: async (args: { poolId: string; lpAmount: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const result = await dexService.removeLiquidity(
          args.poolId,
          args.lpAmount,
          privateKey,
          address
        );

        return {
          success: true,
          txHash: result.txHash,
          tokensReceived: {
            amountA: result.amountA,
            amountB: result.amountB,
          },
          message: 'Liquidity removed successfully',
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
