import { Config } from '../types/index.js';
import { homedir } from 'os';
import { join } from 'path';

export const DEFAULT_CONFIG_DIR = join(homedir(), '.stacks-mcp');
export const DEFAULT_KEYSTORE_PATH = join(DEFAULT_CONFIG_DIR, 'wallet.enc'); // DEPRECATED - kept for backward compatibility
export const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.json');

// Multi-wallet paths
export const WALLETS_DIR = join(DEFAULT_CONFIG_DIR, 'wallets');
export const WALLET_INDEX_PATH = join(DEFAULT_CONFIG_DIR, 'wallets.json');

// BIP44 constants
export const BIP44_STACKS_COIN_TYPE = 5757;

export const DEFAULT_CONFIG: Config = {
  network: 'mainnet',
  wallet: {
    keystorePath: DEFAULT_KEYSTORE_PATH, // DEPRECATED - kept for backward compatibility
    walletsDir: WALLETS_DIR,
    autoLockMinutes: 15,
  },
  activeSession: {
    walletId: null,
    accountIndex: 0,
    network: 'mainnet',
  },
  rpc: {
    primary: 'https://api.hiro.so',
    fallback: 'https://api.mainnet.hiro.so',
  },
  trading: {
    defaultSlippage: 0.5,
    maxSlippage: 5.0,
    preferredDex: 'auto',
  },
  limits: {
    maxSingleTxUsd: 1000,
    dailyTxLimitUsd: 5000,
    requireConfirmation: true,
  },
  protocols: {
    alex: { enabled: true },
    velar: { enabled: true },
    bitflow: { enabled: true },
    zest: { enabled: true },
    granite: { enabled: false },
  },
};

// Stacks network endpoints
export const STACKS_MAINNET_API = 'https://api.hiro.so';
export const STACKS_TESTNET_API = 'https://api.testnet.hiro.so';

// API endpoints
export const COINGECKO_API = 'https://api.coingecko.com/api/v3';
export const DEFILLAMA_API = 'https://api.llama.fi';

// Well-known token contracts on Stacks mainnet
export const WELL_KNOWN_TOKENS: { [key: string]: { contract: string; decimals: number } } = {
  STX: { contract: 'native', decimals: 6 },
  WELSH: { contract: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', decimals: 6 },
  USDA: { contract: 'SP2C2YFP12AJZB4MABJBST4K0HEYNH3YAJ7J6V0Z.usda-token', decimals: 6 },
  sBTC: { contract: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-sbtc', decimals: 8 },
};

// DEX contract addresses
export const DEX_CONTRACTS = {
  alex: {
    router: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-swap-pool',
    factory: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-registry',
  },
  velar: {
    router: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core',
    factory: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-factory',
  },
};

// Minimum stacking amount (in microSTX)
export const MIN_STACKING_AMOUNT = 100000000000; // 100,000 STX

// Encryption parameters
export const SCRYPT_PARAMS = {
  N: 16384, // 2^14 - reduced for OpenSSL memory limits in containerized environments
  r: 8,
  p: 1,
  dklen: 32,
};
