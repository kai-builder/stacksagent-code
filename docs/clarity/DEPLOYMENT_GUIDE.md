# Clarity Contract Deployment Guide

## Overview

The `deploy_clarity_contract` tool allows you to deploy Clarity smart contracts directly to the Stacks blockchain from Claude Desktop.

## Prerequisites

### 1. Wallet Setup
You must have a wallet created and unlocked:

```javascript
// Create a new wallet (if you don't have one)
wallet_create({ password: "your-secure-password" })

// Or import existing wallet
wallet_import({
  mnemonicOrPrivateKey: "your 24-word mnemonic or private key",
  password: "your-secure-password"
})

// Unlock wallet for deployment
wallet_unlock({ password: "your-secure-password" })
```

### 2. STX Balance
Ensure your wallet has sufficient STX for transaction fees:
- **Testnet**: Get free testnet STX from [Stacks Testnet Faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)
  - **Required**: At least 0.1 STX (deployment fee is fixed at 0.1 STX)
- **Mainnet**: You'll need real STX for transaction fees
  - **Required**: At least 0.1 STX (deployment fee is fixed at 0.1 STX)

### 3. Contract Preparation
- Generate or write your Clarity contract
- Audit it using `clarity_audit_contract`
- Test thoroughly before deployment

## Usage

### Basic Deployment (Testnet)

```javascript
deploy_clarity_contract({
  contractName: "my-token-v1",
  contractCode: "(define-fungible-token...)", // Full contract code
  network: "testnet"
})
```

### Mainnet Deployment (Production)

**IMPORTANT: Always test on testnet first!**

```javascript
deploy_clarity_contract({
  contractName: "my-token-v1",
  contractCode: "(define-fungible-token...)",
  network: "mainnet",
  confirmMainnet: true  // Required safety confirmation
})
```

## Parameters

### contractName (required)
- **Type**: `string`
- **Format**: Must start with lowercase letter, contain only lowercase letters, numbers, and hyphens
- **Examples**:
  - ✅ `my-token`
  - ✅ `nft-collection-v2`
  - ✅ `dao-governance`
  - ❌ `MyToken` (no uppercase)
  - ❌ `my_token` (no underscores)
  - ❌ `123token` (can't start with number)

### contractCode (required)
- **Type**: `string`
- **Description**: The complete Clarity contract code
- **Example**:
```clarity
(define-fungible-token my-token u1000000)
(define-public (transfer ...)
  ...)
```

### network (required)
- **Type**: `"testnet"` or `"mainnet"`
- **Recommendation**: Always use `"testnet"` first for testing
- **Testnet**: Free STX, safe for experimentation
- **Mainnet**: Real STX required, production environment

### confirmMainnet (optional, required for mainnet)
- **Type**: `boolean`
- **Default**: `false`
- **Purpose**: Safety check to prevent accidental mainnet deployments
- **Must be**: `true` for mainnet deployments

## Response Format

### Success Response

```json
{
  "success": true,
  "txId": "0x1234...",
  "contractId": "ST1PQHQ...PGZGM.my-token-v1",
  "network": "testnet",
  "deployerAddress": "ST1PQHQ...PGZGM",
  "explorerUrl": "https://explorer.hiro.so/txid/0x1234...?chain=testnet",
  "message": "Contract 'my-token-v1' deployed successfully to testnet!",
  "nextSteps": [
    "Monitor transaction status: https://explorer.hiro.so/...",
    "Wait for transaction confirmation (typically 10-30 minutes)",
    "Contract will be available at: ST1PQHQ...PGZGM.my-token-v1",
    "After testing on testnet, deploy to mainnet if everything works correctly"
  ],
  "estimatedConfirmationTime": "Transactions typically confirm in 10-30 minutes (depends on Bitcoin block time)"
}
```

### Error Responses

#### Wallet Not Unlocked
```json
{
  "success": false,
  "error": "Wallet is locked. Please unlock your wallet first using wallet_unlock.",
  "nextSteps": [
    "Use wallet_unlock tool to unlock your wallet",
    "Then retry the deployment"
  ]
}
```

#### Mainnet Without Confirmation
```json
{
  "success": false,
  "error": "Mainnet deployment requires confirmMainnet: true...",
  "recommendation": [
    "Deploy to testnet first for testing",
    "Verify contract functionality on testnet",
    "Run clarity_audit_contract to check for issues",
    "Only deploy to mainnet after thorough testing",
    "Set confirmMainnet: true to proceed with mainnet deployment"
  ]
}
```

#### Invalid Contract Name
```json
{
  "success": false,
  "error": "Invalid contract name. Must start with lowercase letter...",
  "troubleshooting": [
    "Check that your contract has valid Clarity syntax",
    "Ensure your wallet has enough STX for transaction fees",
    "Verify the contract name is valid",
    "Make sure you are connected to the correct network"
  ]
}
```

## Complete Workflow Example

### 1. Generate Contract
```javascript
const contract = clarity_write_contract({
  requirements: "Create a fungible token named MyToken with 1000000 supply",
  contractType: "fungible-token"
})
// Save contract code for deployment
```

### 2. Audit Contract
```javascript
const audit = clarity_audit_contract({
  contractCode: contract.contractCode
})
// Review audit results
// Score: 95/100, Recommendation: approved
```

### 3. Deploy to Testnet
```javascript
// First, ensure wallet is unlocked
wallet_unlock({ password: "your-password" })

// Deploy to testnet
const deployment = deploy_clarity_contract({
  contractName: "my-token",
  contractCode: contract.contractCode,
  network: "testnet"
})
// Monitor: https://explorer.hiro.so/txid/0x...
```

### 4. Wait for Confirmation
- Check explorer URL from deployment response
- Typical confirmation time: 10-30 minutes
- Wait for "Success" status on explorer

### 5. Test on Testnet
```javascript
// Interact with your deployed contract
// Test all functions
// Verify behavior matches expectations
```

### 6. Deploy to Mainnet (After Testing)
```javascript
const mainnetDeployment = deploy_clarity_contract({
  contractName: "my-token",
  contractCode: contract.contractCode,
  network: "mainnet",
  confirmMainnet: true  // Required!
})
```

## Safety Features

### 1. Wallet Lock Requirement
- Deployment requires wallet to be unlocked
- Protects private keys from unauthorized use
- Wallet auto-locks after 15 minutes of inactivity

### 2. Mainnet Confirmation
- Requires `confirmMainnet: true` parameter
- Prevents accidental mainnet deployments
- Encourages testnet testing first

### 3. Syntax Validation
- Contract code is validated before deployment
- Prevents deployment of invalid contracts
- Saves transaction fees on failed deployments

### 4. Name Validation
- Ensures contract name follows Clarity rules
- Prevents deployment failures due to invalid names

## Transaction Fees

### Fixed Deployment Fee
All contract deployments use a **fixed fee of 0.1 STX** (100,000 microSTX) for both testnet and mainnet.

### Testnet
- **Fee**: 0.1 STX (fixed)
- **Free STX** from faucet
- No real cost - faucet gives you 500 STX
- Get testnet STX: https://explorer.hiro.so/sandbox/faucet?chain=testnet

### Mainnet
- **Fee**: 0.1 STX (fixed)
- Uses real STX from your wallet
- Predictable cost for deployment

## Explorer Links

### Testnet
- **Explorer**: https://explorer.hiro.so/?chain=testnet
- **Transaction**: `https://explorer.hiro.so/txid/{txId}?chain=testnet`
- **Contract**: `https://explorer.hiro.so/txid/{contractId}?chain=testnet`

### Mainnet
- **Explorer**: https://explorer.stacks.co
- **Transaction**: `https://explorer.stacks.co/txid/{txId}?chain=mainnet`
- **Contract**: `https://explorer.stacks.co/txid/{contractId}?chain=mainnet`

## Troubleshooting

### Deployment Fails: Insufficient Balance
**Problem**: Not enough STX for transaction fees
**Solution**:
- Testnet: Get free STX from faucet
- Mainnet: Transfer STX to your wallet address

### Deployment Fails: Invalid Syntax
**Problem**: Contract has Clarity syntax errors
**Solution**:
- Run `clarity_audit_contract` first
- Fix syntax errors
- Validate with Clarinet locally

### Transaction Pending for Long Time
**Problem**: Bitcoin block confirmation delay
**Solution**:
- Wait patiently (can take 10-60 minutes)
- Check Bitcoin network status
- Monitor on explorer

### Contract Name Already Exists
**Problem**: You've already deployed a contract with this name
**Solution**:
- Use a different contract name (e.g., append `-v2`)
- Or deploy from a different address

## Best Practices

### ✅ DO
1. **Always test on testnet first**
2. **Audit contracts before deployment**
3. **Use descriptive contract names**
4. **Keep private keys secure**
5. **Monitor transactions on explorer**
6. **Document your contract's purpose**
7. **Verify sufficient STX balance**

### ❌ DON'T
1. **Don't deploy directly to mainnet without testing**
2. **Don't reuse contract names**
3. **Don't deploy contracts with critical audit issues**
4. **Don't share your private keys**
5. **Don't skip syntax validation**
6. **Don't deploy without understanding the code**

## Contract Lifecycle

```
1. Generate/Write Contract
   ↓
2. Audit Contract
   ↓
3. Fix Issues
   ↓
4. Deploy to Testnet
   ↓
5. Wait for Confirmation
   ↓
6. Test Functionality
   ↓
7. Verify Behavior
   ↓
8. Deploy to Mainnet (if successful)
   ↓
9. Monitor & Maintain
```

## Security Considerations

### Private Key Security
- Private keys are held in encrypted wallet
- Keys are only used during deployment transaction
- Wallet auto-locks after inactivity
- Never expose private keys in logs or UI

### Contract Immutability
- Once deployed, contracts **cannot be modified**
- Plan carefully before mainnet deployment
- Use versioning in contract names (e.g., `my-contract-v2`)
- Consider upgradability patterns if needed

### Transaction Finality
- Stacks transactions settle on Bitcoin
- Confirmations take 10-30 minutes typically
- Once confirmed, deployment is permanent
- Monitor transaction status on explorer

## Getting Help

If you encounter issues:
1. Check this deployment guide
2. Review error messages carefully
3. Verify wallet is unlocked and funded
4. Test contract syntax with audit tool
5. Check Stacks network status
6. Consult [Stacks Documentation](https://docs.stacks.co)

## Related Tools

- `clarity_write_contract` - Generate contracts
- `clarity_audit_contract` - Audit contracts
- `wallet_create` - Create new wallet
- `wallet_unlock` - Unlock wallet for transactions
- `wallet_get_balance` - Check STX balance
- `wallet_status` - Check wallet state

## Example: Complete Deployment Session

```javascript
// 1. Check wallet status
wallet_status()
// → { walletExists: true, isUnlocked: false }

// 2. Unlock wallet
wallet_unlock({ password: "my-password" })
// → { success: true, address: "ST1..." }

// 3. Check balance
wallet_get_balance()
// → { stx: "100.000000" } - Sufficient for deployment

// 4. Generate contract
const contract = clarity_write_contract({
  requirements: "NFT collection called CoolArt",
  contractType: "non-fungible-token"
})

// 5. Audit contract
const audit = clarity_audit_contract({
  contractCode: contract.contractCode
})
// → { score: 92, recommendation: "approved" }

// 6. Deploy to testnet
const deployment = deploy_clarity_contract({
  contractName: "cool-art-nft",
  contractCode: contract.contractCode,
  network: "testnet"
})
// → { success: true, txId: "0x...", explorerUrl: "https://..." }

// 7. Monitor on explorer
// Visit deployment.explorerUrl
// Wait for "Success" status

// 8. Test contract on testnet
// Interact with contract functions
// Verify everything works

// 9. Deploy to mainnet (after successful testing)
const mainnetDeploy = deploy_clarity_contract({
  contractName: "cool-art-nft",
  contractCode: contract.contractCode,
  network: "mainnet",
  confirmMainnet: true
})
// → { success: true, contractId: "ST1....cool-art-nft" }
```

---

**Remember: Blockchain deployments are permanent. Always test thoroughly on testnet before deploying to mainnet!**
