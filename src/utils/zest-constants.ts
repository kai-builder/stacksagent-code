/**
 * Zest Protocol Constants
 * Contract addresses and configurations for Zest lending protocol on Stacks mainnet
 */

export const ZEST_CONTRACTS = {
  // Main entry point for borrow/supply operations
  borrowHelper: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.borrow-helper-v2-1-7',

  // Supporting contracts
  poolReserve: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.pool-0-reserve-v2-0',
  feeCalculator: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.fees-calculator',
  incentives: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.incentives-v2-2',
};

export interface ZestAssetConfig {
  token: string;
  lpToken: string;
  oracle: string;
  decimals: number;
  symbol: string;
}

export const ZEST_ASSETS: { [key: string]: ZestAssetConfig } = {
  sbtc: {
    token: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4',
    decimals: 8,
    symbol: 'sBTC',
  },
  aeusdc: {
    token: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zaeusdc-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.aeusdc-oracle-v1-0',
    decimals: 6,
    symbol: 'aeUSDC',
  },
  usdh: {
    token: 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusdh-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usdh-oracle-v1-0',
    decimals: 8,
    symbol: 'USDH',
  },
  ststx: {
    token: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststx-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4',
    decimals: 6,
    symbol: 'stSTX',
  },
  wstx: {
    token: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.wstx',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zwstx-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4',
    decimals: 6,
    symbol: 'wSTX',
  },
  susdt: {
    token: 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsusdt-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.susdt-oracle-v1-0',
    decimals: 6,
    symbol: 'sUSDT',
  },
  usda: {
    token: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zusda-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.usda-oracle-v1-1',
    decimals: 6,
    symbol: 'USDA',
  },
  diko: {
    token: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zdiko-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.diko-oracle-v1-1',
    decimals: 6,
    symbol: 'DIKO',
  },
  alex: {
    token: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zalex-v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.alex-oracle-v1-1',
    decimals: 8,
    symbol: 'ALEX',
  },
  ststxbtc: {
    token: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2',
    lpToken: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0',
    oracle: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.stx-btc-oracle-v1-4',
    decimals: 6,
    symbol: 'stSTX-BTC',
  },
};

// Assets list in the format required by Zest borrow/withdraw functions
export const ZEST_ASSETS_LIST = [
  { asset: ZEST_ASSETS.ststx.token, lpToken: ZEST_ASSETS.ststx.lpToken, oracle: ZEST_ASSETS.ststx.oracle },
  { asset: ZEST_ASSETS.aeusdc.token, lpToken: ZEST_ASSETS.aeusdc.lpToken, oracle: ZEST_ASSETS.aeusdc.oracle },
  { asset: ZEST_ASSETS.wstx.token, lpToken: ZEST_ASSETS.wstx.lpToken, oracle: ZEST_ASSETS.wstx.oracle },
  { asset: ZEST_ASSETS.diko.token, lpToken: ZEST_ASSETS.diko.lpToken, oracle: ZEST_ASSETS.diko.oracle },
  { asset: ZEST_ASSETS.usdh.token, lpToken: ZEST_ASSETS.usdh.lpToken, oracle: ZEST_ASSETS.usdh.oracle },
  { asset: ZEST_ASSETS.susdt.token, lpToken: ZEST_ASSETS.susdt.lpToken, oracle: ZEST_ASSETS.susdt.oracle },
  { asset: ZEST_ASSETS.usda.token, lpToken: ZEST_ASSETS.usda.lpToken, oracle: ZEST_ASSETS.usda.oracle },
  { asset: ZEST_ASSETS.sbtc.token, lpToken: ZEST_ASSETS.sbtc.lpToken, oracle: ZEST_ASSETS.sbtc.oracle },
  { asset: ZEST_ASSETS.alex.token, lpToken: ZEST_ASSETS.alex.lpToken, oracle: ZEST_ASSETS.alex.oracle },
  { asset: ZEST_ASSETS.ststxbtc.token, lpToken: ZEST_ASSETS.ststxbtc.lpToken, oracle: ZEST_ASSETS.ststxbtc.oracle },
];

// Pyth price feed IDs for Hermes API
export const PYTH_PRICE_FEED_IDS = {
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  STX_USD: '0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17',
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

export const PYTH_HERMES_URL = 'https://hermes.pyth.network';

// Zest protocol parameters
export const ZEST_PARAMS = {
  // Max uint for "repay all"
  MAX_UINT: '340282366920938463463374607431768211455',

  // Liquidation threshold for sBTC (80%)
  LIQUIDATION_THRESHOLD: 0.8,

  // Default target leverage for BoostBTC
  DEFAULT_LEVERAGE: 1.5,

  // Default slippage for swaps
  DEFAULT_SLIPPAGE: 0.5,
};

// Supported collateral assets (can be supplied)
export const ZEST_COLLATERAL_ASSETS = ['sbtc', 'ststx', 'wstx'] as const;

// Supported borrow assets (can be borrowed)
export const ZEST_BORROW_ASSETS = ['aeusdc', 'usdh', 'susdt', 'usda'] as const;

export type ZestCollateralAsset = typeof ZEST_COLLATERAL_ASSETS[number];
export type ZestBorrowAsset = typeof ZEST_BORROW_ASSETS[number];
