/**
 * Core module - Pure business logic for Stacks blockchain operations
 *
 * This module exports all service classes and can be used by:
 * - MCP server (stdio interface for Claude Desktop)
 * - HTTP API (Express server for web applications)
 * - Direct imports in other applications
 */

// Import services for local use in createServices
import { WalletService as _WalletService } from './wallet.js';
import { PriceService as _PriceService } from './price.js';
import { DexService as _DexService } from './dex.js';
import { StackingService as _StackingService } from './stacking.js';
import { PortfolioService as _PortfolioService } from './portfolio.js';
import { BnsService as _BnsService } from './bns.js';
import { ClarityService as _ClarityService } from './clarity.js';
import { ZestService as _ZestService } from './zest.js';
import { SwapService as _SwapService } from './swap.js';
import { PythService as _PythService } from './pyth.js';
import { BoostService as _BoostService } from './boost.js';

// Service exports
export { WalletService } from './wallet.js';
export { PriceService } from './price.js';
export { DexService } from './dex.js';
export { StackingService } from './stacking.js';
export { PortfolioService } from './portfolio.js';
export { BnsService } from './bns.js';
export { ClarityService } from './clarity.js';
export { ZestService } from './zest.js';
export { SwapService } from './swap.js';
export { PythService } from './pyth.js';
export { BoostService } from './boost.js';
export { StacksApiClient } from './stacks-api.js';
export { WalletMigration } from './wallet-migration.js';

// Re-export types for convenience
export type {
  WalletInfo,
  WalletBalance,
  TokenBalance,
  Account,
  WalletMetadata,
  EncryptedKeystore,
  EncryptedWalletKeystore,
  PriceData,
  SwapQuote,
  SwapResult,
  PoolInfo,
  TokenMarketSummary,
  StackingInfo,
  StackingStatus,
  PortfolioSummary,
  DefiPosition,
  Transaction,
  ClarityContract,
  ContractAnalysis,
  AuditReport,
  SecurityIssue,
  BestPracticeIssue,
  OptimizationSuggestion,
  ContractGenerationOptions,
  Config,
} from '../types/index.js';

// Re-export config manager
export { configManager } from '../utils/config.js';

// Re-export constants
export {
  STACKS_MAINNET_API,
  STACKS_TESTNET_API,
  WELL_KNOWN_TOKENS,
  MIN_STACKING_AMOUNT,
} from '../utils/constants.js';

/**
 * Service factory - creates all services with a given network configuration
 */
export interface ServiceFactoryOptions {
  network?: 'mainnet' | 'testnet';
}

export interface Services {
  wallet: _WalletService;
  price: _PriceService;
  dex: _DexService;
  stacking: _StackingService;
  portfolio: _PortfolioService;
  bns: _BnsService;
  clarity: _ClarityService;
  zest: _ZestService;
  swap: _SwapService;
  pyth: _PythService;
  boost: _BoostService;
}

/**
 * Creates all service instances with the given configuration
 */
export function createServices(options: ServiceFactoryOptions = {}): Services {
  const network = options.network || 'mainnet';

  const wallet = new _WalletService();
  const price = new _PriceService();
  const dex = new _DexService(network);
  const stacking = new _StackingService(network);
  const portfolio = new _PortfolioService(wallet, network);
  const bns = new _BnsService(network);
  const clarity = new _ClarityService(network);
  const zest = new _ZestService(network);
  const swap = new _SwapService(network);
  const pyth = new _PythService();
  const boost = new _BoostService(network);

  return {
    wallet,
    price,
    dex,
    stacking,
    portfolio,
    bns,
    clarity,
    zest,
    swap,
    pyth,
    boost,
  };
}
