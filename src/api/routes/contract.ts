/**
 * Contract Routes
 *
 * Endpoints for Clarity smart contract operations:
 * - POST /generate - Generate a contract from requirements
 * - POST /audit - Audit a contract for security issues
 * - POST /deploy - Deploy a contract to the blockchain
 * - POST /analyze - Analyze contract structure
 */

import { Router, Request, Response } from 'express';
import { ClarityService } from '../../core/clarity.js';
import { WalletService } from '../../core/wallet.js';
import { ContractGenerationOptions } from '../../types/index.js';

export function createContractRoutes(
  clarityService: ClarityService,
  walletService: WalletService
): Router {
  const router = Router();

  /**
   * POST /api/contract/generate
   * Generate a Clarity contract from requirements
   */
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { requirements, contractType, features, includeComments } = req.body;

      if (!requirements) {
        return res.status(400).json({
          success: false,
          error: 'requirements is required',
        });
      }

      const options: ContractGenerationOptions = {
        contractType: contractType || 'fungible-token',
        features: features || [],
        includeComments: includeComments !== false,
      };

      const result = await clarityService.generateContract(requirements, options);

      res.json({
        success: true,
        contract: {
          name: result.name,
          code: result.code,
          analysis: result.analysis,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/contract/audit
   * Audit a Clarity contract for security issues
   */
  router.post('/audit', async (req: Request, res: Response) => {
    try {
      const { contractCode } = req.body;

      if (!contractCode) {
        return res.status(400).json({
          success: false,
          error: 'contractCode is required',
        });
      }

      const auditReport = await clarityService.auditContract(contractCode);

      res.json({
        success: true,
        audit: auditReport,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/contract/deploy
   * Deploy a Clarity contract to the blockchain
   */
  router.post('/deploy', async (req: Request, res: Response) => {
    try {
      const { contractName, contractCode, password, network } = req.body;

      if (!contractName || !contractCode || !password) {
        return res.status(400).json({
          success: false,
          error: 'contractName, contractCode, and password are required',
        });
      }

      // Unlock wallet
      if (!walletService.isUnlocked()) {
        await walletService.unlockWallet(password);
      }

      const privateKey = walletService.getPrivateKey();
      const targetNetwork = network || 'testnet';

      const result = await clarityService.deployContract(
        contractName,
        contractCode,
        privateKey,
        targetNetwork
      );

      // Lock wallet after operation
      walletService.lockWallet();

      if (result.success) {
        res.json({
          success: true,
          txId: result.txId,
          contractId: result.contractId,
          explorerUrl: result.explorerUrl,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
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
