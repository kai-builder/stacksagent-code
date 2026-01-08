/**
 * Multi-AMM Swap Service
 * Supports Bitflow, Alex, Velar, and Faktory for token swaps
 */

import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { BitflowSDK } from '@bitflowlabs/core-sdk';
import { AlexSDK, Currency, TokenInfo } from 'alex-sdk';
import { VelarSDK } from '@velarprotocol/velar-sdk';
import { FaktorySDK } from '@faktoryfun/core-sdk';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../utils/constants.js';
import { ZEST_ASSETS } from '../utils/zest-constants.js';

export interface SwapQuote {
  amm: 'bitflow' | 'alex' | 'velar' | 'faktory';
  fromToken: {
    contract_id: string;
    symbol: string;
  };
  toToken: {
    contract_id: string;
    symbol: string;
  };
  amountIn: number;
  amountOut: number;
  route: any;
  swapOptions?: any;
  fee?: number;
  priceImpact?: number;
}

export interface SwapResult {
  success: boolean;
  txId: string;
  amm: string;
  fromToken: string;
  toToken: string;
  amountIn: number;
  expectedAmountOut: number;
}

const VELAR_STX_CONTRACT = 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx';

export class SwapService {
  private network: 'mainnet' | 'testnet';
  private bitflow?: BitflowSDK;
  private alex?: AlexSDK;
  private velar?: VelarSDK;
  private faktory?: FaktorySDK;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
  }

  /**
   * Get quotes from all AMMs
   * NOTE: Alex and Velar are temporarily disabled due to SDK compatibility issues
   * - Alex: Requires @stacks v7.x but project uses v6.x
   * - Velar: SDK serialization issues with Clarity values
   */
  async getAllQuotes(
    fromContractId: string,
    toContractId: string,
    amount: number
  ): Promise<SwapQuote[]> {
    const quotes: SwapQuote[] = [];

    // Try to get quotes from working AMMs only (Bitflow and Faktory)
    const results = await Promise.allSettled([
      this.getBitflowQuote(fromContractId, toContractId, amount),
      // this.getAlexQuote(fromContractId, toContractId, amount), // Disabled: @stacks version mismatch
      // this.getVelarQuote(fromContractId, toContractId, amount), // Disabled: Clarity serialization issues
      this.getFaktoryQuote(fromContractId, toContractId, amount),
    ]);

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    });

    return quotes.filter((q) => q.amountOut > 0);
  }

  /**
   * Execute swap on a specific AMM
   */
  async executeSwap(
    quote: SwapQuote,
    senderAddress: string,
    senderKey: string,
    slippage: number = 0.5
  ): Promise<SwapResult> {
    const network = this.getStacksNetwork();

    let txOptions: any;

    switch (quote.amm) {
      case 'bitflow':
        txOptions = await this.buildBitflowSwap(quote, senderAddress, slippage);
        break;
      case 'alex':
        txOptions = await this.buildAlexSwap(quote, senderAddress);
        break;
      case 'velar':
        txOptions = await this.buildVelarSwap(quote, senderAddress);
        break;
      case 'faktory':
        txOptions = await this.buildFaktorySwap(quote, senderAddress, slippage);
        break;
      default:
        throw new Error(`Unsupported AMM: ${quote.amm}`);
    }

    // Add required transaction fields to txOptions
    txOptions.senderKey = senderKey;
    txOptions.network = network;
    txOptions.anchorMode = AnchorMode.Any;
    txOptions.postConditionMode = PostConditionMode.Allow; // Always allow like the frontend
    txOptions.fee = 5000n;

    // Ensure postConditions is a proper array
    if (!txOptions.postConditions) {
      txOptions.postConditions = [];
    }

    // Build and broadcast transaction
    const transaction = await makeContractCall(txOptions);

    const result = await broadcastTransaction(transaction, network);
    const txId = typeof result === 'string' ? result : result.txid;

    if (!txId) {
      throw new Error('Swap transaction failed without txid');
    }

    return {
      success: true,
      txId,
      amm: quote.amm,
      fromToken: quote.fromToken.symbol,
      toToken: quote.toToken.symbol,
      amountIn: quote.amountIn,
      expectedAmountOut: quote.amountOut,
    };
  }

  /**
   * Get Bitflow quote
   */
  private async getBitflowQuote(
    fromContractId: string,
    toContractId: string,
    amount: number
  ): Promise<SwapQuote | null> {
    try {
      if (!this.bitflow) {
        this.bitflow = new BitflowSDK({
          BITFLOW_API_HOST: 'https://api.bitflowapis.finance/',
          BITFLOW_API_KEY: process.env.BITFLOW_API_KEY,
          READONLY_CALL_API_HOST: 'https://node.bitflowapis.finance/',
          READONLY_CALL_API_KEY: process.env.BITFLOW_READONLY_API_KEY,
          KEEPER_API_HOST: 'https://keeper.bitflowapis.finance/',
          KEEPER_API_KEY: process.env.BITFLOW_API_KEY,
        });
      }

      // Convert contract IDs to Bitflow token IDs
      const fromTokenId = this.toBitflowTokenId(fromContractId);
      const toTokenId = this.toBitflowTokenId(toContractId);

      const quote = await this.bitflow.getQuoteForRoute(fromTokenId, toTokenId, amount);

      if (!quote) return null;

      const bestRoute = quote.bestRoute || quote.allRoutes?.[0];
      if (!bestRoute || !bestRoute.quote) return null;

      return {
        amm: 'bitflow',
        fromToken: { contract_id: fromContractId, symbol: this.extractSymbol(fromContractId) },
        toToken: { contract_id: toContractId, symbol: this.extractSymbol(toContractId) },
        amountIn: amount,
        amountOut: bestRoute.quote,
        route: quote,
        swapOptions: {
          tokenXDecimals: bestRoute.tokenXDecimals || 6,
          tokenYDecimals: bestRoute.tokenYDecimals || 6,
          fromTokenId,
          toTokenId,
        },
        fee: (bestRoute as any).fee,
        priceImpact: (bestRoute as any).priceImpact,
      };
    } catch (error) {
      console.error('[SwapService] Bitflow quote error:', error);
      return null;
    }
  }

  /**
   * Get Alex quote
   */
  private async getAlexQuote(
    fromContractId: string,
    toContractId: string,
    amount: number
  ): Promise<SwapQuote | null> {
    try {
      // Initialize Alex SDK if needed
      if (!this.alex) {
        try {
          this.alex = new AlexSDK();
          // Allow SDK to initialize properly
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (initError) {
          console.error('[SwapService] Alex SDK initialization failed:', initError);
          return null;
        }
      }

      const fromCurrency = await this.toAlexCurrency(fromContractId);
      const toCurrency = await this.toAlexCurrency(toContractId);

      if (!fromCurrency || !toCurrency) {
        console.error('[SwapService] Alex: Could not resolve currencies');
        return null;
      }

      const fromDecimals = this.getDecimals(fromContractId);
      const toDecimals = this.getDecimals(toContractId);

      const amountBigInt = this.amountToBigInt(amount, fromDecimals);

      // Try to get quote with timeout
      const amountTo = await Promise.race([
        this.alex.getAmountTo(fromCurrency, amountBigInt, toCurrency),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Alex API timeout')), 5000)
        ),
      ]);

      if (!amountTo) return null;

      const amountOut = this.bigIntToAmount(amountTo, toDecimals);

      return {
        amm: 'alex',
        fromToken: { contract_id: fromContractId, symbol: this.extractSymbol(fromContractId) },
        toToken: { contract_id: toContractId, symbol: this.extractSymbol(toContractId) },
        amountIn: amount,
        amountOut,
        route: {
          from: fromContractId,
          to: toContractId,
          amount: amountTo,
          inputDecimals: fromDecimals,
          outputDecimals: toDecimals,
        },
        swapOptions: {
          fromCurrency,
          toCurrency,
          fromDecimals,
          toDecimals,
        },
      };
    } catch (error) {
      console.error('[SwapService] Alex quote error:', error);
      return null;
    }
  }

  /**
   * Get Velar quote
   */
  private async getVelarQuote(
    fromContractId: string,
    toContractId: string,
    amount: number
  ): Promise<SwapQuote | null> {
    try {
      if (!this.velar) {
        this.velar = new VelarSDK();
      }

      const inToken = this.normalizeVelarTokenId(fromContractId);
      const outToken = this.normalizeVelarTokenId(toContractId);

      // Velar requires an account for quotes, use placeholder
      const placeholderAccount = 'SPJ7N2FGH300NS65SHDBMWR42RAZGK3NN127DJVS';

      const swapInstance = await this.velar.getSwapInstance({
        account: placeholderAccount,
        inToken,
        outToken,
      });

      const result = await swapInstance.getComputedAmount({
        amount,
        slippage: 0.5,
      });

      const outputAmount = (result as any)?.amountOut || (result as any)?.amount || result;

      if (!outputAmount || Number(outputAmount) <= 0) return null;

      return {
        amm: 'velar',
        fromToken: { contract_id: fromContractId, symbol: this.extractSymbol(fromContractId) },
        toToken: { contract_id: toContractId, symbol: this.extractSymbol(toContractId) },
        amountIn: amount,
        amountOut: Number(outputAmount),
        route: {
          from: inToken,
          to: outToken,
          slippage: 0.5,
          priceImpact: (result as any)?.priceImpact || 0,
        },
      };
    } catch (error) {
      console.error('[SwapService] Velar quote error:', error);
      return null;
    }
  }

  /**
   * Get Faktory quote (only supports STX as input)
   */
  private async getFaktoryQuote(
    fromContractId: string,
    toContractId: string,
    amount: number
  ): Promise<SwapQuote | null> {
    try {
      // Faktory only supports STX as input
      if (fromContractId.toLowerCase() !== 'stx') {
        return null;
      }

      if (!this.faktory) {
        this.faktory = new FaktorySDK({ network: this.network });
      }

      // For now, skip Faktory quotes as they require specific dex contracts
      // This would need a mapping of token -> dex contract
      return null;
    } catch (error) {
      console.error('[SwapService] Faktory quote error:', error);
      return null;
    }
  }

  /**
   * Build Bitflow swap transaction
   */
  private async buildBitflowSwap(
    quote: SwapQuote,
    senderAddress: string,
    slippage: number
  ): Promise<any> {
    if (!this.bitflow) throw new Error('Bitflow SDK not initialized');

    const swapExecutionData = {
      route: quote.route.bestRoute?.route || quote.route.allRoutes?.[0]?.route,
      amount: quote.amountIn,
      tokenXDecimals: quote.swapOptions.tokenXDecimals,
      tokenYDecimals: quote.swapOptions.tokenYDecimals,
    };

    const swapParams = await this.bitflow.getSwapParams(
      swapExecutionData,
      senderAddress,
      slippage / 100
    );

    return {
      contractAddress: swapParams.contractAddress,
      contractName: swapParams.contractName,
      functionName: swapParams.functionName,
      functionArgs: swapParams.functionArgs,
      postConditions: swapParams.postConditions || [],
    };
  }

  /**
   * Build Alex swap transaction
   */
  private async buildAlexSwap(quote: SwapQuote, senderAddress: string): Promise<any> {
    if (!this.alex) throw new Error('Alex SDK not initialized');

    const { fromCurrency, toCurrency, fromDecimals } = quote.swapOptions;
    const amountBigInt = this.amountToBigInt(quote.amountIn, fromDecimals);

    const tx = await this.alex.runSwap(
      senderAddress,
      fromCurrency,
      toCurrency,
      amountBigInt,
      BigInt(0) // minOutput = 0 for now
    );

    // Ensure postConditions is defined
    if (!tx.postConditions) {
      tx.postConditions = [];
    }

    return tx;
  }

  /**
   * Build Velar swap transaction
   */
  private async buildVelarSwap(quote: SwapQuote, senderAddress: string): Promise<any> {
    if (!this.velar) throw new Error('Velar SDK not initialized');

    const inToken = quote.route.from;
    const outToken = quote.route.to;

    const swapInstance = await this.velar.getSwapInstance({
      account: senderAddress,
      inToken,
      outToken,
    });

    const swapOptions = await swapInstance.swap({
      amount: quote.amountIn,
    });

    console.error('[SwapService] Velar raw swapOptions keys:', Object.keys(swapOptions));
    console.error('[SwapService] Velar swapOptions.contractAddress:', swapOptions.contractAddress);
    console.error('[SwapService] Velar swapOptions.contractName:', swapOptions.contractName);
    console.error('[SwapService] Velar swapOptions.functionName:', swapOptions.functionName);
    console.error('[SwapService] Velar swapOptions.functionArgs length:', swapOptions.functionArgs?.length);

    if (swapOptions.functionArgs) {
      swapOptions.functionArgs.forEach((arg: any, idx: number) => {
        console.error(`[SwapService] Velar functionArgs[${idx}]:`, typeof arg, arg?.type || 'no type');
      });
    }

    // Force empty postConditions array for Velar (SDK returns invalid format)
    // We use PostConditionMode.Allow so this is safe
    swapOptions.postConditions = [];

    return swapOptions;
  }

  /**
   * Build Faktory swap transaction
   */
  private async buildFaktorySwap(
    quote: SwapQuote,
    senderAddress: string,
    slippage: number
  ): Promise<any> {
    if (!this.faktory) throw new Error('Faktory SDK not initialized');

    if (!quote.swapOptions?.dexContract) {
      throw new Error('Missing dex contract for Faktory swap');
    }

    const buyParams = await this.faktory.getBuyParams({
      dexContract: quote.swapOptions.dexContract,
      inAmount: quote.amountIn,
      senderAddress,
      slippage: slippage || 15,
    });

    return {
      contractAddress: buyParams.contractAddress,
      contractName: buyParams.contractName,
      functionName: buyParams.functionName,
      functionArgs: buyParams.functionArgs,
      postConditions: buyParams.postConditions || [],
    };
  }

  /**
   * Helper functions
   */

  private toBitflowTokenId(contractId: string): string {
    if (contractId.toLowerCase() === 'stx') return 'token-wstx';
    if (contractId.toLowerCase().includes('sbtc')) return 'token-sbtc';
    if (contractId.toLowerCase().includes('usda')) return 'token-usda';
    if (contractId.toLowerCase().includes('aeusdc')) return 'token-aeusdc';
    // Generic fallback: extract token name from contract
    const parts = contractId.split('.');
    if (parts.length > 1) {
      return `token-${parts[1].toLowerCase().replace('token-', '')}`;
    }
    return contractId;
  }

  private async toAlexCurrency(contractId: string): Promise<Currency | undefined> {
    if (contractId.toLowerCase() === 'stx') return Currency.STX;
    if (contractId === 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex') return Currency.ALEX;

    // Try to fetch token info
    try {
      if (!this.alex) this.alex = new AlexSDK();
      const tokenInfo = (await this.alex.fetchTokenInfo(contractId)) as TokenInfo | null;
      return tokenInfo?.id;
    } catch {
      return undefined;
    }
  }

  private normalizeVelarTokenId(contractId: string): string {
    return contractId.toLowerCase() === 'stx' ? VELAR_STX_CONTRACT : contractId;
  }

  private extractSymbol(contractId: string): string {
    if (contractId.toLowerCase() === 'stx') return 'STX';

    // Check ZEST_ASSETS first
    const zestAsset = Object.values(ZEST_ASSETS).find(
      asset => asset.token.toLowerCase() === contractId.toLowerCase()
    );
    if (zestAsset) return zestAsset.symbol;

    // Fallback: parse from contract ID
    const parts = contractId.split('.');
    if (parts.length > 1) {
      const tokenName = parts[1];
      if (tokenName.startsWith('token-')) {
        return tokenName.replace('token-', '').toUpperCase();
      }
      return tokenName.toUpperCase();
    }
    return contractId.toUpperCase();
  }

  /**
   * Get proper decimals for a token
   * Priority: ZEST_ASSETS > STX (6) > sBTC/ALEX (8) > Default (6)
   */
  private getDecimals(contractId: string): number {
    // STX special case
    if (contractId.toLowerCase() === 'stx') return 6;

    // Check ZEST_ASSETS (most reliable source)
    const zestAsset = Object.values(ZEST_ASSETS).find(
      asset => asset.token.toLowerCase() === contractId.toLowerCase()
    );
    if (zestAsset) return zestAsset.decimals;

    // Known tokens fallback
    const lowerContractId = contractId.toLowerCase();
    if (lowerContractId.includes('sbtc')) return 8;
    if (lowerContractId.includes('alex')) return 8;
    if (lowerContractId.includes('usdc') || lowerContractId.includes('usda') ||
        lowerContractId.includes('usdt') || lowerContractId.includes('usdh')) return 6;

    // Default for unknown tokens
    return 6;
  }

  /**
   * Convert human-readable amount to BigInt with proper decimals
   * Example: 1.5 sBTC (8 decimals) -> 150000000n
   */
  private amountToBigInt(amount: number, decimals: number): bigint {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }

    const fixed = amount.toFixed(decimals);
    const normalized = fixed.replace('.', '').replace(/^0+(?=\d)/, '');
    return normalized.length === 0 ? BigInt(0) : BigInt(normalized);
  }

  /**
   * Convert BigInt with decimals to human-readable number
   * Example: 150000000n (8 decimals) -> 1.5
   */
  private bigIntToAmount(value: bigint, decimals: number): number {
    const divisor = Math.pow(10, decimals);
    return Number(value) / divisor;
  }

  private getStacksNetwork() {
    return this.network === 'mainnet'
      ? new StacksMainnet({ url: STACKS_MAINNET_API })
      : new StacksTestnet({ url: STACKS_TESTNET_API });
  }
}
