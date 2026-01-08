import { z } from 'zod';
import { WalletService } from '../../core/wallet.js';
import { configManager } from '../../utils/config.js';
import { coercedBoolean } from '../../utils/schema-helpers.js';
import {
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../../utils/constants.js';
import { StacksApiClient } from '../../core/stacks-api.js';

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

  // ============================================================================
  // STX TRANSFER
  // ============================================================================

  stx_transfer: {
    description: 'Transfers STX to another address on mainnet or testnet',
    parameters: z.object({
      recipient: z.string().describe('Recipient Stacks address (SP... for mainnet, ST... for testnet)'),
      amount: z.string().describe('Amount of STX to transfer (e.g., "0.5", "10.25")'),
      memo: z.string().optional().describe('Optional memo text (max 34 bytes)'),
      confirmMainnet: coercedBoolean().describe('Required confirmation for mainnet transfers (safety check)'),
    }),
    handler: async (args: {
      recipient: string;
      amount: string;
      memo?: string;
      confirmMainnet?: boolean;
    }) => {
      try {
        // Step 1: Detect network from address prefix
        const recipientNetwork = args.recipient.startsWith('SP') ? 'mainnet'
                               : args.recipient.startsWith('ST') ? 'testnet'
                               : null;

        if (!recipientNetwork) {
          return {
            success: false,
            error: 'Invalid Stacks address. Must start with SP (mainnet) or ST (testnet)',
            hint: 'Example: SP2XD7HYQR4T85EW26B6HZTVK03QBW88MN37KK2MZ (mainnet) or ST2XD7HYQR4T85EW26B6HZTVK03QBW88MN3WRBSNE (testnet)',
          };
        }

        // Step 2: Verify address exists by checking balance
        const apiClient = new StacksApiClient(recipientNetwork);
        try {
          await apiClient.getStxBalance(args.recipient);
          // If balance check succeeds, address is valid (even if balance is 0)
        } catch (error: any) {
          return {
            success: false,
            error: `Recipient address verification failed: ${error.message}`,
            hint: 'The address may be invalid or the network may be unreachable',
          };
        }

        // Step 3: Safety check for mainnet transfers
        if (recipientNetwork === 'mainnet' && !args.confirmMainnet) {
          return {
            success: false,
            error: 'Mainnet transfer requires confirmMainnet: true. This is a safety check to prevent accidental transfers.',
            recommendation: [
              'Test on testnet first if this is a new recipient',
              'Double-check the recipient address carefully',
              'Verify the amount is correct',
              'Set confirmMainnet: true to proceed with mainnet transfer',
            ],
            transferAttempt: {
              network: 'mainnet',
              recipient: args.recipient,
              amount: args.amount,
            },
          };
        }

        // Warning for mainnet
        if (recipientNetwork === 'mainnet') {
          console.error('⚠️  WARNING: Transferring STX on MAINNET. This is a real transaction!');
        }

        // Step 4: Check wallet is unlocked
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const senderAddress = walletService.getAddressForNetwork(recipientNetwork);

        // Step 5: Parse and validate amount
        const amountStx = parseFloat(args.amount);
        if (isNaN(amountStx) || amountStx <= 0) {
          return {
            success: false,
            error: 'Invalid amount. Must be a positive number.',
            hint: 'Example: "0.5", "10", "100.25"',
          };
        }

        // Convert STX to microSTX (1 STX = 1,000,000 microSTX)
        const amountMicroStx = BigInt(Math.floor(amountStx * 1000000));

        // Check sender balance
        const senderBalance = await apiClient.getStxBalance(senderAddress);
        const senderBalanceMicroStx = BigInt(senderBalance);

        if (senderBalanceMicroStx < amountMicroStx) {
          return {
            success: false,
            error: `Insufficient balance. You have ${(Number(senderBalanceMicroStx) / 1000000).toFixed(6)} STX, trying to send ${amountStx} STX`,
            senderAddress,
            network: recipientNetwork,
          };
        }

        // Step 6: Validate memo length (max 34 bytes)
        if (args.memo && Buffer.from(args.memo, 'utf-8').length > 34) {
          return {
            success: false,
            error: 'Memo is too long. Maximum 34 bytes allowed.',
          };
        }

        // Step 7: Estimate transaction fee
        let fee: bigint;
        try {
          const estimatedFee = await apiClient.getFeeEstimate();
          fee = BigInt(Math.max(estimatedFee, 200)); // Minimum 200 microSTX
        } catch {
          fee = BigInt(1000); // Default fallback fee
        }

        // Check total amount (transfer + fee) doesn't exceed balance
        const totalRequired = amountMicroStx + fee;
        if (senderBalanceMicroStx < totalRequired) {
          return {
            success: false,
            error: `Insufficient balance for transfer + fee. Need ${(Number(totalRequired) / 1000000).toFixed(6)} STX total, have ${(Number(senderBalanceMicroStx) / 1000000).toFixed(6)} STX`,
            breakdown: {
              transfer: `${amountStx} STX`,
              fee: `${(Number(fee) / 1000000).toFixed(6)} STX`,
              total: `${(Number(totalRequired) / 1000000).toFixed(6)} STX`,
            },
          };
        }

        // Step 8: Create network object
        const network = recipientNetwork === 'mainnet'
          ? new StacksMainnet({ url: STACKS_MAINNET_API })
          : new StacksTestnet({ url: STACKS_TESTNET_API });

        // Build transaction options
        const txOptions = {
          recipient: args.recipient,
          amount: amountMicroStx,
          senderKey: privateKey,
          network: network,
          memo: args.memo || undefined,
          fee: fee,
          anchorMode: AnchorMode.Any,
        };

        // Create STX transfer transaction
        const transaction = await makeSTXTokenTransfer(txOptions);

        // Broadcast to network
        const broadcastResponse = await broadcastTransaction(transaction, network);

        // Check for broadcast errors
        if ('error' in broadcastResponse) {
          throw new Error(
            `Broadcast failed: ${broadcastResponse.error}${
              broadcastResponse.reason ? ` - ${broadcastResponse.reason}` : ''
            }`
          );
        }

        const txId = broadcastResponse.txid;
        if (!txId) {
          throw new Error('Transfer broadcast failed without a transaction ID');
        }

        // Success response
        const explorerUrl = recipientNetwork === 'mainnet'
          ? `https://explorer.hiro.so/txid/${txId}?chain=mainnet`
          : `https://explorer.hiro.so/txid/${txId}?chain=testnet`;

        return {
          success: true,
          txId,
          network: recipientNetwork,
          transfer: {
            from: senderAddress,
            to: args.recipient,
            amount: `${amountStx} STX`,
            fee: `${(Number(fee) / 1000000).toFixed(6)} STX`,
            memo: args.memo || null,
          },
          explorerUrl,
          message: `Successfully transferred ${amountStx} STX to ${args.recipient}`,
          estimatedConfirmationTime: 'Transactions typically confirm in 10-30 minutes on Stacks',
        };

      } catch (error: any) {
        // Get sender address for error reporting (if available)
        let senderAddress = 'unknown';
        try {
          const recipientNetwork = args.recipient.startsWith('SP') ? 'mainnet' : 'testnet';
          senderAddress = walletService.getAddressForNetwork(recipientNetwork);
        } catch {
          // Ignore if we can't get sender address
        }

        return {
          success: false,
          error: error.message,
          transferAttempt: {
            from: senderAddress,
            to: args.recipient,
            amount: args.amount,
            network: args.recipient.startsWith('SP') ? 'mainnet' : 'testnet',
          },
          troubleshooting: [
            'Verify you have sufficient STX balance for the transfer + fees',
            'Check that the recipient address is correct',
            'Ensure your wallet is unlocked',
            'Verify network connectivity',
            'For testnet: Get free STX from https://explorer.hiro.so/sandbox/faucet?chain=testnet',
          ],
        };
      }
    },
  },
});
