import { promises as fs } from 'fs';
import { WalletService } from './wallet.js';
import { WalletIndexManager } from '../utils/wallet-index.js';
import { DEFAULT_KEYSTORE_PATH, WALLET_INDEX_PATH } from '../utils/constants.js';
import { EncryptedKeystore } from '../types/index.js';

/**
 * Handles migration from legacy single-wallet system to multi-wallet system
 */
export class WalletMigration {
  private walletService: WalletService;
  private walletIndexManager: WalletIndexManager;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
    this.walletIndexManager = new WalletIndexManager();
  }

  /**
   * Check if migration is needed
   * Migration is needed if:
   * 1. wallets.json doesn't exist (no multi-wallet system)
   * 2. AND legacy wallet.enc exists
   */
  async needsMigration(): Promise<boolean> {
    // Check if wallets.json exists
    const indexExists = await this.walletIndexManager.exists();
    if (indexExists) {
      return false; // Already migrated
    }

    // Check if legacy wallet.enc exists
    try {
      await fs.access(DEFAULT_KEYSTORE_PATH);
      return true; // Legacy wallet exists, needs migration
    } catch {
      return false; // No wallet at all
    }
  }

  /**
   * Perform migration from legacy wallet to multi-wallet system
   *
   * IMPORTANT: Legacy wallet only has encrypted private key, NOT mnemonic.
   * This migration will:
   * 1. Inform user that original mnemonic is not recoverable
   * 2. Create a log/note about the migration
   * 3. User must re-import with mnemonic to use multi-account features
   */
  async migrate(): Promise<{
    success: boolean;
    migrated: boolean;
    message: string;
    requiresUserAction?: boolean;
    backupPath?: string;
  }> {
    try {
      // Check if migration needed
      const needsMigration = await this.needsMigration();
      if (!needsMigration) {
        return {
          success: true,
          migrated: false,
          message: 'No migration needed',
        };
      }

      // Backup legacy wallet
      const backupPath = `${DEFAULT_KEYSTORE_PATH}.bak`;
      await fs.copyFile(DEFAULT_KEYSTORE_PATH, backupPath);

      // Read legacy keystore to check if it's valid
      const keystoreData = await fs.readFile(DEFAULT_KEYSTORE_PATH, 'utf-8');
      const legacyKeystore: EncryptedKeystore = JSON.parse(keystoreData);

      // Create empty wallet index (user must import mnemonic manually)
      const emptyIndex = this.walletIndexManager.createEmptyIndex();
      emptyIndex.migrated = true;
      emptyIndex.migratedAt = new Date().toISOString();
      await this.walletIndexManager.saveWalletIndex(emptyIndex);

      // Create migration notice file
      const migrationNotice = {
        migratedAt: new Date().toISOString(),
        legacyWalletBackup: backupPath,
        legacyWalletAddress: legacyKeystore.address,
        message: [
          'MIGRATION NOTICE:',
          '',
          'Your wallet has been migrated to the new multi-wallet system.',
          '',
          'IMPORTANT: The old wallet format only stored the encrypted private key, not the mnemonic phrase.',
          'To use multi-account features, you must re-import your wallet using your original 24-word mnemonic phrase.',
          '',
          'Your old wallet has been backed up to: ' + backupPath,
          '',
          'Next steps:',
          '1. Find your original 24-word mnemonic phrase',
          '2. Use wallet_import to import your wallet with the mnemonic',
          '3. Verify the addresses match your original wallet',
          '',
          'If you do not have your mnemonic phrase:',
          '- Your old wallet backup is still available at: ' + backupPath,
          '- You can continue using the old system, but multi-account features will not be available',
          '- Consider creating a new wallet and transferring your funds',
        ].join('\n'),
      };

      const migrationNoticePath = DEFAULT_KEYSTORE_PATH + '.migration-notice.txt';
      await fs.writeFile(
        migrationNoticePath,
        migrationNotice.message,
        'utf-8'
      );

      return {
        success: true,
        migrated: true,
        message: [
          'Migration completed successfully.',
          '',
          'IMPORTANT: You need to re-import your wallet using your 24-word mnemonic phrase.',
          'Your old wallet has been backed up.',
          '',
          `Read ${migrationNoticePath} for detailed instructions.`,
        ].join('\n'),
        requiresUserAction: true,
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        migrated: false,
        message: `Migration failed: ${error.message}`,
      };
    }
  }

  /**
   * Check migration status
   */
  async getStatus(): Promise<{
    migrated: boolean;
    migratedAt?: string;
    legacyWalletExists: boolean;
    walletsCount: number;
  }> {
    const index = await this.walletIndexManager.loadWalletIndex();

    let legacyWalletExists = false;
    try {
      await fs.access(DEFAULT_KEYSTORE_PATH);
      legacyWalletExists = true;
    } catch {
      legacyWalletExists = false;
    }

    return {
      migrated: index.migrated,
      migratedAt: index.migratedAt,
      legacyWalletExists,
      walletsCount: index.wallets.length,
    };
  }
}
