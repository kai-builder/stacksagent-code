/**
 * Wallet Routes
 *
 * Endpoints for wallet operations:
 * - GET /balance/:address - Get wallet balance
 * - POST /create - Create a new wallet
 * - POST /import - Import wallet from mnemonic
 * - POST /unlock - Unlock wallet
 * - POST /lock - Lock wallet
 * - GET /list - List all wallets
 */

import { Router, Request, Response } from 'express';
import { WalletService } from '../../core/wallet.js';

export function createWalletRoutes(walletService: WalletService): Router {
  const router = Router();

  /**
   * GET /api/wallet/balance/:address
   * Get wallet balance for an address
   */
  router.get('/balance/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      const balance = await walletService.getBalance(address);

      res.json({
        success: true,
        address,
        balance,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/wallet/create
   * Create a new wallet
   */
  router.post('/create', async (req: Request, res: Response) => {
    try {
      const { password, label } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'password is required',
        });
      }

      const result = await walletService.createWallet(password, label);

      res.json({
        success: true,
        walletId: result.walletId,
        mnemonic: result.mnemonic, // Return mnemonic only on creation
        accounts: result.accounts,
        warning: 'SAVE YOUR MNEMONIC PHRASE! This is the only time it will be shown.',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/wallet/import
   * Import wallet from mnemonic
   */
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const { mnemonic, password, label } = req.body;

      if (!mnemonic || !password) {
        return res.status(400).json({
          success: false,
          error: 'mnemonic and password are required',
        });
      }

      const result = await walletService.importWallet(mnemonic, password, label);

      res.json({
        success: true,
        walletId: result.walletId,
        accounts: result.accounts,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/wallet/unlock
   * Unlock a wallet
   */
  router.post('/unlock', async (req: Request, res: Response) => {
    try {
      const { password, walletId } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'password is required',
        });
      }

      const result = await walletService.unlockWallet(password, walletId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/wallet/lock
   * Lock the current wallet
   */
  router.post('/lock', async (req: Request, res: Response) => {
    try {
      walletService.lockWallet();

      res.json({
        success: true,
        message: 'Wallet locked',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/wallet/list
   * List all wallets
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const wallets = await walletService.listWallets();

      res.json({
        success: true,
        wallets: wallets.map(w => ({
          id: w.id,
          label: w.label,
          createdAt: w.createdAt,
          lastUsed: w.lastUsed,
          accountCount: w.accountCount,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/wallet/status
   * Get current wallet status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const isUnlocked = walletService.isUnlocked();
      const walletExists = await walletService.walletExists();

      const response: any = {
        success: true,
        isUnlocked,
        walletExists,
      };

      if (isUnlocked) {
        response.address = walletService.getAddress();
        const info = walletService.getWalletInfo();
        response.network = info.network;
      }

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/wallet/accounts
   * List accounts in the active wallet
   */
  router.get('/accounts', async (req: Request, res: Response) => {
    try {
      const accounts = await walletService.listAccounts();

      res.json({
        success: true,
        accounts,
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
