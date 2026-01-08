import { z } from 'zod';
import { StackingService } from '../../core/stacking.js';
import { PortfolioService } from '../../core/portfolio.js';
import { WalletService } from '../../core/wallet.js';
import { BnsService } from '../../core/bns.js';

export const stackingAndPortfolioTools = (
  stackingService: StackingService,
  portfolioService: PortfolioService,
  walletService: WalletService,
  bnsService: BnsService
) => ({
  stacking_get_pox_info: {
    description: 'Gets comprehensive PoX information including current cycle, next cycle, block heights, thresholds, and cycle progress',
    parameters: z.object({}),
    handler: async () => {
      try {
        const poxInfo = await stackingService.getDetailedPoxInfo();
        const cycleProgress = stackingService.calculateCycleProgress(poxInfo);

        const formatSTX = (microSTX: string | number) => {
          const stx = Number(microSTX) / 1000000;
          return stx.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' STX';
        };

        return {
          success: true,
          currentCycle: {
            id: poxInfo.current_cycle.id,
            minThreshold: formatSTX(poxInfo.current_cycle.min_threshold_ustx),
            stackedAmount: formatSTX(poxInfo.current_cycle.stacked_ustx),
            isActive: poxInfo.current_cycle.is_pox_active,
          },
          nextCycle: {
            id: poxInfo.next_cycle.id,
            minThreshold: formatSTX(poxInfo.next_cycle.min_threshold_ustx),
            stackedAmount: formatSTX(poxInfo.next_cycle.stacked_ustx),
            blocksUntilPrepare: poxInfo.next_cycle.blocks_until_prepare_phase,
            blocksUntilReward: poxInfo.next_cycle.blocks_until_reward_phase,
          },
          blockHeights: {
            current: poxInfo.current_burnchain_block_height,
            firstBurnchain: poxInfo.first_burnchain_block_height,
            cycleStart: cycleProgress.currentCycleStartBlock,
            rewardsPhaseStart: cycleProgress.rewardsPhaseStartBlock,
            cycleEnd: cycleProgress.cycleEndBlock,
          },
          cycleInfo: {
            totalBlocks: cycleProgress.totalCycleBlocks,
            blocksCompleted: cycleProgress.blocksCompleted,
            blocksRemaining: cycleProgress.blocksRemaining,
            progressPercent: cycleProgress.currentCycleProgress.toFixed(2) + '%',
            estimatedHoursRemaining: cycleProgress.estimatedHoursRemaining.toFixed(1),
            preparePhaseLengthBlocks: poxInfo.prepare_phase_block_length,
            rewardPhaseLengthBlocks: poxInfo.reward_phase_block_length,
          },
          thresholds: {
            minSlotAmount: formatSTX(poxInfo.min_amount_ustx),
            poxActivationThreshold: formatSTX(poxInfo.pox_activation_threshold_ustx),
          },
          rewardSlots: poxInfo.reward_slots,
          totalLiquidSupply: formatSTX(poxInfo.total_liquid_supply_ustx),
          contractId: poxInfo.contract_id,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_info: {
    description: 'Gets current Stacking/PoX cycle information and APY (simplified version)',
    parameters: z.object({}),
    handler: async () => {
      try {
        const info = await stackingService.getStackingInfo();

        return {
          success: true,
          currentCycle: info.currentCycle,
          nextCycleStart: new Date(info.nextCycleStart).toISOString(),
          minStackingAmount: `${info.minStackingAmount} STX`,
          estimatedApy: `${info.estimatedApy}%`,
          message: 'Stacking allows you to earn BTC rewards by locking STX',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_status: {
    description: 'Gets stacking status for an address',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
    }),
    handler: async (args: { address?: string }) => {
      try {
        const address = args.address || walletService.getAddress();
        const status = await stackingService.getStackingStatus(address);

        if (!status.isStacking) {
          return {
            success: true,
            isStacking: false,
            message: 'This address is not currently stacking',
          };
        }

        return {
          success: true,
          isStacking: true,
          stackedAmount: `${status.stackedAmount} STX`,
          unlockHeight: status.unlockHeight,
          poxAddress: status.poxAddress,
          cyclesRemaining: status.cyclesRemaining,
          estimatedRewards: `${status.estimatedRewards} BTC`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_stack: {
    description: 'Stacks STX to earn Bitcoin rewards (locks STX for specified cycles)',
    parameters: z.object({
      amount: z.string().describe('Amount of STX to stack'),
      cycles: z.coerce.number().describe('Number of cycles to stack (1-12)'),
      poxAddress: z.string().describe('Bitcoin address to receive rewards'),
    }),
    handler: async (args: { amount: string; cycles: number; poxAddress: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const txHash = await stackingService.stackStx(
          args.amount,
          args.cycles,
          args.poxAddress,
          privateKey,
          address
        );

        // Calculate estimated rewards
        const info = await stackingService.getStackingInfo();
        const estimatedRewards = stackingService.calculateEstimatedRewards(
          args.amount,
          args.cycles,
          info.estimatedApy
        );

        return {
          success: true,
          txHash,
          stackedAmount: `${args.amount} STX`,
          cycles: args.cycles,
          estimatedRewards: `~${estimatedRewards} BTC`,
          message: `Stacking transaction submitted. Your STX will be locked for ${args.cycles} cycles.`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_delegate: {
    description: 'Delegates STX to a stacking pool',
    parameters: z.object({
      amount: z.string().describe('Amount of STX to delegate'),
      delegateTo: z.string().describe('Pool address to delegate to'),
    }),
    handler: async (args: { amount: string; delegateTo: string }) => {
      try {
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock it first.',
          };
        }

        const privateKey = walletService.getPrivateKey();
        const address = walletService.getAddress();

        const txHash = await stackingService.delegateStx(
          args.amount,
          args.delegateTo,
          privateKey,
          address
        );

        return {
          success: true,
          txHash,
          delegatedAmount: `${args.amount} STX`,
          delegatedTo: args.delegateTo,
          message: 'STX delegation successful',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_cycles: {
    description: 'Gets historical stacking cycles with start/end blocks, stacked amounts, and signer counts',
    parameters: z.object({
      limit: z.coerce.number().optional().default(10).describe('Number of cycles to fetch (default: 10)'),
      offset: z.coerce.number().optional().default(0).describe('Offset for pagination (default: 0)'),
    }),
    handler: async (args: { limit?: number; offset?: number }) => {
      try {
        const cyclesData = await stackingService.getStackingCycles(args.limit || 10, args.offset || 0);

        const formatSTX = (microSTX: string | number) => {
          const stx = Number(microSTX) / 1000000;
          return stx.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' STX';
        };

        return {
          success: true,
          total: cyclesData.total,
          limit: cyclesData.limit,
          offset: cyclesData.offset,
          cycles: cyclesData.results.map((cycle: any) => ({
            cycleNumber: cycle.cycle_number,
            startBlock: cycle.cycle_start_height,
            endBlock: cycle.cycle_end_height,
            totalStacked: formatSTX(cycle.total_stacked_amount || 0),
            totalSigners: cycle.total_signers || 0,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_signers: {
    description: 'Gets Nakamoto signers for a specific cycle with stacked amounts, weights, and stacker counts',
    parameters: z.object({
      cycleId: z.coerce.number().describe('Cycle ID to get signers for'),
      limit: z.coerce.number().optional().default(50).describe('Number of signers to fetch (default: 50)'),
      offset: z.coerce.number().optional().default(0).describe('Offset for pagination (default: 0)'),
    }),
    handler: async (args: { cycleId: number; limit?: number; offset?: number }) => {
      try {
        const signersData = await stackingService.getSigners(
          args.cycleId,
          args.limit || 50,
          args.offset || 0
        );

        const formatSTX = (microSTX: string | number) => {
          const stx = Number(microSTX) / 1000000;
          return stx.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' STX';
        };

        return {
          success: true,
          cycleId: args.cycleId,
          total: signersData.total,
          limit: signersData.limit,
          offset: signersData.offset,
          signers: signersData.results.map((signer: any) => ({
            signerAddress: signer.signer_address || signer.signing_key,
            stackedAmount: formatSTX(signer.stacked_amount),
            weight: signer.weight,
            stackerCount: signer.stacker_count,
            signingKey: signer.signing_key,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_pool_delegations: {
    description: 'Gets delegations for a specific stacking pool showing individual stackers and their delegated amounts',
    parameters: z.object({
      poolAddress: z.string().describe('Pool address to get delegations for'),
      limit: z.coerce.number().optional().default(50).describe('Number of delegations to fetch (default: 50)'),
      offset: z.coerce.number().optional().default(0).describe('Offset for pagination (default: 0)'),
    }),
    handler: async (args: { poolAddress: string; limit?: number; offset?: number }) => {
      try {
        const delegationsData = await stackingService.getPoolDelegations(
          args.poolAddress,
          args.limit || 50,
          args.offset || 0
        );

        const formatSTX = (microSTX: string | number) => {
          const stx = Number(microSTX) / 1000000;
          return stx.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' STX';
        };

        return {
          success: true,
          poolAddress: args.poolAddress,
          total: delegationsData.total,
          limit: delegationsData.limit,
          offset: delegationsData.offset,
          delegations: delegationsData.results.map((delegation: any) => ({
            stacker: delegation.stacker,
            amountDelegated: formatSTX(delegation.amount_ustx),
            blockHeight: delegation.block_height,
            txId: delegation.tx_id,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_burnchain_rewards: {
    description: 'Gets recent Bitcoin rewards distributed through Proof-of-Transfer',
    parameters: z.object({
      limit: z.coerce.number().optional().default(20).describe('Number of rewards to fetch (default: 20)'),
      offset: z.coerce.number().optional().default(0).describe('Offset for pagination (default: 0)'),
    }),
    handler: async (args: { limit?: number; offset?: number }) => {
      try {
        const rewardsData = await stackingService.getBurnchainRewards(
          args.limit || 20,
          args.offset || 0
        );

        const formatBTC = (satoshis: string | number) => {
          const btc = Number(satoshis) / 100000000;
          return btc.toFixed(8) + ' BTC';
        };

        // Calculate statistics
        const totalSatoshis = rewardsData.results.reduce(
          (sum: number, reward: any) => sum + Number(reward.reward_amount),
          0
        );
        const avgReward = totalSatoshis / (rewardsData.results.length || 1);

        return {
          success: true,
          total: rewardsData.total,
          limit: rewardsData.limit,
          offset: rewardsData.offset,
          statistics: {
            totalRewards: formatBTC(totalSatoshis),
            avgRewardPerSlot: formatBTC(avgReward),
            rewardCount: rewardsData.results.length,
          },
          rewards: rewardsData.results.map((reward: any) => ({
            btcAddress: reward.reward_recipient,
            amount: formatBTC(reward.reward_amount),
            burnBlockHeight: reward.burn_block_height,
            rewardSlot: reward.reward_slot_index || reward.reward_index,
            canonical: reward.canonical,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_get_burnchain_rewards_by_address: {
    description: 'Gets Bitcoin rewards for a specific BTC address',
    parameters: z.object({
      btcAddress: z.string().describe('Bitcoin address to get rewards for'),
      limit: z.coerce.number().optional().default(20).describe('Number of rewards to fetch (default: 20)'),
    }),
    handler: async (args: { btcAddress: string; limit?: number }) => {
      try {
        const rewardsData = await stackingService.getBurnchainRewardsByAddress(
          args.btcAddress,
          args.limit || 20
        );

        const formatBTC = (satoshis: string | number) => {
          const btc = Number(satoshis) / 100000000;
          return btc.toFixed(8) + ' BTC';
        };

        const totalSatoshis = rewardsData.results.reduce(
          (sum: number, reward: any) => sum + Number(reward.reward_amount),
          0
        );

        return {
          success: true,
          btcAddress: args.btcAddress,
          total: rewardsData.total,
          totalRewardsEarned: formatBTC(totalSatoshis),
          rewards: rewardsData.results.map((reward: any) => ({
            amount: formatBTC(reward.reward_amount),
            burnBlockHeight: reward.burn_block_height,
            rewardSlot: reward.reward_slot_index || reward.reward_index,
            canonical: reward.canonical,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  stacking_search_position: {
    description: 'Search for stacking positions and pool memberships by Stacks address or BNS name. Supports BNS domain resolution - enter either a Stacks address (SP...) or BNS name (name.btc)',
    parameters: z.object({
      addressOrName: z.string().describe('Stacks address (e.g., SP1234...) or BNS name (e.g., muneeb.btc) to search for stacking positions'),
    }),
    handler: async (args: { addressOrName: string }) => {
      try {
        let address = args.addressOrName.trim();
        let resolvedFrom: string | null = null;

        // Check if input is a BNS name (contains a dot)
        if (address.includes('.')) {
          resolvedFrom = address;
          const resolvedAddress = await bnsService.resolveNameToAddress(address);

          if (!resolvedAddress) {
            return {
              success: false,
              error: `BNS name "${address}" could not be resolved. Please check the name and try again.`,
            };
          }

          address = resolvedAddress;
        }

        // Validate it's a Stacks address
        if (!address.startsWith('SP') && !address.startsWith('ST')) {
          return {
            success: false,
            error: 'Invalid Stacks address. Address must start with SP (mainnet) or ST (testnet).',
          };
        }

        // Search for stacking positions
        const positions = await stackingService.searchStackingPositions(address);

        const formatSTX = (stx: number) => {
          return stx.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' STX';
        };

        return {
          success: true,
          address,
          ...(resolvedFrom && { resolvedFrom, message: `Resolved ${resolvedFrom} to ${address}` }),
          positionsFound: positions.length,
          positions: positions.map((pos) => ({
            type: pos.type,
            poolName: pos.name,
            poolAddress: pos.id,
            balance: formatSTX(pos.balance),
            balanceRaw: pos.balance,
            estimatedAPR: `${pos.apr}%`,
            ...(pos.unlockHeight && { unlockHeight: pos.unlockHeight }),
            ...(pos.cyclesRemaining && { cyclesRemaining: pos.cyclesRemaining }),
            ...(pos.poxAddress && { btcRewardAddress: pos.poxAddress }),
            ...(pos.blockHeight && { delegatedAtBlock: pos.blockHeight }),
            ...(pos.txId && { transactionId: pos.txId }),
          })),
          summary: positions.length > 0
            ? `Found ${positions.length} stacking position${positions.length !== 1 ? 's' : ''} for ${resolvedFrom || address}`
            : `No stacking positions found for ${resolvedFrom || address}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_summary: {
    description: 'Gets comprehensive portfolio summary with total value and breakdown',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
    }),
    handler: async (args: { address?: string }) => {
      try {
        const summary = await portfolioService.getPortfolioSummary(args.address);

        // Format the response
        const stxBalance = (parseFloat(summary.stxBalance) / 1000000).toFixed(6);

        return {
          success: true,
          address: summary.address,
          totalValue: `$${summary.totalValueUsd.toFixed(2)}`,
          stx: {
            balance: `${stxBalance} STX`,
            value: `$${summary.stxValueUsd.toFixed(2)}`,
          },
          tokens: summary.tokens.map(t => ({
            symbol: t.symbol,
            balance: (parseFloat(t.balance) / Math.pow(10, t.decimals)).toFixed(t.decimals),
            value: t.usdValue ? `$${t.usdValue.toFixed(2)}` : 'N/A',
          })),
          stacking: summary.stackingValue
            ? `$${summary.stackingValue.toFixed(2)}`
            : 'Not stacking',
          defiPositions: summary.defiPositions || [],
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_transactions: {
    description: 'Gets recent transaction history for an address',
    parameters: z.object({
      address: z.string().optional().describe('Address to check (defaults to current wallet)'),
      limit: z.coerce.number().optional().default(20).describe('Number of transactions to fetch'),
    }),
    handler: async (args: { address?: string; limit?: number }) => {
      try {
        const transactions = await portfolioService.getTransactionHistory(
          args.address,
          args.limit || 20
        );

        return {
          success: true,
          transactions: transactions.map(tx => ({
            txHash: tx.txHash,
            timestamp: new Date(tx.timestamp * 1000).toISOString(),
            type: tx.type,
            status: tx.status,
            description: tx.description,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  portfolio_history: {
    description: 'Gets portfolio value history over time with P&L',
    parameters: z.object({
      address: z.string().describe('Address to analyze'),
      days: z.coerce.number().default(30).describe('Number of days of history'),
    }),
    handler: async (args: { address: string; days: number }) => {
      try {
        const history = await portfolioService.getPortfolioHistory(args.address, args.days);
        const pnl = await portfolioService.calculatePnL(args.address, args.days);

        return {
          success: true,
          history,
          pnl: {
            total: `$${pnl.totalPnL.toFixed(2)}`,
            percentage: `${pnl.percentageChange.toFixed(2)}%`,
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
});
