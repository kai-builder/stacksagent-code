/**
 * Pyth Oracle Service
 * Handles fetching price feeds from Pyth Network for Zest Protocol integration
 */

import { HermesClient } from '@pythnetwork/hermes-client';
import { PYTH_HERMES_URL, PYTH_PRICE_FEED_IDS } from '../utils/zest-constants.js';
import axios from 'axios';

export interface PythPriceFeed {
  priceFeedBytes: string; // hex encoded for Clarity contracts
  prices: {
    btc: number;
    stx: number;
    usdc: number;
  };
  timestamp: number;
}

export class PythService {
  private hermes: HermesClient;

  constructor() {
    this.hermes = new HermesClient(PYTH_HERMES_URL, {});
  }

  /**
   * Fetches the latest price feeds from Pyth Network
   * Returns hex-encoded price feed data suitable for Clarity contract calls
   */
  async getPriceFeed(): Promise<PythPriceFeed> {
    try {
      const priceIds = [
        PYTH_PRICE_FEED_IDS.BTC_USD,
        PYTH_PRICE_FEED_IDS.STX_USD,
        PYTH_PRICE_FEED_IDS.USDC_USD,
      ];

      // Fetch VAA using REST API (most reliable method)
      const vaaUrl = `${PYTH_HERMES_URL}/api/latest_vaas?ids[]=${priceIds[0]}`;
      const vaaResponse = await axios.get<string[]>(vaaUrl);

      if (!vaaResponse.data || vaaResponse.data.length === 0) {
        throw new Error('No VAA data returned from Pyth');
      }

      // Convert base64 VAA to hex for Clarity
      const vaaHex = this.base64ToHex(vaaResponse.data[0]);

      // Fetch latest price feeds for price values
      const priceFeeds = await this.hermes.getLatestPriceUpdates(priceIds);

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length < 3) {
        throw new Error('Failed to fetch all required price feeds');
      }

      // Parse prices from Pyth format
      const btcPrice = this.parsePrice(priceFeeds.parsed[0]);
      const stxPrice = this.parsePrice(priceFeeds.parsed[1]);
      const usdcPrice = this.parsePrice(priceFeeds.parsed[2]);

      return {
        priceFeedBytes: '0x' + vaaHex,
        prices: {
          btc: btcPrice,
          stx: stxPrice,
          usdc: usdcPrice,
        },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch Pyth price feed: ${error.message}`);
    }
  }

  /**
   * Gets just the BTC price without fetching full feed data
   */
  async getBtcPrice(): Promise<number> {
    try {
      const priceFeeds = await this.hermes.getLatestPriceUpdates([PYTH_PRICE_FEED_IDS.BTC_USD]);

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
        throw new Error('Failed to fetch BTC price feed');
      }

      return this.parsePrice(priceFeeds.parsed[0]);
    } catch (error: any) {
      throw new Error(`Failed to fetch BTC price: ${error.message}`);
    }
  }

  /**
   * Gets just the STX price without fetching full feed data
   */
  async getStxPrice(): Promise<number> {
    try {
      const priceFeeds = await this.hermes.getLatestPriceUpdates([PYTH_PRICE_FEED_IDS.STX_USD]);

      if (!priceFeeds || !priceFeeds.parsed || priceFeeds.parsed.length === 0) {
        throw new Error('Failed to fetch STX price feed');
      }

      return this.parsePrice(priceFeeds.parsed[0]);
    } catch (error: any) {
      throw new Error(`Failed to fetch STX price: ${error.message}`);
    }
  }

  /**
   * Parses a Pyth price feed into a USD price
   */
  private parsePrice(feed: any): number {
    if (!feed || !feed.price) {
      throw new Error('Invalid price feed structure');
    }

    // Pyth prices come with an exponent (e.g., price * 10^expo)
    // Actual Price = price.price / 10^|expo|
    const price = parseFloat(feed.price.price);
    const expo = feed.price.expo;

    return price * Math.pow(10, expo);
  }

  /**
   * Converts base64 string to hex
   */
  private base64ToHex(base64: string): string {
    const buffer = Buffer.from(base64, 'base64');
    return buffer.toString('hex');
  }

  /**
   * Converts Uint8Array to hex string
   */
  private toHexFromBytes(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('hex');
  }
}
