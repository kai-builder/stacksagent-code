import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostCondition,
  PostConditionMode,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { BitflowSDK } from '@bitflowlabs/core-sdk';
import { SwapQuote, SwapResult } from '../types/index.js';
import { PriceService } from './price.js';
import { StacksApiClient } from './stacks-api.js';
import { WELL_KNOWN_TOKENS, STACKS_MAINNET_API, STACKS_TESTNET_API } from '../utils/constants.js';

interface BitflowTokenInfo {
  tokenId: string;
  tokenContract: string | null;
  tokenDecimals: number;
  symbol: string;
}

interface BitflowQuoteRoute {
  quote: number | null;
  route: any;
  tokenXDecimals: number;
  tokenYDecimals: number;
  dexPath: string[];
}

interface BitflowConfig {
  BITFLOW_API_HOST: string;
  BITFLOW_API_KEY?: string;
  BITFLOW_PROVIDER_ADDRESS?: string;
  READONLY_CALL_API_HOST: string;
  READONLY_CALL_API_KEY?: string;
  KEEPER_API_HOST: string;
  KEEPER_API_KEY?: string;
}

export class DexService {
  private priceService: PriceService;
  private apiClient: StacksApiClient;
  private network: 'mainnet' | 'testnet';
  private bitflow?: BitflowSDK;
  private bitflowInitPromise?: Promise<void>;
  private readonly bitflowTokensBySymbol = new Map<string, BitflowTokenInfo>();
  private readonly bitflowTokensByContract = new Map<string, BitflowTokenInfo>();
  private readonly bitflowConfig: BitflowConfig;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    this.priceService = new PriceService();
    this.apiClient = new StacksApiClient(network);
    this.bitflowConfig = this.createBitflowConfig();
  }

  /**
   * Gets a swap quote using Bitflow first, falling back to price-derived estimation
   */
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    preferredDex: string = 'auto'
  ): Promise<SwapQuote> {
    const amountNumeric = this.parseAmount(amount);

    try {
      const { fromTokenInfo, toTokenInfo } = await this.resolveBitflowTokens(fromToken, toToken);
      const bitflowRoute = await this.getBitflowRoute(fromTokenInfo, toTokenInfo, amountNumeric);
      const toAmountValue = bitflowRoute.quote ?? 0;
      const rate = amountNumeric > 0 ? toAmountValue / amountNumeric : 0;

      return {
        fromToken: fromTokenInfo.symbol,
        toToken: toTokenInfo.symbol,
        fromAmount: amountNumeric.toString(),
        toAmount: this.formatNumber(toAmountValue, Math.min(toTokenInfo.tokenDecimals, 6)),
        rate: this.formatNumber(rate, 8),
        slippage: 1,
        fee: 'variable',
        route: bitflowRoute.dexPath.length
          ? bitflowRoute.dexPath
          : [fromTokenInfo.symbol, toTokenInfo.symbol],
        protocol: 'bitflow',
      };
    } catch (error) {
      console.warn('[DexService] Bitflow quote failed, falling back to price estimation:', error);
      return this.getFallbackQuote(fromToken, toToken, amountNumeric, preferredDex);
    }
  }

  /**
   * Executes a swap by building and broadcasting the Bitflow-generated contract call
   */
  async executeSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number,
    privateKey: string,
    senderAddress: string
  ): Promise<SwapResult> {
    const amountNumeric = this.parseAmount(amount);
    const { fromTokenInfo, toTokenInfo } = await this.resolveBitflowTokens(fromToken, toToken);

    if (!this.bitflow) {
      await this.ensureBitflowClient();
    }

    if (!this.bitflow) {
      throw new Error('Bitflow SDK could not be initialized');
    }

    const quote = await this.getBitflowRoute(fromTokenInfo, toTokenInfo, amountNumeric);

    const swapExecutionData = {
      route: quote.route,
      amount: amountNumeric,
      tokenXDecimals: fromTokenInfo.tokenDecimals,
      tokenYDecimals: toTokenInfo.tokenDecimals,
    };

    const swapParams = await this.bitflow.getSwapParams(
      swapExecutionData,
      senderAddress,
      (slippage || 1) / 100
    );

    const fee = await this.estimateFee();
    const network = this.getStacksNetwork();

    const transaction = await makeContractCall({
      contractAddress: swapParams.contractAddress,
      contractName: swapParams.contractName,
      functionName: swapParams.functionName,
      functionArgs: swapParams.functionArgs,
      senderKey: privateKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode:
        swapParams.postConditions && swapParams.postConditions.length > 0
          ? PostConditionMode.Deny
          : PostConditionMode.Allow,
      postConditions: (swapParams.postConditions || []) as PostCondition[],
      fee,
    });

    const broadcastResponse = await broadcastTransaction(transaction, network);
    const txId = typeof broadcastResponse === 'string' ? broadcastResponse : broadcastResponse.txid;

    if (!txId) {
      throw new Error('Swap broadcast failed without a transaction id');
    }
    const toAmountValue = quote.quote ?? 0;

    return {
      txHash: txId,
      status: 'pending',
      fromToken: fromTokenInfo.symbol,
      toToken: toTokenInfo.symbol,
      fromAmount: amountNumeric.toString(),
      toAmount: this.formatNumber(toAmountValue, Math.min(toTokenInfo.tokenDecimals, 6)),
    };
  }

  async addLiquidity(
    _poolId: string,
    _amountA: string,
    _amountB: string,
    _privateKey: string,
    _senderAddress: string
  ): Promise<{ txHash: string; lpTokens: string }> {
    throw new Error('Adding liquidity is not supported by this MCP server yet.');
  }

  async removeLiquidity(
    _poolId: string,
    _lpAmount: string,
    _privateKey: string,
    _senderAddress: string
  ): Promise<{ txHash: string; amountA: string; amountB: string }> {
    throw new Error('Removing liquidity is not supported by this MCP server yet.');
  }

  /**
   * -------------------------
   * Internal helpers
   * -------------------------
   */

  private async getFallbackQuote(
    fromToken: string,
    toToken: string,
    amount: number,
    preferredDex: string
  ): Promise<SwapQuote> {
    const fromUpper = fromToken.toUpperCase();
    const toUpper = toToken.toUpperCase();
    const fromInfo = WELL_KNOWN_TOKENS[fromUpper];
    const toInfo = WELL_KNOWN_TOKENS[toUpper];

    if (!fromInfo || !toInfo) {
      throw new Error(`Unknown token: ${!fromInfo ? fromToken : toToken}`);
    }

    const fromPrice = await this.priceService.getPrice(fromUpper);
    const toPrice = await this.priceService.getPrice(toUpper);

    const fromValueUsd = amount * fromPrice.priceUsd;
    const toAmount = fromValueUsd / toPrice.priceUsd;
    const toAmountAfterFee = toAmount * 0.997;
    const fee = amount * 0.003;
    const rate = amount > 0 ? toAmountAfterFee / amount : 0;
    const protocol = preferredDex === 'auto' ? 'alex' : preferredDex;

    return {
      fromToken: fromUpper,
      toToken: toUpper,
      fromAmount: amount.toString(),
      toAmount: toAmountAfterFee.toFixed(toInfo.decimals),
      rate: rate.toFixed(8),
      slippage: 0.5,
      fee: fee.toFixed(fromInfo.decimals),
      route: [fromUpper, toUpper],
      protocol,
    };
  }

  private createBitflowConfig(): BitflowConfig {
    const apiKey = process.env.BITFLOW_API_KEY || '';
    const keeperKey = process.env.BITFLOW_KEEPER_API_KEY || apiKey;
    const readonlyHost =
      process.env.BITFLOW_READONLY_HOST ||
      (this.network === 'mainnet' ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so');

    return {
      BITFLOW_API_HOST: process.env.BITFLOW_API_HOST || 'https://api.bitflowapis.finance',
      BITFLOW_API_KEY: apiKey,
      BITFLOW_PROVIDER_ADDRESS: process.env.BITFLOW_PROVIDER_ADDRESS || '',
      READONLY_CALL_API_HOST: readonlyHost,
      READONLY_CALL_API_KEY: process.env.BITFLOW_READONLY_KEY || apiKey,
      KEEPER_API_HOST: process.env.BITFLOW_KEEPER_API_HOST || 'https://keeper.bitflowapis.finance',
      KEEPER_API_KEY: keeperKey,
    };
  }

  private async ensureBitflowClient(): Promise<void> {
    if (this.bitflowInitPromise) {
      return this.bitflowInitPromise;
    }

    const infoFromContract = (contract?: string | null) =>
      contract?.split('.')?.[1]?.toUpperCase() || 'TOKEN';

    this.bitflowInitPromise = (async () => {
      this.bitflow = new BitflowSDK(this.bitflowConfig);
      const tokens = await this.bitflow.getAvailableTokens();
      tokens.forEach(token => {
        if (!token.tokenId && !(token as any)['token-id']) return;
        const info: BitflowTokenInfo = {
          tokenId: token.tokenId || (token as any)['token-id'],
          tokenContract:
            token.tokenContract && token.tokenContract !== 'null' ? token.tokenContract : null,
          tokenDecimals: typeof token.tokenDecimals === 'number' ? token.tokenDecimals : 6,
          symbol: token.symbol?.toUpperCase() || token.tokenName || infoFromContract(token.tokenContract),
        };

        if (info.symbol) {
          this.bitflowTokensBySymbol.set(info.symbol, info);
        }
        if (info.tokenContract) {
          this.bitflowTokensByContract.set(info.tokenContract.toLowerCase(), info);
        }
      });
    })();

    await this.bitflowInitPromise;
  }

  private async resolveBitflowTokens(
    fromToken: string,
    toToken: string
  ): Promise<{ fromTokenInfo: BitflowTokenInfo; toTokenInfo: BitflowTokenInfo }> {
    await this.ensureBitflowClient();
    if (!this.bitflow) {
      throw new Error('Bitflow SDK unavailable');
    }

    const fromTokenInfo = await this.findBitflowToken(fromToken);
    const toTokenInfo = await this.findBitflowToken(toToken);

    if (!fromTokenInfo || !toTokenInfo) {
      throw new Error(`Unsupported token pair: ${fromToken} → ${toToken}`);
    }

    return { fromTokenInfo, toTokenInfo };
  }

  private async findBitflowToken(identifier: string): Promise<BitflowTokenInfo | null> {
    const normalized = identifier.toUpperCase();
    const symbolMatch = this.bitflowTokensBySymbol.get(normalized);
    if (symbolMatch) return symbolMatch;

    const lowerId = identifier.toLowerCase();
    const contractMatch = this.bitflowTokensByContract.get(lowerId);
    if (contractMatch) return contractMatch;

    const wellKnown = WELL_KNOWN_TOKENS[normalized];
    if (wellKnown && wellKnown.contract && wellKnown.contract !== 'native') {
      return this.bitflowTokensByContract.get(wellKnown.contract.toLowerCase()) || null;
    }

    if (normalized === 'STX') {
      return this.bitflowTokensBySymbol.get('STX') || null;
    }

    return null;
  }

  private async getBitflowRoute(
    fromTokenInfo: BitflowTokenInfo,
    toTokenInfo: BitflowTokenInfo,
    amount: number
  ): Promise<BitflowQuoteRoute> {
    if (!this.bitflow) {
      await this.ensureBitflowClient();
    }

    if (!this.bitflow) {
      throw new Error('Bitflow SDK not initialized');
    }

    const quoteResult = await this.bitflow.getQuoteForRoute(
      fromTokenInfo.tokenId,
      toTokenInfo.tokenId,
      amount
    );

    const best = quoteResult.bestRoute || quoteResult.allRoutes.find(route => route.quote);
    if (!best || !best.route) {
      throw new Error('No liquid route found for requested pair');
    }

    return {
      quote: best.quote,
      route: best.route,
      tokenXDecimals: best.tokenXDecimals ?? fromTokenInfo.tokenDecimals,
      tokenYDecimals: best.tokenYDecimals ?? toTokenInfo.tokenDecimals,
      dexPath: best.dexPath || best.route.dex_path || [],
    };
  }

  private parseAmount(amount: string): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return parsed;
  }

  private formatNumber(value: number, decimals: number): string {
    const precision = Math.min(Math.max(decimals, 2), 8);
    return Number(value).toFixed(precision).replace(/\.?0+$/, '');
  }

  private async estimateFee(): Promise<number> {
    try {
      const fee = await this.apiClient.getFeeEstimate();
      return Math.max(fee, 800);
    } catch {
      return 5000;
    }
  }

  private getStacksNetwork() {
    return this.network === 'mainnet'
      ? new StacksMainnet({ url: STACKS_MAINNET_API })
      : new StacksTestnet({ url: STACKS_TESTNET_API });
  }
}
