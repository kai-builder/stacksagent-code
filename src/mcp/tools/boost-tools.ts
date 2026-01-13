/**
 * BoostBTC MCP Tools
 * One-click BTC leverage operations via MCP
 */

import { z } from 'zod';
import { BoostService } from '../../core/boost.js';
import { WalletService } from '../../core/wallet.js';
import { configManager } from '../../utils/config.js';
import { ZEST_BORROW_ASSETS } from '../../utils/zest-constants.js';

export const boostTools = (boostService: BoostService, walletService: WalletService) => ({
  boost_btc_leverage: {
    description:
      'One-click BTC leverage: Supply sBTC as collateral, borrow stablecoin, and swap to more sBTC for leveraged exposure. Default 1.5x leverage. Requires wallet to be unlocked.',
    parameters: z.object({
      sbtcAmount: z.string().describe('Amount of sBTC to use as collateral (e.g., "0.5")'),
      targetLeverage: z
        .coerce
        .number()
        .optional()
        .default(1.5)
        .describe('Target leverage multiplier (default: 1.5, max recommended: 2.0)'),
      stablecoin: z
        .enum(['aeusdc', 'usdh', 'susdt', 'usda'])
        .optional()
        .default('aeusdc')
        .describe('Stablecoin to borrow (default: aeusdc)'),
      slippage: z.coerce.number().optional().default(0.5).describe('Slippage tolerance % (default: 0.5)'),
    }),
    handler: async (args: {
      sbtcAmount: string;
      targetLeverage?: number;
      stablecoin?: string;
      slippage?: number;
    }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        if (args.targetLeverage && (args.targetLeverage < 1 || args.targetLeverage > 3)) {
          return {
            success: false,
            error: 'Target leverage must be between 1 and 3. Recommended: 1.25-2.0 for safety.',
          };
        }

        const config = configManager.get();

        console.error(
          `[BoostBTC] Starting leverage operation: ${args.sbtcAmount} sBTC @ ${args.targetLeverage || 1.5}x`
        );

        const result = await boostService.leverage(
          {
            sbtcAmount: args.sbtcAmount,
            targetLeverage: args.targetLeverage,
            stablecoin: (args.stablecoin as any) || 'aeusdc',
            slippage: args.slippage,
          },
          address,
          privateKey
        );

        return {
          success: true,
          transactions: {
            supply: result.transactions.supply.txId,
            borrow: result.transactions.borrow.txId,
            swap: result.transactions.swap.txId,
          },
          position: {
            collateralDeposited: `${result.position.collateral} sBTC`,
            debtBorrowed: `$${result.position.debt}`,
            additionalSbtcFromSwap: `${result.position.additionalSbtc} sBTC`,
            totalBtcExposure: `${result.position.totalExposure} sBTC`,
            actualLeverage: `${result.position.leverage.toFixed(2)}x`,
            liquidationPrice: `$${result.position.liquidationPrice.toFixed(2)}`,
            healthFactor: result.position.healthFactor.toFixed(2),
          },
          network: config.network,
          message: `Successfully created ${result.position.leverage.toFixed(2)}x leveraged BTC position. Liquidation at $${result.position.liquidationPrice.toFixed(2)}.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  boost_btc_deleverage: {
    description:
      'One-click BTC deleverage: Swap sBTC back to stablecoin, repay debt, and withdraw collateral. Unwinds leveraged position. Requires wallet to be unlocked.',
    parameters: z.object({
      walletSbtc: z.string().describe('Amount of sBTC in wallet to swap for repayment'),
      debtAmount: z.string().describe('Amount of debt to repay'),
      debtAsset: z.enum(['aeusdc', 'usdh', 'susdt', 'usda']).describe('Asset that was borrowed'),
      collateralAmount: z.string().describe('Amount of collateral to withdraw after repayment'),
    }),
    handler: async (args: {
      walletSbtc: string;
      debtAmount: string;
      debtAsset: string;
      collateralAmount: string;
    }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        if (!ZEST_BORROW_ASSETS.includes(args.debtAsset as any)) {
          return {
            success: false,
            error: `Unsupported debt asset: ${args.debtAsset}. Supported: ${ZEST_BORROW_ASSETS.join(', ')}`,
          };
        }

        const config = configManager.get();
        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        console.error(`[BoostBTC] Starting deleverage operation...`);

        const result = await boostService.deleverage(
          { repayAll: true },
          address,
          privateKey,
          args.walletSbtc,
          args.debtAmount,
          args.debtAsset as any,
          args.collateralAmount
        );

        return {
          success: true,
          transactions: {
            swap: result.transactions.swap.txId,
            repay: result.transactions.repay.txId,
            withdraw: result.transactions.withdraw.txId,
          },
          recovered: {
            sbtcAmount: `${result.recovered.sbtcAmount} sBTC`,
          },
          network: config.network,
          message: `Successfully unwound leveraged position and recovered ${result.recovered.sbtcAmount} sBTC.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  boost_btc_quote: {
    description:
      'Preview leverage position without executing. Shows expected collateral, debt, exposure, liquidation price, and health factor.',
    parameters: z.object({
      sbtcAmount: z.string().describe('Amount of sBTC to use as collateral'),
      targetLeverage: z
        .coerce
        .number()
        .optional()
        .default(1.5)
        .describe('Target leverage multiplier (default: 1.5)'),
      stablecoin: z
        .enum(['aeusdc', 'usdh', 'susdt', 'usda'])
        .optional()
        .default('aeusdc')
        .describe('Stablecoin to borrow'),
    }),
    handler: async (args: { sbtcAmount: string; targetLeverage?: number; stablecoin?: string }) => {
      try {
        if (args.targetLeverage && (args.targetLeverage < 1 || args.targetLeverage > 3)) {
          return {
            success: false,
            error: 'Target leverage must be between 1 and 3.',
          };
        }

        const quote = await boostService.getQuote(
          args.sbtcAmount,
          args.targetLeverage,
          (args.stablecoin as any) || 'aeusdc'
        );

        const btcDropToLiquidation = ((quote.currentBtcPrice - quote.liquidationPrice) / quote.currentBtcPrice) * 100;

        return {
          success: true,
          quote: {
            collateral: `${quote.collateral} sBTC`,
            borrowAmount: `$${quote.borrowAmount}`,
            additionalSbtc: `${quote.additionalSbtc} sBTC`,
            totalExposure: `${quote.totalExposure} sBTC`,
            leverage: `${quote.leverage.toFixed(2)}x`,
            currentBtcPrice: `$${quote.currentBtcPrice.toFixed(2)}`,
            liquidationPrice: `$${quote.liquidationPrice.toFixed(2)}`,
            btcDropToLiquidation: `${btcDropToLiquidation.toFixed(1)}%`,
            healthFactor: quote.healthFactor.toFixed(2),
            riskLevel:
              quote.healthFactor > 2
                ? 'Very Safe'
                : quote.healthFactor > 1.5
                  ? 'Safe'
                  : quote.healthFactor > 1.2
                    ? 'Moderate'
                    : 'Risky',
          },
          message: `This is a preview only. Use boost_btc_leverage to execute.`,
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
