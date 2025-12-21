/**
 * Token Resolution Utility
 * Resolves token symbols to contract IDs and decimals
 */

import { ZEST_ASSETS } from './zest-constants.js';
import { WELL_KNOWN_TOKENS } from './constants.js';

export interface TokenInfo {
  contractId: string;
  symbol: string;
  decimals: number;
}

/**
 * Resolve a token symbol or contract ID to full token info
 * Priority: ZEST_ASSETS > WELL_KNOWN_TOKENS > Assume it's a contract ID
 */
export function resolveToken(identifier: string): TokenInfo {
  const upperIdentifier = identifier.toUpperCase();

  // Special case: STX
  if (upperIdentifier === 'STX') {
    return {
      contractId: 'STX',
      symbol: 'STX',
      decimals: 6,
    };
  }

  // Check ZEST_ASSETS first (by symbol)
  const zestAssetEntry = Object.entries(ZEST_ASSETS).find(
    ([key, asset]) => asset.symbol.toUpperCase() === upperIdentifier
  );
  if (zestAssetEntry) {
    const [, asset] = zestAssetEntry;
    return {
      contractId: asset.token,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };
  }

  // Check ZEST_ASSETS by contract ID
  const zestAssetByContract = Object.values(ZEST_ASSETS).find(
    asset => asset.token.toLowerCase() === identifier.toLowerCase()
  );
  if (zestAssetByContract) {
    return {
      contractId: zestAssetByContract.token,
      symbol: zestAssetByContract.symbol,
      decimals: zestAssetByContract.decimals,
    };
  }

  // Check WELL_KNOWN_TOKENS
  const wellKnownToken = WELL_KNOWN_TOKENS[upperIdentifier];
  if (wellKnownToken) {
    return {
      contractId: wellKnownToken.contract === 'native' ? 'STX' : wellKnownToken.contract,
      symbol: upperIdentifier,
      decimals: wellKnownToken.decimals,
    };
  }

  // Assume it's already a contract ID
  // Try to extract symbol from contract
  const parts = identifier.split('.');
  const symbol = parts.length > 1
    ? parts[1].replace('token-', '').replace('-token', '').toUpperCase()
    : identifier.toUpperCase();

  return {
    contractId: identifier,
    symbol,
    decimals: 6, // Default decimals
  };
}

/**
 * Get contract ID from token symbol or contract
 */
export function getContractId(identifier: string): string {
  return resolveToken(identifier).contractId;
}

/**
 * Get decimals for a token
 */
export function getTokenDecimals(identifier: string): number {
  return resolveToken(identifier).decimals;
}

/**
 * Get symbol for a token
 */
export function getTokenSymbol(identifier: string): string {
  return resolveToken(identifier).symbol;
}
