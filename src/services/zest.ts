/**
 * Zest Protocol Service
 * Handles lending/borrowing operations on Zest Protocol
 */

import {
  makeContractCall,
  broadcastTransaction,
  contractPrincipalCV,
  uintCV,
  noneCV,
  someCV,
  bufferCV,
  listCV,
  tupleCV,
  standardPrincipalCV,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import {
  ZEST_CONTRACTS,
  ZEST_ASSETS,
  ZEST_ASSETS_LIST,
  ZEST_PARAMS,
  ZestCollateralAsset,
  ZestBorrowAsset,
} from '../utils/zest-constants.js';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../utils/constants.js';
import { PythService } from './pyth.js';

export interface ZestSupplyParams {
  asset: ZestCollateralAsset;
  amount: string; // human readable, e.g., "0.5" for 0.5 sBTC
}

export interface ZestSupplyResult {
  success: boolean;
  txId: string;
  amount: string;
  asset: string;
}

export interface ZestBorrowParams {
  assetToBorrow: ZestBorrowAsset;
  amount: string; // human readable, e.g., "50000" for $50,000
  interestRateMode?: 0 | 1; // 0 = stable, 1 = variable (default: 0)
}

export interface ZestBorrowResult {
  success: boolean;
  txId: string;
  amount: string;
  asset: string;
  interestRateMode: number;
}

export interface ZestRepayParams {
  asset: ZestBorrowAsset;
  amount: string | 'max'; // "max" = repay everything
  onBehalfOf?: string; // defaults to sender
}

export interface ZestRepayResult {
  success: boolean;
  txId: string;
  amount: string;
  asset: string;
}

export interface ZestWithdrawParams {
  asset: ZestCollateralAsset;
  amount: string; // human readable
}

export interface ZestWithdrawResult {
  success: boolean;
  txId: string;
  amount: string;
  asset: string;
}

export class ZestService {
  private pythService: PythService;
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    this.pythService = new PythService();
  }

  /**
   * Supply collateral to Zest Protocol
   */
  async supply(
    params: ZestSupplyParams,
    senderAddress: string,
    senderKey: string
  ): Promise<ZestSupplyResult> {
    try {
      const assetConfig = ZEST_ASSETS[params.asset];
      if (!assetConfig) {
        throw new Error(`Unsupported asset: ${params.asset}`);
      }

      const amountMicro = Math.floor(parseFloat(params.amount) * Math.pow(10, assetConfig.decimals));

      const [lpAddress, lpName] = assetConfig.lpToken.split('.');
      const [assetAddress, assetName] = assetConfig.token.split('.');

      const network = this.getStacksNetwork();

      const txOptions = {
        contractAddress: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N',
        contractName: 'borrow-helper-v2-1-7',
        functionName: 'supply',
        functionArgs: [
          contractPrincipalCV(lpAddress, lpName),
          contractPrincipalCV('SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', 'pool-0-reserve-v2-0'),
          contractPrincipalCV(assetAddress, assetName),
          uintCV(amountMicro),
          standardPrincipalCV(senderAddress),
          noneCV(), // referral
          contractPrincipalCV('SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', 'incentives-v2-2'),
        ],
        senderKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 50000n,
      };

      const tx = await makeContractCall(txOptions);
      const result = await broadcastTransaction(tx, network);

      const txId = typeof result === 'string' ? result : result.txid;

      if (!txId) {
        throw new Error('Supply transaction failed without txid');
      }

      return {
        success: true,
        txId,
        amount: params.amount,
        asset: params.asset,
      };
    } catch (error: any) {
      throw new Error(`Supply failed: ${error.message}`);
    }
  }

  /**
   * Borrow assets from Zest Protocol
   */
  async borrow(
    params: ZestBorrowParams,
    senderAddress: string,
    senderKey: string
  ): Promise<ZestBorrowResult> {
    try {
      // Get fresh Pyth price feed
      const pythFeed = await this.pythService.getPriceFeed();

      const assetConfig = ZEST_ASSETS[params.assetToBorrow];
      if (!assetConfig) {
        throw new Error(`Unsupported borrow asset: ${params.assetToBorrow}`);
      }

      const amountMicro = Math.floor(parseFloat(params.amount) * Math.pow(10, assetConfig.decimals));

      const [assetAddress, assetName] = assetConfig.token.split('.');
      const [lpAddress, lpName] = assetConfig.lpToken.split('.');
      const [oracleAddress, oracleName] = assetConfig.oracle.split('.');

      // Build assets list for Clarity
      const assetsListCV = this.buildAssetsListCV();

      // Convert hex string to buffer
      const priceFeedBuffer = bufferCV(Buffer.from(pythFeed.priceFeedBytes.slice(2), 'hex'));

      const network = this.getStacksNetwork();

      const txOptions = {
        contractAddress: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N',
        contractName: 'borrow-helper-v2-1-7',
        functionName: 'borrow',
        functionArgs: [
          contractPrincipalCV('SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', 'pool-0-reserve-v2-0'),
          contractPrincipalCV(oracleAddress, oracleName),
          contractPrincipalCV(assetAddress, assetName),
          contractPrincipalCV(lpAddress, lpName),
          assetsListCV,
          uintCV(amountMicro),
          contractPrincipalCV('SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', 'fees-calculator'),
          uintCV(params.interestRateMode ?? 0),
          standardPrincipalCV(senderAddress),
          someCV(priceFeedBuffer),
        ],
        senderKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 100000n, // Higher fee for complex tx
      };

      const tx = await makeContractCall(txOptions);
      const result = await broadcastTransaction(tx, network);

      const txId = typeof result === 'string' ? result : result.txid;

      if (!txId) {
        throw new Error('Borrow transaction failed without txid');
      }

      return {
        success: true,
        txId,
        amount: params.amount,
        asset: params.assetToBorrow,
        interestRateMode: params.interestRateMode ?? 0,
      };
    } catch (error: any) {
      throw new Error(`Borrow failed: ${error.message}`);
    }
  }

  /**
   * Repay borrowed assets to Zest Protocol
   */
  async repay(
    params: ZestRepayParams,
    senderAddress: string,
    senderKey: string
  ): Promise<ZestRepayResult> {
    try {
      const assetConfig = ZEST_ASSETS[params.asset];
      if (!assetConfig) {
        throw new Error(`Unsupported asset: ${params.asset}`);
      }

      let amountMicro: bigint;
      if (params.amount === 'max') {
        amountMicro = BigInt(ZEST_PARAMS.MAX_UINT);
      } else {
        amountMicro = BigInt(Math.floor(parseFloat(params.amount) * Math.pow(10, assetConfig.decimals)));
      }

      const [assetAddress, assetName] = assetConfig.token.split('.');
      const onBehalfOf = params.onBehalfOf ?? senderAddress;

      const network = this.getStacksNetwork();

      const txOptions = {
        contractAddress: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N',
        contractName: 'borrow-helper-v2-1-7',
        functionName: 'repay',
        functionArgs: [
          contractPrincipalCV(assetAddress, assetName),
          uintCV(amountMicro),
          standardPrincipalCV(onBehalfOf),
          standardPrincipalCV(senderAddress),
        ],
        senderKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 50000n,
      };

      const tx = await makeContractCall(txOptions);
      const result = await broadcastTransaction(tx, network);

      const txId = typeof result === 'string' ? result : result.txid;

      if (!txId) {
        throw new Error('Repay transaction failed without txid');
      }

      return {
        success: true,
        txId,
        amount: params.amount,
        asset: params.asset,
      };
    } catch (error: any) {
      throw new Error(`Repay failed: ${error.message}`);
    }
  }

  /**
   * Withdraw collateral from Zest Protocol
   */
  async withdraw(
    params: ZestWithdrawParams,
    senderAddress: string,
    senderKey: string
  ): Promise<ZestWithdrawResult> {
    try {
      // Get fresh Pyth price feed
      const pythFeed = await this.pythService.getPriceFeed();

      const assetConfig = ZEST_ASSETS[params.asset];
      if (!assetConfig) {
        throw new Error(`Unsupported asset: ${params.asset}`);
      }

      const amountMicro = Math.floor(parseFloat(params.amount) * Math.pow(10, assetConfig.decimals));

      const [assetAddress, assetName] = assetConfig.token.split('.');
      const [lpAddress, lpName] = assetConfig.lpToken.split('.');
      const [oracleAddress, oracleName] = assetConfig.oracle.split('.');

      // Build assets list for Clarity
      const assetsListCV = this.buildAssetsListCV();

      const priceFeedBuffer = bufferCV(Buffer.from(pythFeed.priceFeedBytes.slice(2), 'hex'));

      const network = this.getStacksNetwork();

      const txOptions = {
        contractAddress: 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N',
        contractName: 'borrow-helper-v2-1-7',
        functionName: 'withdraw',
        functionArgs: [
          contractPrincipalCV(lpAddress, lpName),
          contractPrincipalCV('SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', 'pool-0-reserve-v2-0'),
          contractPrincipalCV(assetAddress, assetName),
          contractPrincipalCV(oracleAddress, oracleName),
          uintCV(amountMicro),
          standardPrincipalCV(senderAddress),
          assetsListCV,
          contractPrincipalCV('SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', 'incentives-v2-2'),
          someCV(priceFeedBuffer),
        ],
        senderKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 100000n,
      };

      const tx = await makeContractCall(txOptions);
      const result = await broadcastTransaction(tx, network);

      const txId = typeof result === 'string' ? result : result.txid;

      if (!txId) {
        throw new Error('Withdraw transaction failed without txid');
      }

      return {
        success: true,
        txId,
        amount: params.amount,
        asset: params.asset,
      };
    } catch (error: any) {
      throw new Error(`Withdraw failed: ${error.message}`);
    }
  }

  /**
   * Builds the assets list Clarity value required by borrow/withdraw functions
   */
  private buildAssetsListCV() {
    return listCV(
      ZEST_ASSETS_LIST.map((a) => {
        const [aAddr, aName] = a.asset.split('.');
        const [lpAddr, lpN] = a.lpToken.split('.');
        const [oAddr, oName] = a.oracle.split('.');

        return tupleCV({
          asset: contractPrincipalCV(aAddr, aName),
          'lp-token': contractPrincipalCV(lpAddr, lpN),
          oracle: contractPrincipalCV(oAddr, oName),
        });
      })
    );
  }

  /**
   * Gets the appropriate Stacks network instance
   */
  private getStacksNetwork() {
    return this.network === 'mainnet'
      ? new StacksMainnet({ url: STACKS_MAINNET_API })
      : new StacksTestnet({ url: STACKS_TESTNET_API });
  }
}
