# Deploy Clarity Contract Feature

## ✅ New Tool Added: `deploy_clarity_contract`

Deploy Clarity smart contracts directly to Stacks blockchain (testnet or mainnet) from Claude Desktop!

## Overview

The new `deploy_clarity_contract` tool enables complete contract lifecycle management:
1. **Generate** contracts with `clarity_write_contract`
2. **Audit** contracts with `clarity_audit_contract`
3. **Deploy** contracts with `deploy_clarity_contract` ← **NEW!**

## Key Features

### 🔒 Secure Deployment
- ✅ Integrates with existing wallet service
- ✅ Uses encrypted wallet private keys
- ✅ Requires wallet unlock for deployment
- ✅ Auto-locks wallet after 15 minutes

### 🛡️ Safety Features
- ✅ **Testnet-first approach** - Encourages testing before mainnet
- ✅ **Mainnet confirmation** - Requires `confirmMainnet: true` flag
- ✅ **Syntax validation** - Validates contract before deployment
- ✅ **Name validation** - Ensures valid Clarity contract names

### 🌐 Network Support
- ✅ **Testnet** - Free testing environment
- ✅ **Mainnet** - Production blockchain

### 📊 Rich Response Data
- ✅ Transaction ID (`txId`)
- ✅ Contract ID (`contractId`)
- ✅ Explorer URL (clickable transaction tracking)
- ✅ Deployer address
- ✅ Estimated confirmation time
- ✅ Next steps guidance

## Usage Examples

### Deploy to Testnet

```javascript
// Prerequisites: wallet unlocked
wallet_unlock({ password: "your-password" })

// Deploy contract
deploy_clarity_contract({
  contractName: "my-token-v1",
  contractCode: "(define-fungible-token my-token u1000000)...",
  network: "testnet"
})

// Response:
{
  success: true,
  txId: "0x1234567890abcdef...",
  contractId: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-token-v1",
  network: "testnet",
  explorerUrl: "https://explorer.hiro.so/txid/0x1234...?chain=testnet",
  message: "Contract 'my-token-v1' deployed successfully to testnet!",
  nextSteps: [
    "Monitor transaction status: https://explorer.hiro.so/...",
    "Wait for confirmation (10-30 minutes)",
    "Contract available at: ST1PQHQ...my-token-v1"
  ]
}
```

### Deploy to Mainnet (After Testing)

```javascript
deploy_clarity_contract({
  contractName: "my-token-v1",
  contractCode: contractCode,
  network: "mainnet",
  confirmMainnet: true  // Required safety flag!
})
```

## Safety Mechanisms

### 1. Wallet Lock Check
```javascript
// If wallet is locked:
{
  success: false,
  error: "Wallet is locked. Please unlock your wallet first using wallet_unlock.",
  nextSteps: [
    "Use wallet_unlock tool to unlock your wallet",
    "Then retry the deployment"
  ]
}
```

### 2. Mainnet Confirmation Guard
```javascript
// If deploying to mainnet without confirmation:
{
  success: false,
  error: "Mainnet deployment requires confirmMainnet: true...",
  recommendation: [
    "Deploy to testnet first for testing",
    "Verify contract functionality on testnet",
    "Run clarity_audit_contract to check for issues",
    "Only deploy to mainnet after thorough testing",
    "Set confirmMainnet: true to proceed"
  ]
}
```

### 3. Syntax Validation
```javascript
// If contract has syntax errors:
{
  success: false,
  error: "Contract has syntax errors: Unbalanced parentheses...",
  troubleshooting: [
    "Check that your contract has valid Clarity syntax",
    "Ensure your wallet has enough STX for fees",
    "Verify the contract name is valid",
    "Make sure you are connected to the correct network"
  ]
}
```

## Implementation Details

### Service Layer
**File**: `src/services/clarity.ts`

New method: `deployContract()`
```typescript
async deployContract(
  contractName: string,
  contractCode: string,
  privateKey: string,
  targetNetwork: 'mainnet' | 'testnet'
): Promise<{
  success: boolean;
  txId?: string;
  contractId?: string;
  explorerUrl?: string;
  error?: string;
}>
```

**Features**:
- ✅ Contract name validation (kebab-case, lowercase)
- ✅ Syntax validation before deployment
- ✅ Network selection (testnet/mainnet)
- ✅ Transaction creation with `makeContractDeploy`
- ✅ Broadcasting with `broadcastTransaction`
- ✅ Explorer URL generation
- ✅ Comprehensive error handling

### Tool Layer
**File**: `src/tools/clarity-tools.ts`

New tool: `deploy_clarity_contract`

**Parameters** (Zod validated):
- `contractName`: string (validated format)
- `contractCode`: string (full contract)
- `network`: "testnet" | "mainnet"
- `confirmMainnet`: boolean (optional, required for mainnet)

**Integrations**:
- Uses `WalletService` for secure key access
- Uses `ClarityService` for deployment logic
- Validates wallet unlock status
- Provides rich error messages

### Security Integration
- ✅ Private keys from encrypted wallet only
- ✅ Keys never exposed in responses
- ✅ Wallet must be explicitly unlocked
- ✅ Auto-lock after inactivity
- ✅ Mainnet safety confirmation required

## Transaction Flow

```
User Request
    ↓
Validate Parameters (Zod)
    ↓
Check Wallet Unlocked
    ↓
Safety Check (Mainnet Confirmation)
    ↓
Get Private Key (Encrypted Wallet)
    ↓
Validate Contract Name
    ↓
Validate Contract Syntax
    ↓
Select Network (Testnet/Mainnet)
    ↓
Create Deploy Transaction
    ↓
Broadcast to Stacks Network
    ↓
Generate Explorer URL
    ↓
Return Success Response
```

## Error Handling

### Wallet Errors
- Wallet locked → Prompt to unlock
- Insufficient balance → Get testnet STX or fund wallet
- Invalid key → Check wallet configuration

### Contract Errors
- Invalid name → Use kebab-case, lowercase only
- Syntax errors → Fix contract before deployment
- Contract too large → Optimize contract size

### Network Errors
- Broadcast failed → Check network connectivity
- Transaction rejected → Verify contract validity
- Insufficient fee → Ensure adequate STX balance

## Transaction Monitoring

### Explorer Links

**Testnet**:
- Base: `https://explorer.hiro.so`
- Transaction: `https://explorer.hiro.so/txid/{txId}?chain=testnet`

**Mainnet**:
- Base: `https://explorer.stacks.co`
- Transaction: `https://explorer.stacks.co/txid/{txId}?chain=mainnet`

### Confirmation Times
- **Typical**: 10-30 minutes
- **Depends on**: Bitcoin block time (~10 minutes average)
- **Stacks blocks**: Settle on Bitcoin for finality

## Complete Workflow Example

```javascript
// 1. Generate contract
const contract = clarity_write_contract({
  requirements: "Token named MyToken, 1M supply",
  contractType: "fungible-token"
})

// 2. Audit contract
const audit = clarity_audit_contract({
  contractCode: contract.contractCode
})
// Check: audit.score >= 85, audit.recommendation === "approved"

// 3. Unlock wallet
wallet_unlock({ password: "secure-password" })

// 4. Deploy to testnet
const testnetDeploy = deploy_clarity_contract({
  contractName: "my-token",
  contractCode: contract.contractCode,
  network: "testnet"
})

// 5. Monitor transaction
// Visit: testnetDeploy.explorerUrl
// Wait for "Success" status

// 6. Test on testnet
// Interact with deployed contract
// Verify all functions work

// 7. Deploy to mainnet (after successful testing)
const mainnetDeploy = deploy_clarity_contract({
  contractName: "my-token",
  contractCode: contract.contractCode,
  network: "mainnet",
  confirmMainnet: true
})

// 8. Production ready!
// Contract live at: mainnetDeploy.contractId
```

## Dependencies Used

```typescript
import {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode
} from '@stacks/transactions';

import {
  StacksTestnet,
  StacksMainnet
} from '@stacks/network';
```

Already installed in package.json ✅

## Documentation

**Complete Guide**: `docs/clarity/DEPLOYMENT_GUIDE.md`

Covers:
- Prerequisites (wallet, STX balance)
- Parameter details
- Response formats
- Error handling
- Safety features
- Best practices
- Troubleshooting
- Complete examples

## Testing Checklist

- ✅ TypeScript compilation successful
- ✅ Zod parameter validation working
- ✅ Wallet integration functional
- ✅ Network selection correct
- ✅ Syntax validation prevents bad deploys
- ✅ Mainnet confirmation guard active
- ✅ Explorer URLs generated correctly
- ✅ Error messages helpful and actionable

## Tool Count Update

**Before**: 28 MCP tools
**After**: 29 MCP tools

**New Tool**: `deploy_clarity_contract`

## Summary

The new deployment tool completes the Clarity contract lifecycle:

1. **Generate** → `clarity_write_contract`
2. **Audit** → `clarity_audit_contract`
3. **Deploy** → `deploy_clarity_contract` ✨

Users can now manage their entire smart contract workflow from Claude Desktop, from generation through production deployment!

### Key Benefits

✅ **Seamless Integration** - Works with existing wallet and contract tools
✅ **Secure by Design** - Uses encrypted wallet, requires unlock
✅ **Safety First** - Testnet-first approach, mainnet confirmation
✅ **Rich Feedback** - Explorer URLs, transaction tracking, clear errors
✅ **Production Ready** - Supports both testnet and mainnet
✅ **Well Documented** - Comprehensive guide with examples

---

**Your Clarity tools now provide end-to-end smart contract development and deployment!** 🚀
