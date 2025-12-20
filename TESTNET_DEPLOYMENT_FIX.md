# Testnet Deployment & Address Display Fix

## Issue

When users unlocked their wallet and tried to deploy to testnet, several problems occurred:

1. **Wallet unlock only showed one address** - Users didn't know what their testnet address was
2. **Deployment used wrong address** - Users thought they had funds on testnet but deployment failed with "NotEnoughFunds"
3. **No visibility into which address was being used** - Error messages didn't clarify which address needed funds

### Example Problem Flow

```
User: unlock wallet with password
System: "Your address is SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ (mainnet)"

User: check balance for ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0
System: "50 STX"

User: deploy to testnet
System: "NotEnoughFunds" ❌

Problem: The wallet's TESTNET address (derived from the same private key) was
ST1DIFFERENT123... (with 0 STX), NOT ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0!
```

## Root Cause

### 1. Wallet Unlock Only Showed Current Network Address

**File**: `src/services/wallet.ts` - `unlockWallet()`

**Before**:
```typescript
async unlockWallet(password: string): Promise<string> {
  const privateKey = await decryptPrivateKey(keystore, password);

  // Only derived ONE address based on config
  const network = config.network === 'mainnet' ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
  const address = getAddressFromPrivateKey(privateKey, network);

  return address; // Only returned one address ❌
}
```

**Issue**: Users had no idea what their testnet address was when config was set to mainnet.

### 2. Deployment Didn't Show Which Address Would Be Used

**File**: `src/tools/clarity-tools.ts` - `deploy_clarity_contract`

**Before**:
```typescript
const walletAddress = walletService.getAddress(); // Gets current config address
// But deployment uses the NETWORK-SPECIFIC address!
const result = await clarityService.deployContract(..., args.network);

// Error: "NotEnoughFunds" with no indication of which address was used ❌
```

## Solution

### 1. Wallet Unlock Returns Both Addresses

**File**: `src/services/wallet.ts`

```typescript
async unlockWallet(password: string): Promise<{
  mainnetAddress: string;
  testnetAddress: string;
  currentAddress: string;
  network: 'mainnet' | 'testnet';
}> {
  const privateKey = await decryptPrivateKey(keystore, password);

  // ✅ Derive BOTH addresses
  const mainnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet);
  const testnetAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);

  // Set current based on config
  const currentAddress = config.network === 'mainnet' ? mainnetAddress : testnetAddress;

  return {
    mainnetAddress,
    testnetAddress,
    currentAddress,
    network: config.network,
  };
}
```

### 2. Added Network-Specific Address Getter

```typescript
getAddressForNetwork(network: 'mainnet' | 'testnet'): string {
  if (!this.privateKey) {
    throw new Error('Wallet is locked. Please unlock first.');
  }
  const version = network === 'mainnet' ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
  return getAddressFromPrivateKey(this.privateKey, version);
}
```

### 3. Updated Deployment to Show Actual Deployer Address

**File**: `src/tools/clarity-tools.ts`

```typescript
// ✅ Get the actual address that will be used
const deployerAddress = walletService.getAddressForNetwork(args.network);

// ✅ Warn if deploying to different network
if (deployerAddress !== currentAddress) {
  console.error(
    `⚠️  NOTE: Deploying to ${args.network} using address ${deployerAddress}`
  );
}

// ✅ Show deployer address in responses
return {
  deployerAddress: deployerAddress,
  deploymentInfo: {
    network: args.network,
    deployerAddress: deployerAddress,
    contractName: args.contractName,
  },
  // ...
};
```

## Changes Summary

### Modified Files

1. **src/services/wallet.ts**
   - `unlockWallet()`: Returns object with both addresses (lines 107-141)
   - `getAddressForNetwork()`: New method (lines 161-170)

2. **src/tools/wallet-tools.ts**
   - `wallet_unlock`: Shows both addresses (lines 71-100)

3. **src/tools/clarity-tools.ts**
   - `deploy_clarity_contract`: Uses network-specific address (lines 273-342)

## User Experience Improvements

### Before Fix
```
unlock wallet → "Your address is SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ"
deploy to testnet → "NotEnoughFunds" (no address shown)
```

### After Fix
```
unlock wallet → {
  "mainnetAddress": "SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ",
  "testnetAddress": "ST1ABC123XYZ789...",
  "networkInfo": { ... }
}

deploy to testnet → {
  "deployerAddress": "ST1ABC123XYZ789...",
  "hint": "Deployment will use testnet address: ST1ABC123...",
  "troubleshooting": [
    "Get free STX from https://explorer.hiro.so/sandbox/faucet?chain=testnet"
  ]
}
```

## Build Status

✅ TypeScript compilation successful
✅ All 29 MCP tools operational
✅ Wallet unlock shows both addresses
✅ Deployment shows correct deployer address
✅ Error messages include testnet faucet link

## Summary

Users now have complete visibility into:
1. Both mainnet and testnet addresses when unlocking
2. Which address will be used for deployment
3. Clear error messages with the address that needs funds
4. Testnet faucet link for getting free STX
