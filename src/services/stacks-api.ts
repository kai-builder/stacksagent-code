import axios, { AxiosInstance } from 'axios';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../utils/constants.js';
import { Transaction } from '../types/index.js';

export class StacksApiClient {
  private client: AxiosInstance;
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    const baseURL = network === 'mainnet' ? STACKS_MAINNET_API : STACKS_TESTNET_API;

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Gets STX balance for an address
   */
  async getStxBalance(address: string): Promise<string> {
    try {
      const response = await this.client.get(`/extended/v1/address/${address}/balances`);
      return response.data.stx.balance;
    } catch (error: any) {
      throw new Error(`Failed to fetch STX balance: ${error.message}`);
    }
  }

  /**
   * Gets token balance for a specific contract
   */
  async getTokenBalance(address: string, contractAddress: string): Promise<string> {
    try {
      const response = await this.client.get(`/extended/v1/address/${address}/balances`);
      const fungibleTokens = response.data.fungible_tokens || {};

      // Find the token balance
      const tokenKey = `${contractAddress}::${contractAddress.split('.')[1]}`;
      const tokenBalance = fungibleTokens[tokenKey];

      return tokenBalance?.balance || '0';
    } catch (error: any) {
      throw new Error(`Failed to fetch token balance: ${error.message}`);
    }
  }

  /**
   * Gets account info including nonce
   */
  async getAccountInfo(address: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/accounts/${address}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch account info: ${error.message}`);
    }
  }

  /**
   * Broadcasts a transaction
   */
  async broadcastTransaction(serializedTx: string): Promise<string> {
    try {
      const response = await this.client.post('/v2/transactions', serializedTx, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
      return response.data.txid;
    } catch (error: any) {
      throw new Error(`Failed to broadcast transaction: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Gets transaction details
   */
  async getTransaction(txId: string): Promise<any> {
    try {
      const response = await this.client.get(`/extended/v1/tx/${txId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
  }

  /**
   * Gets recent transactions for an address
   */
  async getTransactions(address: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const response = await this.client.get(`/extended/v1/address/${address}/transactions`, {
        params: { limit },
      });

      return response.data.results.map((tx: any) => ({
        txHash: tx.tx_id,
        timestamp: tx.burn_block_time,
        type: tx.tx_type,
        from: tx.sender_address,
        to: tx.token_transfer?.recipient_address,
        amount: tx.token_transfer?.amount,
        status: tx.tx_status === 'success' ? 'success' : tx.tx_status === 'pending' ? 'pending' : 'failed',
        description: this.getTxDescription(tx),
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  /**
   * Gets PoX info (stacking information)
   */
  async getPoxInfo(): Promise<any> {
    try {
      const response = await this.client.get('/v2/pox');
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch PoX info: ${error.message}`);
    }
  }

  /**
   * Gets stacking cycles history
   */
  async getStackingCycles(limit: number = 10, offset: number = 0): Promise<any> {
    try {
      const response = await this.client.get('/extended/v2/pox/cycles', {
        params: { limit, offset },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch stacking cycles: ${error.message}`);
    }
  }

  /**
   * Gets signers for a specific cycle
   */
  async getSigners(cycleId: number, limit: number = 50, offset: number = 0): Promise<any> {
    try {
      const response = await this.client.get(`/extended/v2/pox/cycles/${cycleId}/signers`, {
        params: { limit, offset },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch signers: ${error.message}`);
    }
  }

  /**
   * Gets pool delegations (delegated stackers)
   */
  async getPoolDelegations(poolAddress: string, limit: number = 50, offset: number = 0): Promise<any> {
    try {
      const response = await this.client.get('/extended/v1/pox/delegations', {
        params: {
          pool_address: poolAddress,
          limit,
          offset
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch pool delegations: ${error.message}`);
    }
  }

  /**
   * Gets burnchain rewards (BTC rewards distributed)
   */
  async getBurnchainRewards(limit: number = 20, offset: number = 0): Promise<any> {
    try {
      const response = await this.client.get('/extended/v1/burnchain/rewards', {
        params: { limit, offset },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch burnchain rewards: ${error.message}`);
    }
  }

  /**
   * Gets burnchain rewards for a specific BTC address
   */
  async getBurnchainRewardsByAddress(btcAddress: string, limit: number = 20): Promise<any> {
    try {
      const response = await this.client.get(`/extended/v1/burnchain/rewards/${btcAddress}`, {
        params: { limit },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch burnchain rewards for address: ${error.message}`);
    }
  }

  /**
   * Gets stacking positions from the Stacking Tracker API
   */
  async getStackingPositions(address: string): Promise<any> {
    try {
      const response = await axios.get(`https://api.stacking-tracker.com/positions/${address}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'stacksagent-mcp',
        },
      });
      return response.data;
    } catch (error: any) {
      // Return empty array if not found (404) or if there's an error
      if (error.response?.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch stacking positions: ${error.message}`);
    }
  }

  /**
   * Calls a read-only contract function
   */
  async callReadOnly(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[],
    sender: string
  ): Promise<any> {
    try {
      const [address, name] = contractAddress.includes('.')
        ? contractAddress.split('.')
        : [contractAddress, contractName];

      const response = await this.client.post(`/v2/contracts/call-read/${address}/${name}/${functionName}`, {
        sender,
        arguments: functionArgs,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to call read-only function: ${error.message}`);
    }
  }

  /**
   * Gets current fee estimates
   */
  async getFeeEstimate(): Promise<number> {
    try {
      const response = await this.client.get('/v2/fees/transfer');
      return parseInt(response.data, 10);
    } catch (error: any) {
      // Return default fee if API fails
      return 1000;
    }
  }

  /**
   * Helper to generate transaction description
   */
  private getTxDescription(tx: any): string {
    switch (tx.tx_type) {
      case 'token_transfer':
        return `Sent ${tx.token_transfer.amount} STX to ${tx.token_transfer.recipient_address}`;
      case 'contract_call':
        return `Called ${tx.contract_call.function_name} on ${tx.contract_call.contract_id}`;
      case 'smart_contract':
        return `Deployed contract ${tx.smart_contract.contract_id}`;
      default:
        return tx.tx_type;
    }
  }
}
