/**
 * Portfolio Routes
 *
 * Endpoints for portfolio operations:
 * - GET /:address - Get portfolio summary
 * - GET /:address/history - Get transaction history
 * - GET /:address/transactions - Get recent transactions
 */

import { Router, Request, Response } from 'express';
import { PortfolioService } from '../../core/portfolio.js';
import { WalletService } from '../../core/wallet.js';
import { BnsService } from '../../core/bns.js';

export function createPortfolioRoutes(
  portfolioService: PortfolioService,
  walletService: WalletService,
  bnsService: BnsService
): Router {
  const router = Router();

  /**
   * GET /api/portfolio/:address
   * Get portfolio summary for an address
   */
  router.get('/:address', async (req: Request, res: Response) => {
    try {
      let { address } = req.params;

      // Resolve BNS name if provided
      if (address.endsWith('.btc') || address.endsWith('.stx')) {
        const resolved = await bnsService.resolveNameToAddress(address);
        if (resolved) {
          address = resolved;
        }
      }

      const summary = await portfolioService.getPortfolioSummary(address);

      res.json({
        success: true,
        portfolio: summary,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/:address/history
   * Get historical portfolio data
   */
  router.get('/:address/history', async (req: Request, res: Response) => {
    try {
      let { address } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      // Resolve BNS name if provided
      if (address.endsWith('.btc') || address.endsWith('.stx')) {
        const resolved = await bnsService.resolveNameToAddress(address);
        if (resolved) {
          address = resolved;
        }
      }

      const history = await portfolioService.getPortfolioHistory(address, days);

      res.json({
        success: true,
        history,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/:address/transactions
   * Get recent transactions for an address
   */
  router.get('/:address/transactions', async (req: Request, res: Response) => {
    try {
      let { address } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      // Resolve BNS name if provided
      if (address.endsWith('.btc') || address.endsWith('.stx')) {
        const resolved = await bnsService.resolveNameToAddress(address);
        if (resolved) {
          address = resolved;
        }
      }

      const transactions = await portfolioService.getTransactionHistory(address, limit);

      res.json({
        success: true,
        transactions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/:address/pnl
   * Calculate profit/loss for an address
   */
  router.get('/:address/pnl', async (req: Request, res: Response) => {
    try {
      let { address } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      // Resolve BNS name if provided
      if (address.endsWith('.btc') || address.endsWith('.stx')) {
        const resolved = await bnsService.resolveNameToAddress(address);
        if (resolved) {
          address = resolved;
        }
      }

      const pnl = await portfolioService.calculatePnL(address, days);

      res.json({
        success: true,
        pnl,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/portfolio/resolve/:name
   * Resolve a BNS name to an address
   */
  router.get('/resolve/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      const address = await bnsService.resolveNameToAddress(name);

      if (!address) {
        return res.status(404).json({
          success: false,
          error: 'Name not found',
        });
      }

      res.json({
        success: true,
        name,
        address,
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
