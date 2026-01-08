import axios, { AxiosInstance } from 'axios';
import { PriceData, PoolInfo, TokenMarketSummary } from '../types/index.js';
import { COINGECKO_API, DEFILLAMA_API } from '../utils/constants.js';

const STXTOOLS_API = 'https://api.stxtools.io';
const BITFLOW_API = 'https://app.bitflow.finance/api';
const VELAR_POOL_API = 'https://gateway.velar.network/watcherapp/pool';
const ALEX_API_BASE = 'https://api.alexgo.io';

// CoinGecko token IDs for Stacks ecosystem
const COINGECKO_IDS: { [key: string]: string } = {
  STX: 'blockstack',
  WELSH: 'welsh-corgi-coin',
  sBTC: 'sbtc',
  USDA: 'usda',
};

export class PriceService {
  private coingeckoClient: AxiosInstance;
  private defillamaClient: AxiosInstance;
  private stxToolsClient: AxiosInstance;
  private priceCache: Map<string, { data: PriceData; timestamp: number }>;
  private tokenCache: { data: TokenMarketSummary[]; timestamp: number } | null = null;
  private cacheDuration: number = 60000; // 1 minute cache
  private defaultHeaders: Record<string, string> = {
    'User-Agent': 'StacksAgent-MCP/1.0 (+stacksagent-mcp)',
  };

  constructor() {
    this.coingeckoClient = axios.create({
      baseURL: COINGECKO_API,
      timeout: 5000,
    });

    this.defillamaClient = axios.create({
      baseURL: DEFILLAMA_API,
      timeout: 5000,
    });

    this.stxToolsClient = axios.create({
      baseURL: STXTOOLS_API,
      timeout: 8000,
      headers: this.defaultHeaders,
    });

    this.priceCache = new Map();
  }

  /**
   * Gets current price for a token
   */
  async getPrice(symbol: string): Promise<PriceData> {
    const upperSymbol = symbol.toUpperCase();

    // Check cache first
    const cached = this.priceCache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    // Get CoinGecko ID
    const coingeckoId = COINGECKO_IDS[upperSymbol];
    if (!coingeckoId) {
      throw new Error(`Price data not available for ${symbol}`);
    }

    try {
      const response = await this.coingeckoClient.get('/simple/price', {
        params: {
          ids: coingeckoId,
          vs_currencies: 'usd',
          include_24hr_change: true,
        },
      });

      const data = response.data[coingeckoId];
      if (!data) {
        throw new Error(`No price data found for ${symbol}`);
      }

      const priceData: PriceData = {
        symbol: upperSymbol,
        priceUsd: data.usd,
        change24h: data.usd_24h_change || 0,
        lastUpdated: Date.now(),
      };

      // Calculate price in STX if not STX itself
      if (upperSymbol !== 'STX') {
        const stxPrice = await this.getPrice('STX');
        priceData.priceStx = priceData.priceUsd / stxPrice.priceUsd;
      }

      // Cache the result
      this.priceCache.set(upperSymbol, { data: priceData, timestamp: Date.now() });

      return priceData;
    } catch (error: any) {
      throw new Error(`Failed to fetch price for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Gets multiple token prices at once
   */
  async getPrices(symbols: string[]): Promise<PriceData[]> {
    const prices: PriceData[] = [];

    for (const symbol of symbols) {
      try {
        const price = await this.getPrice(symbol);
        prices.push(price);
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
      }
    }

    return prices;
  }

  /**
   * Gets pool information from various DEXs
   */
  async getPools(protocol?: string, limit: number = 20): Promise<PoolInfo[]> {
    const normalized = protocol ? protocol.toLowerCase() : undefined;
    const protocolsToFetch = normalized ? [normalized] : ['alex', 'velar', 'bitflow'];
    const pools: PoolInfo[] = [];
    const errors: string[] = [];

    for (const proto of protocolsToFetch) {
      try {
        switch (proto) {
          case 'alex':
            pools.push(...await this.fetchAlexPools());
            break;
          case 'velar':
            pools.push(...await this.fetchVelarPools());
            break;
          case 'bitflow':
            pools.push(...await this.fetchBitflowPools());
            break;
          default:
            errors.push(`Unsupported protocol: ${proto}`);
        }
      } catch (error: any) {
        errors.push(`${proto}: ${error?.message || error}`);
      }
    }

    if (pools.length === 0) {
      throw new Error(
        errors.length
          ? `Failed to load pools (${errors.join('; ')})`
          : 'No pool data available'
      );
    }

    const sorted = pools.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
    const effectiveLimit = Math.max(1, limit);
    return sorted.slice(0, effectiveLimit);
  }

  /**
   * Gets trending tokens
   */
  async getTrendingTokens(
    limit: number = 10,
    filter: 'trending' | 'new' | 'volume' = 'trending'
  ): Promise<TokenMarketSummary[]> {
    try {
      const now = Date.now();
      if (!this.tokenCache || now - this.tokenCache.timestamp > this.cacheDuration) {
        const tokens = await this.fetchTokenMarketData();
        this.tokenCache = { data: tokens, timestamp: now };
      }

      const sorted = this.sortTokenMarketData(this.tokenCache.data, filter);
      return sorted.slice(0, limit);
    } catch (error: any) {
      throw new Error(`Failed to fetch trending tokens: ${error.message}`);
    }
  }

  /**
   * Clears price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    this.tokenCache = null;
  }

  private async fetchTokenMarketData(minLiquidity: number = 500): Promise<TokenMarketSummary[]> {
    const response = await this.stxToolsClient.get('/tokens', {
      params: {
        page: 0,
        size: 200,
        minLiquidity,
      },
    });

    const tokens: any[] = Array.isArray(response.data?.data) ? response.data.data : [];

    return tokens.map((token: any) => {
      const metrics = token.metrics || {};
      const deployedAt =
        typeof token.deployed_at === 'number'
          ? new Date(token.deployed_at * 1000).toISOString()
          : null;

      return {
        symbol: token.symbol || this.deriveSymbolFromContract(token.contract_id),
        name: token.name || token.symbol || token.contract_id,
        contractId: token.contract_id,
        priceUsd: this.toNumber(metrics.price_usd),
        change24h: this.toNumber(metrics.price_change_1d),
        liquidityUsd: this.toNumber(metrics.liquidity_usd),
        volume24hUsd: this.toNumber(metrics.volume_1d_usd),
        holders:
          typeof metrics.holder_count === 'number' ? metrics.holder_count : null,
        deployedAt,
        description: token.description || null,
      };
    });
  }

  private sortTokenMarketData(
    tokens: TokenMarketSummary[],
    filter: 'trending' | 'new' | 'volume'
  ): TokenMarketSummary[] {
    const copy = [...tokens];
    switch (filter) {
      case 'new':
        return copy.sort(
          (a, b) => this.toTimestamp(b.deployedAt) - this.toTimestamp(a.deployedAt)
        );
      case 'volume':
        return copy.sort(
          (a, b) =>
            (b.volume24hUsd || 0) - (a.volume24hUsd || 0) ||
            (b.liquidityUsd || 0) - (a.liquidityUsd || 0)
        );
      default:
        return copy.sort(
          (a, b) => this.computeTrendScore(b) - this.computeTrendScore(a)
        );
    }
  }

  private computeTrendScore(token: TokenMarketSummary): number {
    const volumeScore =
      token.volume24hUsd && token.volume24hUsd > 0
        ? Math.log10(token.volume24hUsd + 1)
        : 0;
    const liquidityScore =
      token.liquidityUsd && token.liquidityUsd > 0
        ? Math.log10(token.liquidityUsd + 1) * 0.5
        : 0;
    const changeScore = token.change24h ? token.change24h / 10 : 0;
    return volumeScore + liquidityScore + changeScore;
  }

  private toTimestamp(value?: string | null): number {
    if (!value) return 0;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : 0;
  }

  private deriveSymbolFromContract(contractId: string): string {
    if (!contractId) return 'TOKEN';
    const suffix = contractId.split('.').pop() || contractId;
    const cleaned = suffix.replace(/[-_]?token/gi, '').replace(/[^a-zA-Z0-9]/g, '');
    return cleaned ? cleaned.toUpperCase() : contractId.toUpperCase();
  }

  private normalizeLiquiditySymbol(
    token?: string | null,
    fallback?: string | null
  ): string {
    if (token && typeof token === 'string') {
      const cleaned = token
        .replace(/^token[-_]?/i, '')
        .replace(/[-_]?token$/i, '')
        .replace(/[^a-zA-Z0-9]/g, '');
      if (cleaned) {
        return cleaned.toUpperCase();
      }
    }
    if (fallback) {
      return fallback.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'TOKEN';
    }
    return 'TOKEN';
  }

  private async fetchBitflowPools(): Promise<PoolInfo[]> {
    const [poolsRes, apyRes, tickerRes] = await Promise.all([
      axios.get(`${BITFLOW_API}/sdk/get-pools-and-earn`, {
        timeout: 10000,
        headers: this.defaultHeaders,
      }),
      axios.get(`${BITFLOW_API}/apy-v2`, {
        timeout: 10000,
        headers: this.defaultHeaders,
      }),
      axios.get(`${BITFLOW_API}/ticker`, {
        timeout: 10000,
        headers: this.defaultHeaders,
      }),
    ]);

    const pools: any[] = Array.isArray(poolsRes.data?.data) ? poolsRes.data.data : [];
    const apyMap: Record<string, { apy?: number | null }> =
      apyRes.data?.data?.pools ?? {};
    const tickerEntries: any[] = Array.isArray(tickerRes.data) ? tickerRes.data : [];
    const tickerMap = new Map<string, any>();

    for (const entry of tickerEntries) {
      const key =
        entry?.pool_id ??
        entry?.poolId ??
        entry?.poolContract ??
        entry?.contract;
      if (key) {
        tickerMap.set(String(key), entry);
      }
    }

    return pools
      .map((pool: any) => {
        const poolId =
          pool?.poolContract ||
          pool?.contract ||
          (pool?.poolId ? String(pool.poolId) : null);
        if (!poolId) {
          return null;
        }

        const candidateKeys = ([
          pool.poolContract,
          pool.contract,
          pool.assetName,
          pool.symbol,
          pool.poolId ? String(pool.poolId) : null,
          pool.poolContract ? pool.poolContract.split('.').pop() : null,
        ].filter(Boolean) as string[]);

        let apyValue: number | null = null;
        for (const key of candidateKeys) {
          const entry = apyMap[key];
          if (entry && entry.apy !== undefined && entry.apy !== null) {
            apyValue = Number(entry.apy);
            break;
          }
        }
        if (apyValue === null && pool?.calculatedData?.avgApy !== undefined) {
          apyValue = Number(pool.calculatedData.avgApy);
        }

        const ticker =
          tickerMap.get(pool.poolContract) ||
          tickerMap.get(pool.contract) ||
          tickerMap.get(pool.poolId ? String(pool.poolId) : '');

        let volumeUsd: number | null = null;
        if (ticker) {
          const baseVolume = this.toNumber(ticker.base_volume);
          const targetVolume = this.toNumber(ticker.target_volume);
          if (baseVolume !== null || targetVolume !== null) {
            volumeUsd = (baseVolume || 0) + (targetVolume || 0);
          } else if (ticker.volume) {
            volumeUsd = this.toNumber(ticker.volume);
          }
        }

        const tvlUsd = this.toNumber(pool?.calculatedData?.tvl_usd);
        const tokenParts = typeof pool.symbol === 'string' ? pool.symbol.split('-') : [];
        const tokenA = this.normalizeLiquiditySymbol(pool.tokenX, tokenParts[0]);
        const tokenB = this.normalizeLiquiditySymbol(pool.tokenY, tokenParts[1]);

        return {
          poolId,
          protocol: 'bitflow',
          tokenA,
          tokenB,
          apy: apyValue,
          tvl: tvlUsd,
          volume24h: volumeUsd,
        } as PoolInfo;
      })
      .filter((pool): pool is PoolInfo => !!pool);
  }

  private async fetchVelarPools(): Promise<PoolInfo[]> {
    const response = await axios.get(VELAR_POOL_API, {
      timeout: 10000,
      headers: this.defaultHeaders,
    });

    const pools: any[] = Array.isArray(response.data?.message)
      ? response.data.message
      : [];

    return pools
      .map((pool: any) => {
        const poolId =
          pool?.poolContractAddress || pool?._id || pool?.symbol || pool?.id;
        if (!poolId) {
          return null;
        }
        return {
          poolId,
          protocol: 'velar',
          tokenA: pool?.token0Symbol || 'TOKEN0',
          tokenB: pool?.token1Symbol || 'TOKEN1',
          apy: null,
          tvl: this.toNumber(pool?.stats?.tvl?.value),
          volume24h: this.toNumber(pool?.stats?.volume?.value),
        } as PoolInfo;
      })
      .filter((pool): pool is PoolInfo => !!pool);
  }

  private normalizeAlexSymbol(token?: string | null): string | null {
    if (!token) return null;
    const parts = token.split('.');
    let raw = parts[parts.length - 1] || token;
    raw = raw.replace(/token[-_]?/i, '');
    raw = raw.replace(/^[^.]*\./, '');
    const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
    if (!cleaned) return token.toUpperCase();
    return cleaned.toUpperCase().replace(/\s+/g, '-');
  }

  private buildAlexTickerKey(base?: string | null, quote?: string | null): string | null {
    if (!base || !quote) return null;
    return `${base}_${quote}`.toLowerCase();
  }

  private async fetchAlexPools(): Promise<PoolInfo[]> {
    const [poolStatsResponse, tickersResponse] = await Promise.all([
      axios
        .get(`${ALEX_API_BASE}/v1/public/amm-pool-stats`, {
          timeout: 10000,
          headers: this.defaultHeaders,
        })
        .catch(() => ({ data: [] })),
      axios
        .get(`${ALEX_API_BASE}/v1/tickers`, {
          timeout: 10000,
          headers: this.defaultHeaders,
        })
        .catch(() => ({ data: [] })),
    ]);

    const pools: any[] = Array.isArray(poolStatsResponse.data?.data)
      ? poolStatsResponse.data.data
      : [];
    const tickers: any[] = Array.isArray(tickersResponse.data)
      ? tickersResponse.data
      : [];

    const volumeMap = new Map<string, number>();
    for (const ticker of tickers) {
      const key = this.buildAlexTickerKey(ticker?.baseId, ticker?.targetId);
      if (!key) continue;
      const baseVolumeUsd =
        Number(ticker?.baseVolume || 0) * Number(ticker?.lastBasePriceInUSD || 0);
      const targetVolumeUsd =
        Number(ticker?.targetVolume || 0) *
        Number(ticker?.lastTargetPriceInUSD || 0);
      const combined =
        (Number.isFinite(baseVolumeUsd) ? baseVolumeUsd : 0) +
        (Number.isFinite(targetVolumeUsd) ? targetVolumeUsd : 0);
      if (combined > 0) {
        volumeMap.set(key, (volumeMap.get(key) || 0) + combined);
        const reversedKey = this.buildAlexTickerKey(
          ticker?.targetId,
          ticker?.baseId
        );
        if (reversedKey && !volumeMap.has(reversedKey)) {
          volumeMap.set(reversedKey, combined);
        }
      }
    }

    return pools
      .map((pool: any) => {
        const baseToken = pool?.base_token;
        const quoteToken = pool?.target_token;
        const identifier = pool?.pool_id
          ? `alex-${pool.pool_id}`
          : this.buildAlexTickerKey(baseToken, quoteToken) || `alex-${Math.random()}`;
        if (!identifier) {
          return null;
        }

        const poolTvl = this.toNumber(pool?.tvl);
        const apyRatio = this.toNumber(pool?.apy);
        const apyPercent = apyRatio !== null ? apyRatio * 100 : null;
        const key = this.buildAlexTickerKey(baseToken, quoteToken);
        const reverseKey = this.buildAlexTickerKey(quoteToken, baseToken);
        const volumeUsd =
          (key && volumeMap.has(key) ? volumeMap.get(key) ?? null : null) ??
          (reverseKey && volumeMap.has(reverseKey)
            ? volumeMap.get(reverseKey) ?? null
            : null) ??
          null;

        return {
          poolId: identifier,
          protocol: 'alex',
          tokenA: this.normalizeAlexSymbol(baseToken) || 'BASE',
          tokenB: this.normalizeAlexSymbol(quoteToken) || 'QUOTE',
          apy: apyPercent,
          tvl: poolTvl,
          volume24h: volumeUsd,
        } as PoolInfo;
      })
      .filter((pool): pool is PoolInfo => !!pool);
  }

  private toNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}
