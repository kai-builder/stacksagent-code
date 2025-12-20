import { z } from 'zod';
import { WalletService } from '../services/wallet.js';
import { configManager } from '../utils/config.js';

export const walletTools = (walletService: WalletService) => ({
  wallet_create: {
    description: 'Creates a new Stacks wallet with encrypted keystore',
    parameters: z.object({
      password: z.string().describe('Password to encrypt the wallet keystore'),
    }),
    handler: async (args: { password: string }) => {
      try {
        await configManager.ensureConfigDir();
        const result = await walletService.createWallet(args.password);

        const config = configManager.get();

        return {
          success: true,
          mainnetAddress: result.mainnetAddress,
          testnetAddress: result.testnetAddress,
          currentNetwork: config.network,
          activeAddress: config.network === 'mainnet' ? result.mainnetAddress : result.testnetAddress,
          keystorePath: result.keystorePath,
          mnemonic: result.mnemonic,
          message: 'Wallet created successfully. IMPORTANT: Save your mnemonic phrase securely!',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_import: {
    description: 'Imports a wallet from mnemonic phrase or private key',
    parameters: z.object({
      mnemonicOrPrivateKey: z.string().describe('24-word mnemonic phrase or 64-character hex private key'),
      password: z.string().describe('Password to encrypt the wallet keystore'),
    }),
    handler: async (args: { mnemonicOrPrivateKey: string; password: string }) => {
      try {
        await configManager.ensureConfigDir();
        const result = await walletService.importWallet(
          args.mnemonicOrPrivateKey,
          args.password
        );

        const config = configManager.get();

        return {
          success: true,
          mainnetAddress: result.mainnetAddress,
          testnetAddress: result.testnetAddress,
          currentNetwork: config.network,
          activeAddress: config.network === 'mainnet' ? result.mainnetAddress : result.testnetAddress,
          keystorePath: result.keystorePath,
          message: 'Wallet imported successfully',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_unlock: {
    description: 'Unlocks the wallet with password to enable transactions',
    parameters: z.object({
      password: z.string().describe('Wallet password'),
    }),
    handler: async (args: { password: string }) => {
      try {
        const result = await walletService.unlockWallet(args.password);

        return {
          success: true,
          currentAddress: result.currentAddress,
          mainnetAddress: result.mainnetAddress,
          testnetAddress: result.testnetAddress,
          network: result.network,
          message: `Wallet unlocked successfully. Current network: ${result.network}`,
          networkInfo: {
            mainnet: `Your mainnet address: ${result.mainnetAddress}`,
            testnet: `Your testnet address: ${result.testnetAddress}`,
            active: `Active address (${result.network}): ${result.currentAddress}`,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_lock: {
    description: 'Locks the wallet (clears private key from memory)',
    parameters: z.object({}),
    handler: async () => {
      try {
        walletService.lockWallet();

        return {
          success: true,
          message: 'Wallet locked successfully',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_get_address: {
    description: 'Gets the current wallet address',
    parameters: z.object({}),
    handler: async () => {
      try {
        const walletInfo = walletService.getWalletInfo();

        return {
          success: true,
          address: walletInfo.address,
          network: walletInfo.network,
          isUnlocked: walletService.isUnlocked(),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_get_balance: {
    description: 'Gets STX and token balances for the wallet',
    parameters: z.object({
      address: z.string().optional().describe('Address to check balance (defaults to current wallet)'),
    }),
    handler: async (args: { address?: string }) => {
      try {
        const balance = await walletService.getBalance(args.address);

        // Convert microSTX to STX
        const stxBalance = (parseFloat(balance.stx) / 1000000).toFixed(6);

        return {
          success: true,
          stx: stxBalance,
          tokens: balance.tokens.map(t => ({
            symbol: t.symbol,
            balance: (parseFloat(t.balance) / Math.pow(10, t.decimals)).toFixed(t.decimals),
            usdValue: t.usdValue,
          })),
          totalUsdValue: balance.totalUsdValue,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_status: {
    description: 'Checks if wallet exists and is unlocked',
    parameters: z.object({}),
    handler: async () => {
      try {
        const exists = await walletService.walletExists();
        const unlocked = walletService.isUnlocked();

        let address = null;
        if (unlocked) {
          try {
            address = walletService.getAddress();
          } catch {
            // Ignore if can't get address
          }
        }

        return {
          success: true,
          walletExists: exists,
          isUnlocked: unlocked,
          address,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },
});
