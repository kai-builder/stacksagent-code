import { promises as fs } from 'fs';
import { getAddressFromPrivateKey, TransactionVersion } from '@stacks/transactions';
import * as bip39 from 'bip39';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption.js';
import { EncryptedKeystore, WalletInfo, WalletBalance, TokenBalance } from '../types/index.js';
import { configManager } from '../utils/config.js';
import { WELL_KNOWN_TOKENS } from '../utils/constants.js';
import { StacksApiClient } from './stacks-api.js';

export class WalletService {
  private privateKey: string | null = null;
  private address: string | null = null;
  private apiClient: StacksApiClient;

  constructor() {
    const config = configManager.get();
    this.apiClient = new StacksApiClient(config.network);
  }

  /**
   * Creates a new wallet with a generated mnemonic
   */
  async createWallet(password: string): Promise<{
    mnemonic: string;
    mainnetAddress: string;
    testnetAddress: string;
    keystorePath: string
  }> {
    // Generate 24-word mnemonic
    const mnemonic = bip39.generateMnemonic(256);

    // Derive private key from mnemonic
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const privateKey = seed.slice(0, 32).toString('hex');

    // Get both mainnet and testnet addresses
    const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
    const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

    // Get current network from config
    const config = configManager.get();
    const currentAddress = config.network === 'mainnet' ? mainnetAddress : testnetAddress;

    // Encrypt and save keystore
    const keystore = await encryptPrivateKey(privateKey, password);
    keystore.address = currentAddress;

    const keystorePath = config.wallet.keystorePath;
    await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2), 'utf-8');

    // Set current wallet
    this.privateKey = privateKey;
    this.address = currentAddress;

    return { mnemonic, mainnetAddress, testnetAddress, keystorePath };
  }

  /**
   * Imports a wallet from mnemonic or private key
   */
  async importWallet(
    mnemonicOrPrivateKey: string,
    password: string
  ): Promise<{ mainnetAddress: string; testnetAddress: string; keystorePath: string }> {
    let privateKey: string;

    // Check if input is a mnemonic or private key
    if (bip39.validateMnemonic(mnemonicOrPrivateKey.trim())) {
      // It's a mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonicOrPrivateKey.trim());
      privateKey = seed.slice(0, 32).toString('hex');
    } else {
      // Assume it's a private key
      privateKey = mnemonicOrPrivateKey.replace(/^0x/, '').trim();

      // Validate private key format (should be 64 hex characters)
      if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format. Expected 64 hex characters.');
      }
    }

    // Get both mainnet and testnet addresses
    const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
    const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

    // Get current network from config
    const config = configManager.get();
    const currentAddress = config.network === 'mainnet' ? mainnetAddress : testnetAddress;

    // Encrypt and save keystore
    const keystore = await encryptPrivateKey(privateKey, password);
    keystore.address = currentAddress;

    const keystorePath = config.wallet.keystorePath;
    await fs.writeFile(keystorePath, JSON.stringify(keystore, null, 2), 'utf-8');

    // Set current wallet
    this.privateKey = privateKey;
    this.address = currentAddress;

    return { mainnetAddress, testnetAddress, keystorePath };
  }

  /**
   * Unlocks the wallet using password
   */
  async unlockWallet(password: string): Promise<{
    mainnetAddress: string;
    testnetAddress: string;
    currentAddress: string;
    network: 'mainnet' | 'testnet';
  }> {
    const config = configManager.get();
    const keystorePath = config.wallet.keystorePath;

    try {
      const keystoreData = await fs.readFile(keystorePath, 'utf-8');
      const keystore: EncryptedKeystore = JSON.parse(keystoreData);

      const privateKey = await decryptPrivateKey(keystore, password);

      // Derive both mainnet and testnet addresses
      const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
      const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

      // Set current address based on config
      const currentAddress = config.network === 'mainnet' ? mainnetAddress : testnetAddress;

      this.privateKey = privateKey;
      this.address = currentAddress;

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
   * Locks the wallet (clears private key from memory)
   */
  lockWallet(): void {
    this.privateKey = null;
    this.address = null;
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
        const balance = await apiClient.getTokenBalance(
          targetAddress,
          tokenInfo.contract
        );

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
   * Checks if wallet exists
   */
  async walletExists(): Promise<boolean> {
    const config = configManager.get();
    try {
      await fs.access(config.wallet.keystorePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if wallet is currently unlocked
   */
  isUnlocked(): boolean {
    return this.privateKey !== null && this.address !== null;
  }
}
