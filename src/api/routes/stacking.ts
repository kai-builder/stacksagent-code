/**
 * Stacking Routes
 *
 * Endpoints for stacking/PoX operations:
 * - GET /info - Get current stacking info
 * - GET /status/:address - Get stacking status for an address
 * - POST /stack - Stack STX for PoX rewards
 * - GET /cycles - Get stacking cycle history
 * - GET /signers/:cycleId - Get signers for a cycle
 */

import { Router, Request, Response } from 'express';
import { StackingService } from '../../core/stacking.js';
import { WalletService } from '../../core/wallet.js';

export function createStackingRoutes(
  stackingService: StackingService,
  walletService: WalletService
): Router {
  const router = Router();

  /**
   * GET /api/stacking/info
   * Get current stacking information
   */
  router.get('/info', async (req: Request, res: Response) => {
    try {
      const info = await stackingService.getStackingInfo();

      res.json({
        success: true,
        stacking: info,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/stacking/status/:address
   * Get stacking status for an address
   */
  router.get('/status/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      const status = await stackingService.getStackingStatus(address);

      res.json({
        success: true,
        status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/stacking/stack
   * Stack STX for PoX rewards
   */
  router.post('/stack', async (req: Request, res: Response) => {
    try {
      const { amount, cycles, poxAddress, password } = req.body;

      if (!amount || !cycles || !poxAddress || !password) {
        return res.status(400).json({
          success: false,
          error: 'amount, cycles, poxAddress, and password are required',
        });
      }

      // Unlock wallet
      if (!walletService.isUnlocked()) {
        await walletService.unlockWallet(password);
      }

      const privateKey = walletService.getPrivateKey();
      const senderAddress = walletService.getAddress();

      const txId = await stackingService.stackStx(
        amount.toString(),
        cycles,
        poxAddress,
        privateKey,
        senderAddress
      );

      // Lock wallet after operation
      walletService.lockWallet();

      res.json({
        success: true,
        txId,
        message: `Stacking ${amount} STX for ${cycles} cycles`,
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
   * GET /api/stacking/pox
   * Get detailed PoX information
   */
  router.get('/pox', async (req: Request, res: Response) => {
    try {
      const poxInfo = await stackingService.getDetailedPoxInfo();

      res.json({
        success: true,
        pox: poxInfo,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/stacking/cycles
   * Get stacking cycle history
   */
  router.get('/cycles', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const cycles = await stackingService.getStackingCycles(limit, offset);

      res.json({
        success: true,
        cycles,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/stacking/signers/:cycleId
   * Get signers for a specific cycle
   */
  router.get('/signers/:cycleId', async (req: Request, res: Response) => {
    try {
      const cycleId = parseInt(req.params.cycleId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const signers = await stackingService.getSigners(cycleId, limit, offset);

      res.json({
        success: true,
        signers,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/stacking/positions/:address
   * Search for stacking positions for an address
   */
  router.get('/positions/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      const positions = await stackingService.searchStackingPositions(address);

      res.json({
        success: true,
        positions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/stacking/rewards
   * Get recent burnchain rewards
   */
  router.get('/rewards', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const rewards = await stackingService.getBurnchainRewards(limit, offset);

      res.json({
        success: true,
        rewards,
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
