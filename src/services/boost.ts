/**
 * BoostBTC Service
 * Provides one-click BTC leverage and deleverage operations
 */

import { ZestService } from './zest.js';
import { DexService } from './dex.js';
import { PythService } from './pyth.js';
import { StacksApiClient } from './stacks-api.js';
import { ZEST_PARAMS, ZestBorrowAsset } from '../utils/zest-constants.js';

export interface BoostBtcLeverageParams {
  sbtcAmount: string; // Amount of sBTC to use as collateral
  targetLeverage?: number; // Default 1.5
  stablecoin?: ZestBorrowAsset; // Default "aeusdc"
  slippage?: number; // Default 0.5%
}

export interface BoostBtcLeverageResult {
  success: boolean;
  transactions: {
    supply: { txId: string };
    borrow: { txId: string };
    swap: { txId: string };
  };
  position: {
    collateral: string; // sBTC deposited
    debt: string; // stablecoin borrowed
    additionalSbtc: string; // sBTC received from swap
    totalExposure: string; // Total sBTC exposure
    leverage: number; // Actual leverage achieved
    liquidationPrice: number; // BTC price that triggers liquidation
    healthFactor: number; // Current health factor
  };
}

export interface BoostBtcDeleverageParams {
  repayAll?: boolean; // Default true - fully unwind position
}

export interface BoostBtcDeleverageResult {
  success: boolean;
  transactions: {
    swap: { txId: string };
    repay: { txId: string };
    withdraw: { txId: string };
  };
  recovered: {
    sbtcAmount: string;
  };
}

export class BoostService {
  private zestService: ZestService;
  private dexService: DexService;
  private pythService: PythService;
  private apiClient: StacksApiClient;
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    this.zestService = new ZestService(network);
    this.dexService = new DexService(network);
    this.pythService = new PythService();
    this.apiClient = new StacksApiClient(network);
  }

  /**
   * One-click leverage: Supply sBTC, borrow stablecoin, swap to more sBTC
   */
  async leverage(
    params: BoostBtcLeverageParams,
    senderAddress: string,
    senderKey: string
  ): Promise<BoostBtcLeverageResult> {
    const leverage = params.targetLeverage ?? ZEST_PARAMS.DEFAULT_LEVERAGE;
    const stablecoin = params.stablecoin ?? 'aeusdc';
    const slippage = params.slippage ?? ZEST_PARAMS.DEFAULT_SLIPPAGE;

    try {
      // Get current BTC price
      const btcPrice = await this.pythService.getBtcPrice();

      // Calculate amounts
      const sbtcAmountNum = parseFloat(params.sbtcAmount);
      const collateralValueUsd = sbtcAmountNum * btcPrice;

      // LTV for target leverage
      // For 1.5x: we borrow 50% of collateral value
      const ltv = (leverage - 1) / leverage;
      const borrowAmountUsd = collateralValueUsd * ltv;

      // Step 1: Supply sBTC as collateral
      console.log(`[BoostBTC] Step 1/3: Supplying ${params.sbtcAmount} sBTC as collateral...`);
      const supplyResult = await this.zestService.supply(
        { asset: 'sbtc', amount: params.sbtcAmount },
        senderAddress,
        senderKey
      );

      // Wait for confirmation
      await this.waitForConfirmation(supplyResult.txId);

      // Step 2: Borrow stablecoin
      console.log(`[BoostBTC] Step 2/3: Borrowing ${borrowAmountUsd.toFixed(2)} ${stablecoin}...`);
      const borrowResult = await this.zestService.borrow(
        {
          assetToBorrow: stablecoin,
          amount: borrowAmountUsd.toString(),
          interestRateMode: 0,
        },
        senderAddress,
        senderKey
      );

      await this.waitForConfirmation(borrowResult.txId);

      // Step 3: Swap stablecoin to sBTC
      console.log(`[BoostBTC] Step 3/3: Swapping ${stablecoin} to sBTC...`);
      const swapResult = await this.dexService.executeSwap(
        stablecoin.toUpperCase(),
        'SBTC',
        borrowAmountUsd.toString(),
        slippage,
        senderKey,
        senderAddress
      );

      // Calculate final position
      const additionalSbtc = borrowAmountUsd / btcPrice;
      const totalExposure = sbtcAmountNum + additionalSbtc;
      const actualLeverage = totalExposure / sbtcAmountNum;

      // Liquidation price calculation
      const liquidationThreshold = ZEST_PARAMS.LIQUIDATION_THRESHOLD;
      const liquidationPrice = borrowAmountUsd / (sbtcAmountNum * liquidationThreshold);

      // Health factor = (collateral * liquidationThreshold) / debt
      const healthFactor = (collateralValueUsd * liquidationThreshold) / borrowAmountUsd;

      return {
        success: true,
        transactions: {
          supply: { txId: supplyResult.txId },
          borrow: { txId: borrowResult.txId },
          swap: { txId: swapResult.txHash },
        },
        position: {
          collateral: params.sbtcAmount,
          debt: borrowAmountUsd.toFixed(2),
          additionalSbtc: additionalSbtc.toFixed(8),
          totalExposure: totalExposure.toFixed(8),
          leverage: actualLeverage,
          liquidationPrice: liquidationPrice,
          healthFactor: healthFactor,
        },
      };
    } catch (error: any) {
      throw new Error(`BoostBTC leverage failed: ${error.message}`);
    }
  }

  /**
   * One-click deleverage: Swap sBTC to stablecoin, repay debt, withdraw collateral
   */
  async deleverage(
    params: BoostBtcDeleverageParams,
    senderAddress: string,
    senderKey: string,
    walletSbtc: string,
    debtAmount: string,
    debtAsset: ZestBorrowAsset,
    collateralAmount: string
  ): Promise<BoostBtcDeleverageResult> {
    try {
      // Step 1: Swap sBTC in wallet to stablecoin to repay debt
      console.log(`[BoostBTC] Step 1/3: Swapping ${walletSbtc} sBTC to ${debtAsset}...`);
      const swapResult = await this.dexService.executeSwap(
        'SBTC',
        debtAsset.toUpperCase(),
        walletSbtc,
        0.5,
        senderKey,
        senderAddress
      );

      await this.waitForConfirmation(swapResult.txHash);

      // Step 2: Repay all debt
      console.log(`[BoostBTC] Step 2/3: Repaying ${debtAmount} ${debtAsset}...`);
      const repayResult = await this.zestService.repay(
        {
          asset: debtAsset,
          amount: 'max',
        },
        senderAddress,
        senderKey
      );

      await this.waitForConfirmation(repayResult.txId);

      // Step 3: Withdraw all collateral
      console.log(`[BoostBTC] Step 3/3: Withdrawing ${collateralAmount} sBTC...`);
      const withdrawResult = await this.zestService.withdraw(
        {
          asset: 'sbtc',
          amount: collateralAmount,
        },
        senderAddress,
        senderKey
      );

      return {
        success: true,
        transactions: {
          swap: { txId: swapResult.txHash },
          repay: { txId: repayResult.txId },
          withdraw: { txId: withdrawResult.txId },
        },
        recovered: {
          sbtcAmount: collateralAmount,
        },
      };
    } catch (error: any) {
      throw new Error(`BoostBTC deleverage failed: ${error.message}`);
    }
  }

  /**
   * Get a quote for leverage without executing
   */
  async getQuote(
    sbtcAmount: string,
    targetLeverage?: number,
    stablecoin?: ZestBorrowAsset
  ): Promise<{
    collateral: string;
    borrowAmount: string;
    additionalSbtc: string;
    totalExposure: string;
    leverage: number;
    liquidationPrice: number;
    healthFactor: number;
    currentBtcPrice: number;
  }> {
    const leverage = targetLeverage ?? ZEST_PARAMS.DEFAULT_LEVERAGE;
    const btcPrice = await this.pythService.getBtcPrice();

    const sbtcAmountNum = parseFloat(sbtcAmount);
    const collateralValueUsd = sbtcAmountNum * btcPrice;

    const ltv = (leverage - 1) / leverage;
    const borrowAmountUsd = collateralValueUsd * ltv;

    const additionalSbtc = borrowAmountUsd / btcPrice;
    const totalExposure = sbtcAmountNum + additionalSbtc;
    const actualLeverage = totalExposure / sbtcAmountNum;

    const liquidationThreshold = ZEST_PARAMS.LIQUIDATION_THRESHOLD;
    const liquidationPrice = borrowAmountUsd / (sbtcAmountNum * liquidationThreshold);
    const healthFactor = (collateralValueUsd * liquidationThreshold) / borrowAmountUsd;

    return {
      collateral: sbtcAmount,
      borrowAmount: borrowAmountUsd.toFixed(2),
      additionalSbtc: additionalSbtc.toFixed(8),
      totalExposure: totalExposure.toFixed(8),
      leverage: actualLeverage,
      liquidationPrice: liquidationPrice,
      healthFactor: healthFactor,
      currentBtcPrice: btcPrice,
    };
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(txId: string): Promise<void> {
    const maxAttempts = 60;
    const delayMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const tx = await this.apiClient.getTransaction(txId);

        if (tx.tx_status === 'success') {
          console.log(`[BoostBTC] Transaction ${txId} confirmed`);
          return;
        }

        if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') {
          throw new Error(`Transaction ${txId} failed: ${tx.tx_status}`);
        }

        // Still pending, wait and retry
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error: any) {
        // Transaction not found yet, continue waiting
        if (i === maxAttempts - 1) {
          throw new Error(`Transaction ${txId} timed out after ${maxAttempts * delayMs}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(`Transaction ${txId} confirmation timed out`);
  }
}
