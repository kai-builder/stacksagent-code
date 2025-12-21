import { promises as fs } from 'fs';
import { WalletIndex, WalletMetadata } from '../types/index.js';
import { WALLET_INDEX_PATH, WALLETS_DIR } from './constants.js';

/**
 * WalletIndexManager handles loading, saving, and manipulating the wallet index file (wallets.json).
 * The wallet index contains metadata about all wallets without storing sensitive data.
 */
export class WalletIndexManager {
  /**
   * Load the wallet index from disk
   */
  async loadWalletIndex(): Promise<WalletIndex> {
    try {
      const data = await fs.readFile(WALLET_INDEX_PATH, 'utf-8');
      return JSON.parse(data) as WalletIndex;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty index
        return this.createEmptyIndex();
      }
      throw new Error(`Failed to load wallet index: ${error.message}`);
    }
  }

  /**
   * Save the wallet index to disk
   */
  async saveWalletIndex(index: WalletIndex): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(WALLETS_DIR, { recursive: true });

      // Write index file
      await fs.writeFile(WALLET_INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to save wallet index: ${error.message}`);
    }
  }

  /**
   * Create an empty wallet index
   */
  createEmptyIndex(): WalletIndex {
    return {
      version: 1,
      wallets: [],
      activeWalletId: null,
      migrated: false,
    };
  }

  /**
   * Add a wallet to the index
   */
  async addWallet(walletMetadata: WalletMetadata): Promise<WalletIndex> {
    const index = await this.loadWalletIndex();

    // Check if wallet ID already exists
    if (index.wallets.find((w) => w.id === walletMetadata.id)) {
      throw new Error(`Wallet with ID ${walletMetadata.id} already exists`);
    }

    // Add wallet
    index.wallets.push(walletMetadata);

    // If this is the first wallet, set it as active
    if (index.activeWalletId === null) {
      index.activeWalletId = walletMetadata.id;
    }

    await this.saveWalletIndex(index);
    return index;
  }

  /**
   * Remove a wallet from the index
   */
  async removeWallet(walletId: string): Promise<WalletIndex> {
    const index = await this.loadWalletIndex();

    // Find wallet
    const walletIndex = index.wallets.findIndex((w) => w.id === walletId);
    if (walletIndex === -1) {
      throw new Error(`Wallet with ID ${walletId} not found`);
    }

    // Remove wallet
    index.wallets.splice(walletIndex, 1);

    // If this was the active wallet, switch to another or null
    if (index.activeWalletId === walletId) {
      index.activeWalletId = index.wallets.length > 0 ? index.wallets[0].id : null;
    }

    await this.saveWalletIndex(index);
    return index;
  }

  /**
   * Update wallet metadata
   */
  async updateWallet(walletId: string, updates: Partial<WalletMetadata>): Promise<WalletIndex> {
    const index = await this.loadWalletIndex();

    // Find wallet
    const wallet = index.wallets.find((w) => w.id === walletId);
    if (!wallet) {
      throw new Error(`Wallet with ID ${walletId} not found`);
    }

    // Update fields (excluding id which should never change)
    Object.assign(wallet, { ...updates, id: walletId });

    await this.saveWalletIndex(index);
    return index;
  }

  /**
   * Set the active wallet
   */
  async setActiveWallet(walletId: string): Promise<WalletIndex> {
    const index = await this.loadWalletIndex();

    // Check if wallet exists
    const wallet = index.wallets.find((w) => w.id === walletId);
    if (!wallet) {
      throw new Error(`Wallet with ID ${walletId} not found`);
    }

    // Update active wallet and last used timestamp
    index.activeWalletId = walletId;
    wallet.lastUsed = new Date().toISOString();

    await this.saveWalletIndex(index);
    return index;
  }

  /**
   * Get wallet metadata by ID
   */
  async getWallet(walletId: string): Promise<WalletMetadata | null> {
    const index = await this.loadWalletIndex();
    return index.wallets.find((w) => w.id === walletId) || null;
  }

  /**
   * Get wallet metadata by label
   */
  async getWalletByLabel(label: string): Promise<WalletMetadata | null> {
    const index = await this.loadWalletIndex();
    return index.wallets.find((w) => w.label.toLowerCase() === label.toLowerCase()) || null;
  }

  /**
   * Check if wallet index exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(WALLET_INDEX_PATH);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mark index as migrated from legacy wallet
   */
  async markMigrated(): Promise<WalletIndex> {
    const index = await this.loadWalletIndex();
    index.migrated = true;
    index.migratedAt = new Date().toISOString();
    await this.saveWalletIndex(index);
    return index;
  }
}
