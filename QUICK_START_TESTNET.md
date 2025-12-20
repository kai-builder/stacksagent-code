# Quick Start: Deploying on Testnet

## Step-by-Step Guide

### 1. Unlock Your Wallet
```javascript
wallet_unlock({ password: "your-password" })
```

**Response shows BOTH addresses:**
```json
{
  "success": true,
  "mainnetAddress": "SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ",
  "testnetAddress": "ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0",
  "network": "mainnet",
  "networkInfo": {
    "mainnet": "Your mainnet address: SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ",
    "testnet": "Your testnet address: ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0",
    "active": "Active address (mainnet): SP3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2N9S6RCJ"
  }
}
```

### 2. Check Your Testnet Balance
```javascript
wallet_get_balance({ address: "ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0" })
```

**System auto-detects ST prefix = testnet!**

### 3. Get Testnet STX (If Needed)

**Deployment requires at least 0.1 STX for transaction fees.**

**If balance is less than 0.1 STX, get free testnet STX:**
1. Visit: https://explorer.hiro.so/sandbox/faucet?chain=testnet
2. Enter your ST... address
3. Click "Request STX"
4. Wait ~1 minute for confirmation

**You'll receive 500 testnet STX for free!** (Way more than the 0.1 STX needed)

### 4. Generate Your Contract
```javascript
clarity_write_contract({
  requirements: "Create a fungible token named SAGENT with 1 billion supply and 6 decimals",
  contractType: "fungible-token"
})
```

### 5. Audit (Optional but Recommended)
```javascript
clarity_audit_contract({
  contractCode: "...(contract code from step 4)..."
})
```

### 6. Deploy to Testnet
```javascript
deploy_clarity_contract({
  contractName: "sagent-token",
  contractCode: "...(contract code from step 4)...",
  network: "testnet"
})
```

**Success Response:**
```json
{
  "success": true,
  "txId": "0x1234...",
  "contractId": "ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0.sagent-token",
  "network": "testnet",
  "deployerAddress": "ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0",
  "explorerUrl": "https://explorer.hiro.so/txid/0x1234...?chain=testnet",
  "message": "Contract 'sagent-token' deployed successfully to testnet!"
}
```

### 7. Monitor Deployment
Visit the explorer URL to watch your transaction confirm (10-30 minutes).

---

## Common Issues & Solutions

### Issue: "NotEnoughFunds"
**Error Response:**
```json
{
  "error": "Broadcast failed: transaction rejected - NotEnoughFunds",
  "deployerAddress": "ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0",
  "hint": "Deployment will use testnet address: ST3YF2YMAGQPRTDDGV5161KBPSK4PX9TZ2NKRZ3S0. Check this address has sufficient STX balance."
}
```

**Solution:**
1. Note the `deployerAddress` shown in error
2. Visit testnet faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet
3. Enter the deployer address
4. Get free STX
5. Retry deployment

### Issue: Don't Know Testnet Address
**Solution:**
Just unlock your wallet - it now shows BOTH addresses!

### Issue: Config is Mainnet but Want Testnet
**No problem!** You can deploy to testnet even with mainnet config:
- The system auto-detects and uses the correct testnet address
- You'll see a warning showing which address is being used

---

## Key Points to Remember

✅ **Same private key = 2 addresses**: SP... (mainnet) and ST... (testnet)
✅ **Network auto-detected**: System knows ST = testnet, SP = mainnet
✅ **Unlock shows both**: You always see both addresses when unlocking
✅ **Deploy anywhere**: Can deploy to testnet even if config is mainnet
✅ **Testnet is FREE**: Get unlimited testnet STX from faucet
✅ **Test first**: Always test on testnet before mainnet!

---

## Full Example Session

```javascript
// 1. Unlock (see both addresses)
wallet_unlock({ password: "mypassword" })
// → mainnet: SP..., testnet: ST...

// 2. Check testnet balance
wallet_get_balance({ address: "ST..." })
// → If 0, go to faucet

// 3. Generate token
const contract = clarity_write_contract({
  requirements: "Token named SAGENT, 1B supply, 6 decimals",
  contractType: "fungible-token"
})

// 4. Deploy
deploy_clarity_contract({
  contractName: "sagent",
  contractCode: contract.contractCode,
  network: "testnet"
})
// → Shows deployer address, explorer URL

// 5. Wait ~15 minutes, check explorer
// 6. Test contract functions
// 7. If all good, deploy to mainnet with confirmMainnet: true
```

---

## Testnet Resources

- **Faucet**: https://explorer.hiro.so/sandbox/faucet?chain=testnet
- **Explorer**: https://explorer.hiro.so/?chain=testnet
- **API**: https://api.testnet.hiro.so

---

Happy testing! 🚀
