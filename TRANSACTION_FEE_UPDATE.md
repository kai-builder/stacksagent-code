# Transaction Fee Update for Contract Deployment

## Change Summary

Set a fixed transaction fee of **0.1 STX (100,000 microSTX)** for all contract deployments.

## Modification

**File**: `src/services/clarity.ts`

**Line**: 954

**Change**:
```typescript
// Before
const txOptions = {
  contractName,
  codeBody: contractCode,
  senderKey: privateKey,
  network,
  anchorMode: AnchorMode.Any,
};

// After
const txOptions = {
  contractName,
  codeBody: contractCode,
  senderKey: privateKey,
  network,
  anchorMode: AnchorMode.Any,
  fee: 100000, // 0.1 STX (100,000 microSTX)
};
```

## Fee Details

| Unit | Amount |
|------|--------|
| **STX** | 0.1 STX |
| **microSTX** | 100,000 |
| **Network** | Both testnet and mainnet |

## Why This Fee Amount?

- **0.1 STX** is a reasonable standard fee for contract deployment
- Sufficient for most network conditions
- Not too high to waste funds
- Not too low to risk transaction rejection during congestion
- Same fee works for both testnet and mainnet

## Impact

### Before
- Fee was automatically calculated by the wallet/network
- Could vary based on network conditions
- Less predictable costs

### After
- Fixed 0.1 STX fee for all deployments
- Predictable deployment costs
- Users know exactly how much STX is needed

## Minimum Balance Required

To deploy a contract, users now need:
- **Testnet**: At least 0.1 STX (get free from faucet)
- **Mainnet**: At least 0.1 STX (plus some buffer recommended)

## User Guidance

When users see "NotEnoughFunds" error, they need:
- **Testnet**: At least 100,000 microSTX (0.1 STX) - Get from https://explorer.hiro.so/sandbox/faucet?chain=testnet
- **Mainnet**: At least 0.1 STX in their wallet

The error messages already include this guidance with the testnet faucet link.

## Build Status

✅ TypeScript compilation successful
✅ Fee parameter accepted by makeContractDeploy
✅ Works with both testnet and mainnet

## Related Files

- `src/services/clarity.ts` - Deployment implementation
- `src/tools/clarity-tools.ts` - Deployment tool (uses this service)
- `TESTNET_DEPLOYMENT_FIX.md` - Testnet deployment guide
- `QUICK_START_TESTNET.md` - User guide

## Summary

Contract deployments now have a predictable, fixed fee of 0.1 STX (100,000 microSTX). This makes it easier for users to understand costs and ensures transactions have sufficient fees to be processed by the network.
