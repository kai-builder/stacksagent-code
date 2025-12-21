import { z } from 'zod';
import { WalletService } from '../services/wallet.js';
import { configManager } from '../utils/config.js';

export const walletTools = (walletService: WalletService) => ({
  wallet_create: {
    description: 'Creates a new Stacks wallet with encrypted keystore',
    parameters: z.object({
      password: z.string().describe('Password to encrypt the wallet keystore'),
      label: z.string().optional().describe('Optional label for the wallet'),
    }),
    handler: async (args: { password: string; label?: string }) => {
      try {
        await configManager.ensureConfigDir();
        const result = await walletService.createWallet(args.password, args.label);

        const config = configManager.get();
        const account0 = result.accounts[0];

        return {
          success: true,
          walletId: result.walletId,
          mainnetAddress: account0.mainnetAddress,
          testnetAddress: account0.testnetAddress,
          currentNetwork: config.network,
          activeAddress: config.network === 'mainnet' ? account0.mainnetAddress : account0.testnetAddress,
          keystorePath: result.keystorePath,
          mnemonic: result.mnemonic,
          accountsCreated: result.accounts.length,
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
    description: 'Imports a wallet from mnemonic phrase',
    parameters: z.object({
      mnemonic: z.string().describe('24-word mnemonic phrase'),
      password: z.string().describe('Password to encrypt the wallet keystore'),
      label: z.string().optional().describe('Optional label for the wallet'),
    }),
    handler: async (args: { mnemonic: string; password: string; label?: string }) => {
      try {
        await configManager.ensureConfigDir();
        const result = await walletService.importWallet(args.mnemonic, args.password, args.label);

        const config = configManager.get();
        const account0 = result.accounts[0];

        return {
          success: true,
          walletId: result.walletId,
          mainnetAddress: account0.mainnetAddress,
          testnetAddress: account0.testnetAddress,
          currentNetwork: config.network,
          activeAddress: config.network === 'mainnet' ? account0.mainnetAddress : account0.testnetAddress,
          keystorePath: result.keystorePath,
          accountsCreated: result.accounts.length,
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

  // ============================================================================
  // MULTI-WALLET MANAGEMENT
  // ============================================================================

  wallet_list: {
    description: 'List all wallets with their metadata',
    parameters: z.object({}),
    handler: async () => {
      try {
        const wallets = await walletService.listWallets();
        const activeWallet = await walletService.getActiveWallet();

        return {
          success: true,
          wallets: wallets.map((w) => ({
            id: w.id,
            label: w.label,
            accountCount: w.accountCount,
            createdAt: w.createdAt,
            lastUsed: w.lastUsed,
            isActive: activeWallet?.id === w.id,
          })),
          activeWalletId: activeWallet?.id || null,
          totalWallets: wallets.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_switch: {
    description: 'Switch to a different wallet',
    parameters: z.object({
      walletId: z.string().describe('Wallet ID to switch to'),
      accountIndex: z.coerce.number().optional().default(0).describe('Account index to use (default: 0)'),
    }),
    handler: async (args: { walletId: string; accountIndex?: number }) => {
      try {
        await walletService.switchWallet(args.walletId, args.accountIndex || 0);

        return {
          success: true,
          message: `Switched to wallet ${args.walletId}, account ${args.accountIndex || 0}`,
          note: 'You need to unlock the wallet to use it for transactions',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_delete: {
    description: 'Delete a wallet permanently',
    parameters: z.object({
      walletId: z.string().describe('Wallet ID to delete'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    }),
    handler: async (args: { walletId: string; confirm: boolean }) => {
      try {
        if (!args.confirm) {
          return {
            success: false,
            error: 'Deletion requires confirm: true',
            warning: 'This action is irreversible. All accounts in this wallet will be deleted.',
          };
        }

        await walletService.deleteWallet(args.walletId);

        return {
          success: true,
          message: `Wallet ${args.walletId} deleted successfully`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_export: {
    description: 'Export wallet mnemonic phrase (DANGEROUS - keep secret!)',
    parameters: z.object({
      walletId: z.string().optional().describe('Wallet ID to export (defaults to active wallet)'),
      password: z.string().describe('Wallet password'),
    }),
    handler: async (args: { walletId?: string; password: string }) => {
      try {
        const activeWallet = await walletService.getActiveWallet();
        const targetWalletId = args.walletId || activeWallet?.id;

        if (!targetWalletId) {
          return {
            success: false,
            error: 'No wallet specified and no active wallet found',
          };
        }

        const mnemonic = await walletService.exportWallet(targetWalletId, args.password);

        return {
          success: true,
          mnemonic,
          warning: 'NEVER share this mnemonic with anyone! Anyone with this phrase can access your funds.',
          recommendation: 'Store this phrase securely offline.',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  wallet_rename: {
    description: 'Rename a wallet',
    parameters: z.object({
      walletId: z.string().optional().describe('Wallet ID to rename (defaults to active wallet)'),
      newLabel: z.string().describe('New label for the wallet'),
    }),
    handler: async (args: { walletId?: string; newLabel: string }) => {
      try {
        const activeWallet = await walletService.getActiveWallet();
        const targetWalletId = args.walletId || activeWallet?.id;

        if (!targetWalletId) {
          return {
            success: false,
            error: 'No wallet specified and no active wallet found',
          };
        }

        await walletService.renameWallet(targetWalletId, args.newLabel);

        return {
          success: true,
          message: `Wallet renamed to '${args.newLabel}'`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  // ============================================================================
  // MULTI-ACCOUNT MANAGEMENT
  // ============================================================================

  account_create: {
    description: 'Create a new account in the active wallet',
    parameters: z.object({
      label: z.string().optional().describe('Optional label for the account (e.g., "Trading", "Savings")'),
    }),
    handler: async (args: { label?: string }) => {
      try {
        const account = await walletService.createAccount(args.label);

        const config = configManager.get();

        return {
          success: true,
          account: {
            index: account.index,
            label: account.label,
            mainnetAddress: account.mainnetAddress,
            testnetAddress: account.testnetAddress,
            derivationPath: account.derivationPath,
          },
          activeAddress: config.network === 'mainnet' ? account.mainnetAddress : account.testnetAddress,
          message: `Account '${account.label}' created successfully`,
          note: 'Use account_switch to make this account active for transactions',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  account_list: {
    description: 'List all accounts in a wallet',
    parameters: z.object({
      walletId: z.string().optional().describe('Wallet ID (defaults to active wallet)'),
    }),
    handler: async (args: { walletId?: string }) => {
      try {
        const accounts = await walletService.listAccounts(args.walletId);
        const activeAccount = await walletService.getActiveAccount();

        const config = configManager.get();

        return {
          success: true,
          accounts: accounts.map((a) => ({
            index: a.index,
            label: a.label,
            mainnetAddress: a.mainnetAddress,
            testnetAddress: a.testnetAddress,
            activeAddress: config.network === 'mainnet' ? a.mainnetAddress : a.testnetAddress,
            derivationPath: a.derivationPath,
            isActive: activeAccount?.index === a.index,
          })),
          activeAccountIndex: activeAccount?.index || null,
          totalAccounts: accounts.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  account_switch: {
    description: 'Switch to a different account in the active wallet',
    parameters: z.object({
      accountIndex: z.coerce.number().describe('Account index to switch to (0, 1, 2, ...)'),
    }),
    handler: async (args: { accountIndex: number }) => {
      try {
        await walletService.switchAccount(args.accountIndex);
        const activeAccount = await walletService.getActiveAccount();

        if (!activeAccount) {
          return {
            success: false,
            error: 'Failed to retrieve active account after switch',
          };
        }

        const config = configManager.get();
        const activeAddress = config.network === 'mainnet'
          ? activeAccount.mainnetAddress
          : activeAccount.testnetAddress;

        return {
          success: true,
          account: {
            index: activeAccount.index,
            label: activeAccount.label,
            mainnetAddress: activeAccount.mainnetAddress,
            testnetAddress: activeAccount.testnetAddress,
            activeAddress,
          },
          message: `Switched to account '${activeAccount.label}' (index ${activeAccount.index})`,
          note: 'If wallet is unlocked, this account is now active for transactions',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  account_rename: {
    description: 'Rename an account',
    parameters: z.object({
      accountIndex: z.coerce.number().describe('Account index to rename'),
      newLabel: z.string().describe('New label for the account'),
    }),
    handler: async (args: { accountIndex: number; newLabel: string }) => {
      try {
        await walletService.renameAccount(args.accountIndex, args.newLabel);

        return {
          success: true,
          message: `Account ${args.accountIndex} renamed to '${args.newLabel}'`,
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
