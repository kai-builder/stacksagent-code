/**
 * Zest Protocol MCP Tools
 * Exposes Zest lending/borrowing operations to Claude via MCP
 */

import { z } from 'zod';
import { ZestService } from '../services/zest.js';
import { PythService } from '../services/pyth.js';
import { WalletService } from '../services/wallet.js';
import { configManager } from '../utils/config.js';
import { ZEST_COLLATERAL_ASSETS, ZEST_BORROW_ASSETS } from '../utils/zest-constants.js';

export const zestTools = (zestService: ZestService, pythService: PythService, walletService: WalletService) => ({
  zest_supply: {
    description:
      'Supply collateral assets to Zest Protocol for lending. Supported assets: sbtc, ststx, wstx. Requires wallet to be unlocked.',
    parameters: z.object({
      asset: z.enum(['sbtc', 'ststx', 'wstx']).describe('Asset to supply as collateral (sbtc, ststx, or wstx)'),
      amount: z.string().describe('Amount to supply (human readable, e.g., "0.5" for 0.5 sBTC)'),
    }),
    handler: async (args: { asset: string; amount: string }) => {
      try {
        if (!ZEST_COLLATERAL_ASSETS.includes(args.asset as any)) {
          return {
            success: false,
            error: `Unsupported collateral asset: ${args.asset}. Supported: ${ZEST_COLLATERAL_ASSETS.join(', ')}`,
          };
        }

        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const config = configManager.get();
        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const result = await zestService.supply(
          { asset: args.asset as any, amount: args.amount },
          address,
          privateKey
        );

        return {
          success: true,
          txId: result.txId,
          asset: result.asset,
          amount: result.amount,
          network: config.network,
          message: `Successfully supplied ${result.amount} ${result.asset} as collateral to Zest Protocol.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  zest_borrow: {
    description:
      'Borrow stablecoins from Zest Protocol using your collateral. Supported assets: aeusdc, usdh, susdt, usda. Requires wallet to be unlocked and existing collateral.',
    parameters: z.object({
      assetToBorrow: z
        .enum(['aeusdc', 'usdh', 'susdt', 'usda'])
        .describe('Stablecoin to borrow (aeusdc, usdh, susdt, or usda)'),
      amount: z.string().describe('Amount to borrow (human readable, e.g., "50000" for $50,000)'),
      interestRateMode: z
        .enum(['0', '1'])
        .optional()
        .default('0')
        .describe('Interest rate mode: 0 = stable, 1 = variable (default: 0)'),
    }),
    handler: async (args: { assetToBorrow: string; amount: string; interestRateMode?: string }) => {
      try {
        if (!ZEST_BORROW_ASSETS.includes(args.assetToBorrow as any)) {
          return {
            success: false,
            error: `Unsupported borrow asset: ${args.assetToBorrow}. Supported: ${ZEST_BORROW_ASSETS.join(', ')}`,
          };
        }

        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const config = configManager.get();
        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();
        const interestMode = parseInt(args.interestRateMode || '0') as 0 | 1;

        const result = await zestService.borrow(
          { assetToBorrow: args.assetToBorrow as any, amount: args.amount, interestRateMode: interestMode },
          address,
          privateKey
        );

        return {
          success: true,
          txId: result.txId,
          asset: result.asset,
          amount: result.amount,
          interestRateMode: result.interestRateMode === 0 ? 'stable' : 'variable',
          network: config.network,
          message: `Successfully borrowed ${result.amount} ${result.asset} from Zest Protocol.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  zest_repay: {
    description:
      'Repay borrowed assets to Zest Protocol. Use "max" to repay all debt. Requires wallet to be unlocked.',
    parameters: z.object({
      asset: z.enum(['aeusdc', 'usdh', 'susdt', 'usda']).describe('Asset to repay (aeusdc, usdh, susdt, or usda)'),
      amount: z.string().describe('Amount to repay or "max" to repay all debt'),
      onBehalfOf: z.string().optional().describe('Address to repay for (defaults to your wallet)'),
    }),
    handler: async (args: { asset: string; amount: string; onBehalfOf?: string }) => {
      try {
        if (!ZEST_BORROW_ASSETS.includes(args.asset as any)) {
          return {
            success: false,
            error: `Unsupported asset: ${args.asset}. Supported: ${ZEST_BORROW_ASSETS.join(', ')}`,
          };
        }

        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const config = configManager.get();
        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const result = await zestService.repay(
          { asset: args.asset as any, amount: args.amount, onBehalfOf: args.onBehalfOf },
          address,
          privateKey
        );

        return {
          success: true,
          txId: result.txId,
          asset: result.asset,
          amount: result.amount,
          network: config.network,
          message: `Successfully repaid ${result.amount === 'max' ? 'all' : result.amount} ${result.asset} to Zest Protocol.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  zest_withdraw: {
    description:
      'Withdraw collateral from Zest Protocol. Only available if health factor allows. Requires wallet to be unlocked.',
    parameters: z.object({
      asset: z.enum(['sbtc', 'ststx', 'wstx']).describe('Asset to withdraw (sbtc, ststx, or wstx)'),
      amount: z.string().describe('Amount to withdraw (human readable, e.g., "0.5")'),
    }),
    handler: async (args: { asset: string; amount: string }) => {
      try {
        if (!ZEST_COLLATERAL_ASSETS.includes(args.asset as any)) {
          return {
            success: false,
            error: `Unsupported asset: ${args.asset}. Supported: ${ZEST_COLLATERAL_ASSETS.join(', ')}`,
          };
        }

        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const config = configManager.get();
        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const result = await zestService.withdraw(
          { asset: args.asset as any, amount: args.amount },
          address,
          privateKey
        );

        return {
          success: true,
          txId: result.txId,
          asset: result.asset,
          amount: result.amount,
          network: config.network,
          message: `Successfully withdrew ${result.amount} ${result.asset} from Zest Protocol.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  pyth_get_price_feed: {
    description: 'Fetches current price data from Pyth Network for BTC, STX, and USDC',
    parameters: z.object({}),
    handler: async () => {
      try {
        const feed = await pythService.getPriceFeed();

        return {
          success: true,
          prices: {
            btc: feed.prices.btc,
            stx: feed.prices.stx,
            usdc: feed.prices.usdc,
          },
          timestamp: new Date(feed.timestamp).toISOString(),
          message: 'Fetched latest prices from Pyth Network',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  pyth_get_btc_price: {
    description: 'Fetches current BTC price from Pyth Network',
    parameters: z.object({}),
    handler: async () => {
      try {
        const price = await pythService.getBtcPrice();

        return {
          success: true,
          price: price,
          symbol: 'BTC/USD',
          message: `Current BTC price: $${price.toFixed(2)}`,
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
