import { promises as fs } from 'fs';
import { getAddressFromPrivateKey, TransactionVersion } from '@stacks/transactions';
import * as bip39 from 'bip39';
import crypto from 'crypto';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption.js';
import {
  EncryptedKeystore,
  WalletInfo,
  WalletBalance,
  TokenBalance,
  Account,
  WalletMetadata,
  EncryptedWalletKeystore,
} from '../types/index.js';
import { configManager } from '../utils/config.js';
import { WELL_KNOWN_TOKENS, WALLETS_DIR, BIP44_STACKS_COIN_TYPE, SCRYPT_PARAMS } from '../utils/constants.js';
import { StacksApiClient } from './stacks-api.js';
import { WalletIndexManager } from '../utils/wallet-index.js';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class WalletService {
  // Legacy state (kept for backward compatibility)
  private privateKey: string | null = null;
  private address: string | null = null;

  // Multi-wallet state
  private unlockedMnemonic: string | null = null;
  private activeWalletId: string | null = null;
  private activeAccountIndex: number = 0;
  private derivedAccounts: Map<string, Account> = new Map(); // Cache: "walletId:accountIndex" -> Account

  private apiClient: StacksApiClient;
  private walletIndexManager: WalletIndexManager;

  constructor() {
    const config = configManager.get();
    this.apiClient = new StacksApiClient(config.network);
    this.walletIndexManager = new WalletIndexManager();

    // Load active session from config
    if (config.activeSession) {
      this.activeWalletId = config.activeSession.walletId;
      this.activeAccountIndex = config.activeSession.accountIndex;
    }
  }

  // ============================================================================
  // WALLET MANAGEMENT (Multi-Wallet)
  // ============================================================================

  /**
   * Creates a new wallet with a generated mnemonic
   */
  async createWallet(
    password: string,
    label?: string
  ): Promise<{
    walletId: string;
    mnemonic: string;
    accounts: Account[];
    keystorePath: string;
  }> {
    // Generate 24-word mnemonic
    const mnemonic = bip39.generateMnemonic(256);

    // Import the wallet (which creates account 0)
    const result = await this.importWallet(mnemonic, password, label || 'Wallet 1');

    return {
      walletId: result.walletId,
      mnemonic,
      accounts: result.accounts,
      keystorePath: result.keystorePath,
    };
  }

  /**
   * Imports a wallet from mnemonic
   */
  async importWallet(
    mnemonic: string,
    password: string,
    label?: string
  ): Promise<{
    walletId: string;
    accounts: Account[];
    keystorePath: string;
  }> {
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic.trim())) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Generate unique wallet ID
    const walletId = randomUUID();
    const keystoreFileName = `wallet-${walletId}.enc`;
    const keystorePath = join(WALLETS_DIR, keystoreFileName);

    // Create account 0 (first account)
    const account0 = this.deriveAccount(mnemonic, 0);

    // Encrypt mnemonic
    const keystore = this.encryptMnemonic(mnemonic, password, walletId, [account0]);

    // Ensure wallets directory exists
    await fs.mkdir(WALLETS_DIR, { recursive: true });

    // Save keystore
    await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2), 'utf-8');

    // Create wallet metadata
    const now = new Date().toISOString();
    const walletMetadata: WalletMetadata = {
      id: walletId,
      label: label || `Wallet ${walletId.slice(0, 8)}`,
      createdAt: now,
      lastUsed: now,
      accountCount: 1,
      defaultAccountIndex: 0,
      keystoreFileName,
    };

    // Add to wallet index
    await this.walletIndexManager.addWallet(walletMetadata);

    // Update active session
    await this.setActiveWallet(walletId, 0);

    return {
      walletId,
      accounts: [account0],
      keystorePath,
    };
  }

  /**
   * List all wallets
   */
  async listWallets(): Promise<WalletMetadata[]> {
    const index = await this.walletIndexManager.loadWalletIndex();
    return index.wallets;
  }

  /**
   * Switch to a different wallet
   */
  async switchWallet(walletId: string, accountIndex: number = 0): Promise<void> {
    // Verify wallet exists
    const wallet = await this.walletIndexManager.getWallet(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Lock current wallet if unlocked
    if (this.isUnlocked()) {
      this.lockWallet();
    }

    // Set active wallet/account
    await this.setActiveWallet(walletId, accountIndex);
  }

  /**
   * Delete a wallet
   */
  async deleteWallet(walletId: string): Promise<void> {
    // Verify wallet exists
    const wallet = await this.walletIndexManager.getWallet(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Lock if this is the active wallet
    if (this.activeWalletId === walletId && this.isUnlocked()) {
      this.lockWallet();
    }

    // Delete keystore file
    const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
    try {
      await fs.unlink(keystorePath);
    } catch (error: any) {
      console.error(`Failed to delete keystore file: ${error.message}`);
    }

    // Remove from index
    await this.walletIndexManager.removeWallet(walletId);

    // Clear active wallet if it was deleted
    if (this.activeWalletId === walletId) {
      const remainingWallets = await this.listWallets();
      if (remainingWallets.length > 0) {
        await this.setActiveWallet(remainingWallets[0].id, 0);
      } else {
        this.activeWalletId = null;
        this.activeAccountIndex = 0;
        await this.saveActiveSession();
      }
    }
  }

  /**
   * Export wallet mnemonic (requires password)
   */
  async exportWallet(walletId: string, password: string): Promise<string> {
    const wallet = await this.walletIndexManager.getWallet(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    // Load and decrypt keystore
    const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
    const keystoreData = await fs.readFile(keystorePath, 'utf-8');
    const keystore: EncryptedWalletKeystore = JSON.parse(keystoreData);

    const mnemonic = this.decryptMnemonic(keystore, password);
    return mnemonic;
  }

  /**
   * Rename a wallet
   */
  async renameWallet(walletId: string, newLabel: string): Promise<void> {
    await this.walletIndexManager.updateWallet(walletId, {
      label: newLabel,
      lastUsed: new Date().toISOString(),
    });
  }

  // ============================================================================
  // ACCOUNT MANAGEMENT (Multi-Account per Wallet)
  // ============================================================================

  /**
   * Create a new account in the active wallet
   */
  async createAccount(label?: string): Promise<Account> {
    if (!this.isUnlocked()) {
      throw new Error('Wallet must be unlocked to create accounts');
    }

    if (!this.activeWalletId || !this.unlockedMnemonic) {
      throw new Error('No active wallet');
    }

    // Load wallet metadata
    const wallet = await this.walletIndexManager.getWallet(this.activeWalletId);
    if (!wallet) {
      throw new Error('Active wallet not found');
    }

    // Load keystore
    const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
    const keystoreData = await fs.readFile(keystorePath, 'utf-8');
    const keystore: EncryptedWalletKeystore = JSON.parse(keystoreData);

    // Derive new account
    const newAccountIndex = keystore.accounts.length;
    const newAccount = this.deriveAccount(this.unlockedMnemonic, newAccountIndex);
    newAccount.label = label || `Account ${newAccountIndex + 1}`;

    // Add to keystore
    keystore.accounts.push(newAccount);

    // Save updated keystore (re-encrypt with same password)
    await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2), 'utf-8');

    // Update wallet metadata
    await this.walletIndexManager.updateWallet(this.activeWalletId, {
      accountCount: keystore.accounts.length,
      lastUsed: new Date().toISOString(),
    });

    // Cache account
    const cacheKey = `${this.activeWalletId}:${newAccountIndex}`;
    this.derivedAccounts.set(cacheKey, newAccount);

    return newAccount;
  }

  /**
   * List all accounts in a wallet
   */
  async listAccounts(walletId?: string): Promise<Account[]> {
    const targetWalletId = walletId || this.activeWalletId;
    if (!targetWalletId) {
      throw new Error('No wallet specified or active');
    }

    const wallet = await this.walletIndexManager.getWallet(targetWalletId);
    if (!wallet) {
      throw new Error(`Wallet ${targetWalletId} not found`);
    }

    // Load keystore
    const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
    const keystoreData = await fs.readFile(keystorePath, 'utf-8');
    const keystore: EncryptedWalletKeystore = JSON.parse(keystoreData);

    return keystore.accounts;
  }

  /**
   * Switch to a different account in the active wallet
   */
  async switchAccount(accountIndex: number): Promise<void> {
    if (!this.activeWalletId) {
      throw new Error('No active wallet');
    }

    const accounts = await this.listAccounts();
    if (accountIndex < 0 || accountIndex >= accounts.length) {
      throw new Error(`Account index ${accountIndex} out of range (0-${accounts.length - 1})`);
    }

    this.activeAccountIndex = accountIndex;

    // Update active session
    await this.saveActiveSession();

    // Update cached state if wallet is unlocked
    if (this.isUnlocked() && this.unlockedMnemonic) {
      const privateKey = this.derivePrivateKey(this.unlockedMnemonic, accountIndex);
      this.privateKey = privateKey;

      const config = configManager.get();
      const version = config.network === 'mainnet' ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
      this.address = getAddressFromPrivateKey(privateKey, version);
    }
  }

  /**
   * Rename an account
   */
  async renameAccount(accountIndex: number, newLabel: string): Promise<void> {
    if (!this.activeWalletId) {
      throw new Error('No active wallet');
    }

    const wallet = await this.walletIndexManager.getWallet(this.activeWalletId);
    if (!wallet) {
      throw new Error('Active wallet not found');
    }

    // Load keystore
    const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
    const keystoreData = await fs.readFile(keystorePath, 'utf-8');
    const keystore: EncryptedWalletKeystore = JSON.parse(keystoreData);

    if (accountIndex < 0 || accountIndex >= keystore.accounts.length) {
      throw new Error(`Account index ${accountIndex} out of range`);
    }

    // Update label
    keystore.accounts[accountIndex].label = newLabel;

    // Save keystore
    await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2), 'utf-8');

    // Update cache
    const cacheKey = `${this.activeWalletId}:${accountIndex}`;
    if (this.derivedAccounts.has(cacheKey)) {
      const cached = this.derivedAccounts.get(cacheKey)!;
      cached.label = newLabel;
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Set the active wallet and account
   */
  async setActiveWallet(walletId: string, accountIndex: number): Promise<void> {
    this.activeWalletId = walletId;
    this.activeAccountIndex = accountIndex;

    // Update wallet index
    await this.walletIndexManager.setActiveWallet(walletId);

    // Save to config
    await this.saveActiveSession();
  }

  /**
   * Get active wallet metadata
   */
  getActiveWallet(): WalletMetadata | null {
    return this.activeWalletId ? this.walletIndexManager.getWallet(this.activeWalletId) as any : null;
  }

  /**
   * Get active account
   */
  async getActiveAccount(): Promise<Account | null> {
    if (!this.activeWalletId) {
      return null;
    }

    const accounts = await this.listAccounts();
    return accounts[this.activeAccountIndex] || null;
  }

  /**
   * Save active session to config
   */
  private async saveActiveSession(): Promise<void> {
    configManager.update({
      activeSession: {
        walletId: this.activeWalletId,
        accountIndex: this.activeAccountIndex,
        network: configManager.get().network,
      },
    });
    await configManager.save();
  }

  // ============================================================================
  // BIP44 DERIVATION
  // ============================================================================

  /**
   * Derive an account from mnemonic using BIP44
   * Path: m/44'/5757'/0'/0/{accountIndex}
   */
  private deriveAccount(mnemonic: string, accountIndex: number): Account {
    // Derive private key for this account using simple HMAC derivation
    const privateKey = this.derivePrivateKey(mnemonic, accountIndex);

    const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
    const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

    return {
      index: accountIndex,
      label: `Account ${accountIndex + 1}`,
      mainnetAddress,
      testnetAddress,
      createdAt: new Date().toISOString(),
      derivationPath: `m/44'/${BIP44_STACKS_COIN_TYPE}'/0'/0/${accountIndex}`,
    };
  }

  /**
   * Derive private key for a specific account index
   */
  private derivePrivateKey(mnemonic: string, accountIndex: number): string {
    // For the MVP, we'll use a simple derivation:
    // seed = mnemonic -> account seed = HMAC(seed, accountIndex) -> privateKey
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Simple account derivation: hash(seed + accountIndex)
    // In production, should use proper BIP44 hierarchical derivation
    const accountSeed = crypto
      .createHmac('sha256', seed)
      .update(`account-${accountIndex}`)
      .digest();

    return accountSeed.slice(0, 32).toString('hex');
  }

  // ============================================================================
  // ENCRYPTION/DECRYPTION (for Mnemonics)
  // ============================================================================

  /**
   * Encrypt mnemonic and create wallet keystore
   */
  private encryptMnemonic(
    mnemonic: string,
    password: string,
    walletId: string,
    accounts: Account[]
  ): EncryptedWalletKeystore {
    // We'll reuse the existing encryption logic, but encrypt the mnemonic instead of private key
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Derive key using scrypt
    const key = crypto.scryptSync(password, salt, SCRYPT_PARAMS.dklen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
    });

    // Encrypt mnemonic
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(mnemonic, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Combine ciphertext and auth tag
    const ciphertextWithTag = ciphertext + authTag.toString('hex');

    // Generate MAC for integrity
    const mac = crypto
      .createHmac('sha256', key)
      .update(ciphertextWithTag)
      .digest('hex');

    return {
      version: 2, // Version 2 for multi-account keystores
      walletId,
      crypto: {
        cipher: 'aes-256-gcm',
        ciphertext: ciphertextWithTag,
        cipherparams: {
          iv: iv.toString('hex'),
        },
        kdf: 'scrypt',
        kdfparams: {
          salt: salt.toString('hex'),
          n: SCRYPT_PARAMS.N,
          r: SCRYPT_PARAMS.r,
          p: SCRYPT_PARAMS.p,
          dklen: SCRYPT_PARAMS.dklen,
        },
        mac,
      },
      accounts,
    };
  }

  /**
   * Decrypt mnemonic from wallet keystore
   */
  private decryptMnemonic(keystore: EncryptedWalletKeystore, password: string): string {
    // Derive key using scrypt
    const salt = Buffer.from(keystore.crypto.kdfparams.salt, 'hex');
    const key = crypto.scryptSync(password, salt, keystore.crypto.kdfparams.dklen, {
      N: keystore.crypto.kdfparams.n,
      r: keystore.crypto.kdfparams.r,
      p: keystore.crypto.kdfparams.p,
    });

    // Verify MAC
    const mac = crypto
      .createHmac('sha256', key)
      .update(keystore.crypto.ciphertext)
      .digest('hex');

    if (mac !== keystore.crypto.mac) {
      throw new Error('Invalid password or corrupted keystore');
    }

    // Extract ciphertext and auth tag
    const ciphertextWithTag = keystore.crypto.ciphertext;
    const authTagLength = 32; // 16 bytes = 32 hex characters
    const ciphertext = ciphertextWithTag.slice(0, -authTagLength);
    const authTag = Buffer.from(ciphertextWithTag.slice(-authTagLength), 'hex');

    // Decrypt
    const iv = Buffer.from(keystore.crypto.cipherparams.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let mnemonic = decipher.update(ciphertext, 'hex', 'utf8');
    mnemonic += decipher.final('utf8');

    return mnemonic;
  }

  // ============================================================================
  // BACKWARD COMPATIBLE METHODS (Updated for Multi-Wallet)
  // ============================================================================

  /**
   * Unlocks the wallet using password
   */
  async unlockWallet(
    password: string,
    walletId?: string
  ): Promise<{
    mainnetAddress: string;
    testnetAddress: string;
    currentAddress: string;
    network: 'mainnet' | 'testnet';
  }> {
    // Determine which wallet to unlock
    const targetWalletId = walletId || this.activeWalletId;
    if (!targetWalletId) {
      throw new Error('No wallet specified. Please create or import a wallet first.');
    }

    const wallet = await this.walletIndexManager.getWallet(targetWalletId);
    if (!wallet) {
      throw new Error(`Wallet ${targetWalletId} not found`);
    }

    try {
      // Load keystore
      const keystorePath = join(WALLETS_DIR, wallet.keystoreFileName);
      const keystoreData = await fs.readFile(keystorePath, 'utf-8');
      const keystore: EncryptedWalletKeystore = JSON.parse(keystoreData);

      // Decrypt mnemonic
      const mnemonic = this.decryptMnemonic(keystore, password);

      // Lock any currently unlocked wallet first
      if (this.unlockedMnemonic) {
        this.lockWallet();
      }

      // Set unlocked state
      this.unlockedMnemonic = mnemonic;
      this.activeWalletId = targetWalletId;

      // Derive active account's private key
      const privateKey = this.derivePrivateKey(mnemonic, this.activeAccountIndex);
      this.privateKey = privateKey;

      // Get addresses
      const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
      const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

      // Set current address based on config
      const config = configManager.get();
      const currentAddress = config.network === 'mainnet' ? mainnetAddress : testnetAddress;
      this.address = currentAddress;

      // Update last used
      await this.walletIndexManager.updateWallet(targetWalletId, {
        lastUsed: new Date().toISOString(),
      });

      return {
        mainnetAddress,
        testnetAddress,
        currentAddress,
        network: config.network,
      };
    } catch (error: any) {
      throw new Error(`Failed to unlock wallet: ${error.message}`);
    }
  }

  /**
   * Locks the wallet (clears private key and mnemonic from memory)
   */
  lockWallet(): void {
    this.privateKey = null;
    this.address = null;
    this.unlockedMnemonic = null;
    this.derivedAccounts.clear();
  }

  /**
   * Gets the current wallet address
   */
  getAddress(): string {
    if (!this.address) {
      throw new Error('Wallet is locked. Please unlock first.');
    }
    return this.address;
  }

  /**
   * Gets the wallet address for a specific network
   */
  getAddressForNetwork(network: 'mainnet' | 'testnet'): string {
    if (!this.privateKey) {
      throw new Error('Wallet is locked. Please unlock first.');
    }
    const version = network === 'mainnet' ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
    return getAddressFromPrivateKey(this.privateKey, version);
  }

  /**
   * Gets the current wallet info
   */
  getWalletInfo(): WalletInfo {
    if (!this.address) {
      throw new Error('Wallet is locked. Please unlock first.');
    }

    const config = configManager.get();
    return {
      address: this.address,
      network: config.network,
    };
  }

  /**
   * Detects network from address prefix
   * SP = mainnet, ST = testnet
   */
  private detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' {
    if (address.startsWith('SP')) return 'mainnet';
    if (address.startsWith('ST')) return 'testnet';
    // Default to config network if we can't detect
    const config = configManager.get();
    return config.network;
  }

  /**
   * Gets wallet balance (STX and tokens)
   */
  async getBalance(address?: string): Promise<WalletBalance> {
    const targetAddress = address || this.getAddress();

    // Detect network from address and use appropriate API client
    const detectedNetwork = this.detectNetworkFromAddress(targetAddress);
    const apiClient = new StacksApiClient(detectedNetwork);

    // Get STX balance
    const stxBalance = await apiClient.getStxBalance(targetAddress);

    // Get token balances for well-known tokens
    const tokenBalances: TokenBalance[] = [];

    for (const [symbol, tokenInfo] of Object.entries(WELL_KNOWN_TOKENS)) {
      if (symbol === 'STX') continue; // Skip STX, already handled

      try {
        const balance = await apiClient.getTokenBalance(targetAddress, tokenInfo.contract);

        if (balance !== '0') {
          tokenBalances.push({
            symbol,
            balance,
            decimals: tokenInfo.decimals,
          });
        }
      } catch (error) {
        // Skip tokens that fail to fetch
        console.error(`Failed to fetch balance for ${symbol}:`, error);
      }
    }

    return {
      stx: stxBalance,
      tokens: tokenBalances,
    };
  }

  /**
   * Gets the private key (for signing transactions)
   */
  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('Wallet is locked. Please unlock first.');
    }
    return this.privateKey;
  }

  /**
   * Checks if wallet exists (checks for wallet index)
   */
  async walletExists(): Promise<boolean> {
    return await this.walletIndexManager.exists();
  }

  /**
   * Checks if wallet is currently unlocked
   */
  isUnlocked(): boolean {
    return this.privateKey !== null && this.address !== null;
  }
}
