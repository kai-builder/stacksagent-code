/**
 * DEX Routes
 *
 * Endpoints for DEX/swap operations:
 * - POST /quote - Get a swap quote
 * - POST /swap - Execute a token swap
 * - GET /pools - Get available liquidity pools
 */

import { Router, Request, Response } from 'express';
import { DexService } from '../../core/dex.js';
import { SwapService } from '../../core/swap.js';
import { WalletService } from '../../core/wallet.js';

export function createDexRoutes(
  dexService: DexService,
  swapService: SwapService,
  walletService: WalletService
): Router {
  const router = Router();

  /**
   * POST /api/dex/quote
   * Get a swap quote
   */
  router.post('/quote', async (req: Request, res: Response) => {
    try {
      const { fromToken, toToken, amount, preferredDex } = req.body;

      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'fromToken, toToken, and amount are required',
        });
      }

      const quote = await dexService.getQuote(
        fromToken,
        toToken,
        amount.toString(),
        preferredDex || 'auto'
      );

      res.json({
        success: true,
        quote,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/dex/swap
   * Execute a token swap
   */
  router.post('/swap', async (req: Request, res: Response) => {
    try {
      const { fromToken, toToken, amount, slippage, password } = req.body;

      if (!fromToken || !toToken || !amount || !password) {
        return res.status(400).json({
          success: false,
          error: 'fromToken, toToken, amount, and password are required',
        });
      }

      // Unlock wallet
      if (!walletService.isUnlocked()) {
        await walletService.unlockWallet(password);
      }

      const privateKey = walletService.getPrivateKey();
      const senderAddress = walletService.getAddress();

      const result = await dexService.executeSwap(
        fromToken,
        toToken,
        amount.toString(),
        slippage || 1,
        privateKey,
        senderAddress
      );

      // Lock wallet after operation
      walletService.lockWallet();

      res.json({
        success: true,
        swap: result,
      });
    } catch (error: any) {
      walletService.lockWallet();
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/dex/multi-quote
   * Get quotes from multiple DEXes (returns best quote from all AMMs)
   */
  router.post('/multi-quote', async (req: Request, res: Response) => {
    try {
      const { fromToken, toToken, amount } = req.body;

      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'fromToken, toToken, and amount are required',
        });
      }

      // Get quotes from all AMMs using SwapService
      const quotes = await swapService.getAllQuotes(
        fromToken,
        toToken,
        parseFloat(amount.toString())
      );

      // Sort by best output amount
      const sortedQuotes = quotes.sort((a, b) => b.amountOut - a.amountOut);

      res.json({
        success: true,
        quotes: sortedQuotes,
        bestQuote: sortedQuotes[0] || null,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/dex/execute
   * Execute swap via SwapService (multi-DEX)
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { fromToken, toToken, amount, slippage, password, preferredAmm } = req.body;

      if (!fromToken || !toToken || !amount || !password) {
        return res.status(400).json({
          success: false,
          error: 'fromToken, toToken, amount, and password are required',
        });
      }

      // Unlock wallet
      if (!walletService.isUnlocked()) {
        await walletService.unlockWallet(password);
      }

      const privateKey = walletService.getPrivateKey();
      const senderAddress = walletService.getAddress();

      // Get quotes from all AMMs
      const quotes = await swapService.getAllQuotes(
        fromToken,
        toToken,
        parseFloat(amount.toString())
      );

      if (quotes.length === 0) {
        walletService.lockWallet();
        return res.status(400).json({
          success: false,
          error: 'No quotes available for this token pair',
        });
      }

      // Use preferred AMM if specified and available, otherwise use best quote
      let quote = quotes.sort((a, b) => b.amountOut - a.amountOut)[0];
      if (preferredAmm) {
        const preferredQuote = quotes.find(q => q.amm === preferredAmm);
        if (preferredQuote) {
          quote = preferredQuote;
        }
      }

      // Execute swap
      const result = await swapService.executeSwap(
        quote,
        senderAddress,
        privateKey,
        slippage || 0.5
      );

      // Lock wallet after operation
      walletService.lockWallet();

      res.json({
        success: true,
        swap: result,
      });
    } catch (error: any) {
      walletService.lockWallet();
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
