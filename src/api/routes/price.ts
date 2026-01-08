/**
 * Price Routes
 *
 * Endpoints for price/market data:
 * - GET /:symbol - Get price for a token
 * - GET /trending - Get trending tokens
 * - GET /pools - Get liquidity pools
 */

import { Router, Request, Response } from 'express';
import { PriceService } from '../../core/price.js';

export function createPriceRoutes(priceService: PriceService): Router {
  const router = Router();

  /**
   * GET /api/price/:symbol
   * Get price for a specific token
   */
  router.get('/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;

      const price = await priceService.getPrice(symbol);

      res.json({
        success: true,
        price,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/price/batch
   * Get prices for multiple tokens
   */
  router.post('/batch', async (req: Request, res: Response) => {
    try {
      const { symbols } = req.body;

      if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({
          success: false,
          error: 'symbols array is required',
        });
      }

      const prices = await priceService.getPrices(symbols);

      res.json({
        success: true,
        prices,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/price/trending/tokens
   * Get trending tokens
   */
  router.get('/trending/tokens', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const filter = (req.query.filter as 'trending' | 'new' | 'volume') || 'trending';

      const tokens = await priceService.getTrendingTokens(limit, filter);

      res.json({
        success: true,
        tokens,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/price/pools/list
   * Get liquidity pools
   */
  router.get('/pools/list', async (req: Request, res: Response) => {
    try {
      const protocol = req.query.protocol as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const pools = await priceService.getPools(protocol, limit);

      res.json({
        success: true,
        pools,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
