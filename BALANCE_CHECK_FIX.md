# Balance Check Network Detection Fix

## Issue

When checking the balance for a testnet address (e.g., `ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0`), the system was using the wrong API endpoint based on the configuration network setting rather than detecting the network from the address prefix.

### Problem Behavior
- User checks balance for testnet address `ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0`
- If config is set to `mainnet`, the system would query mainnet API
- Result: Returns 0 balance (because address doesn't exist on mainnet)

### Expected Behavior
- System should detect `ST` prefix → testnet address
- Automatically use testnet API: `https://api.testnet.hiro.so`
- Return actual balance from testnet

## Root Cause

**File**: `src/services/wallet.ts`

The `WalletService` constructor initializes `StacksApiClient` once with the network from config:

```typescript
constructor() {
  const config = configManager.get();
  this.apiClient = new StacksApiClient(config.network); // ❌ Fixed to config network
}
```

The `getBalance()` method then uses this fixed API client regardless of the address being queried:

```typescript
async getBalance(address?: string): Promise<WalletBalance> {
  const targetAddress = address || this.getAddress();
  const stxBalance = await this.apiClient.getStxBalance(targetAddress); // ❌ Wrong network
  // ...
}
```

## Solution

### 1. Added Network Detection Method

```typescript
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
```

### 2. Updated getBalance() to Use Detected Network

```typescript
async getBalance(address?: string): Promise<WalletBalance> {
  const targetAddress = address || this.getAddress();

  // ✅ Detect network from address and use appropriate API client
  const detectedNetwork = this.detectNetworkFromAddress(targetAddress);
  const apiClient = new StacksApiClient(detectedNetwork);

  // Get STX balance using correct API
  const stxBalance = await apiClient.getStxBalance(targetAddress);

  // Get token balances using correct API
  for (const [symbol, tokenInfo] of Object.entries(WELL_KNOWN_TOKENS)) {
    if (symbol === 'STX') continue;
    try {
      const balance = await apiClient.getTokenBalance(targetAddress, tokenInfo.contract);
      // ...
    } catch (error) { /* ... */ }
  }
  // ...
}
```

## Address Prefix Reference

| Prefix | Network | API Endpoint |
|--------|---------|--------------|
| **SP** | Mainnet | `https://api.hiro.so` |
| **ST** | Testnet | `https://api.testnet.hiro.so` |

## Changes Made

### Modified Files

#### 1. **src/services/wallet.ts**
   - Added `detectNetworkFromAddress()` method (lines 162-172)
   - Updated `getBalance()` to detect network and create appropriate API client (lines 177-186)
   - Updated token balance fetching to use detected network API client (line 194)

#### 2. **src/services/portfolio.ts**
   - Added `defaultNetwork` property to store constructor network parameter
   - Added `detectNetworkFromAddress()` method
   - Updated `getTransactionHistory()` to detect network and use appropriate API client
   - Ensures transaction history queries use correct network based on address prefix

## Impact

### Before Fix
```
Config network: mainnet
Check balance for ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0
→ Uses mainnet API
→ Returns 0 STX (address doesn't exist on mainnet)
```

### After Fix
```
Config network: mainnet
Check balance for ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0
→ Detects ST prefix = testnet
→ Uses testnet API
→ Returns actual balance from testnet
```

## API URL Verification

The constants are correctly configured without trailing slashes:

```typescript
// src/utils/constants.ts
export const STACKS_MAINNET_API = 'https://api.hiro.so';
export const STACKS_TESTNET_API = 'https://api.testnet.hiro.so';
```

Combined with path in `StacksApiClient`:
```typescript
// src/services/stacks-api.ts
const response = await this.client.get(`/extended/v1/address/${address}/balances`);
```

Results in correct URLs:
- Mainnet: `https://api.hiro.so/extended/v1/address/${address}/balances`
- Testnet: `https://api.testnet.hiro.so/extended/v1/address/${address}/balances`

**No double slash issue** (`//extended`) exists in the implementation.

## Testing

### Build Status
✅ TypeScript compilation successful
✅ No errors or warnings

### Test Cases
1. **Testnet address with mainnet config**
   - Address: `ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0`
   - Config: `mainnet`
   - Expected: Uses testnet API ✅

2. **Mainnet address with testnet config**
   - Address: `SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0`
   - Config: `testnet`
   - Expected: Uses mainnet API ✅

3. **Wallet's own address**
   - Address: From wallet (no override)
   - Config: `mainnet` or `testnet`
   - Expected: Uses config network ✅

## Related Tools

The following MCP tools benefit from this fix:
- `wallet_get_balance` - Now correctly detects network from address
- `portfolio_summary` - Uses WalletService.getBalance() with network detection
- `portfolio_transactions` - Now correctly detects network from address for transaction history
- Any tool querying balances or transactions for specific addresses

## Summary

The fix ensures that when checking balances and transactions:
1. **Network is auto-detected** from address prefix (SP/ST)
2. **Correct API endpoint** is used regardless of config
3. **Mainnet addresses** query mainnet API (`https://api.hiro.so`)
4. **Testnet addresses** query testnet API (`https://api.testnet.hiro.so`)
5. **Cross-network queries** work correctly (e.g., mainnet config querying testnet address)
6. **Transaction history** respects network detection
7. **Portfolio queries** automatically use the correct network

This allows users to check any address's balance and transaction history without needing to change their network configuration. The system intelligently detects the network from the address prefix and routes requests to the appropriate API endpoint.
