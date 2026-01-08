# Stacks Agent API - Quick Reference

Base URL: `http://localhost:3001`

## Health & Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api` | API information |

## Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/balance/:address` | Get wallet balance |
| GET | `/api/wallet/list` | List all wallets |
| GET | `/api/wallet/status` | Get wallet status |
| GET | `/api/wallet/accounts` | List accounts in active wallet |
| POST | `/api/wallet/create` | Create new wallet |
| POST | `/api/wallet/import` | Import wallet from mnemonic |
| POST | `/api/wallet/unlock` | Unlock wallet |
| POST | `/api/wallet/lock` | Lock wallet |

## Price

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/price/:symbol` | Get token price |
| GET | `/api/price/trending/tokens` | Get trending tokens |
| GET | `/api/price/pools/list` | Get liquidity pools |
| POST | `/api/price/batch` | Get multiple prices |

## DEX / Swap

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dex/quote` | Get swap quote (Bitflow) |
| POST | `/api/dex/swap` | Execute swap (Bitflow) |
| POST | `/api/dex/multi-quote` | Get quotes from all AMMs |
| POST | `/api/dex/execute` | Execute swap (best AMM) |

## Stacking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stacking/info` | Get stacking info |
| GET | `/api/stacking/status/:address` | Get stacking status |
| GET | `/api/stacking/pox` | Get detailed PoX info |
| GET | `/api/stacking/cycles` | Get cycle history |
| GET | `/api/stacking/signers/:cycleId` | Get signers for cycle |
| GET | `/api/stacking/positions/:address` | Get stacking positions |
| GET | `/api/stacking/rewards` | Get burnchain rewards |
| POST | `/api/stacking/stack` | Stack STX |

## Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contract/generate` | Generate contract |
| POST | `/api/contract/audit` | Audit contract |
| POST | `/api/contract/deploy` | Deploy contract |

## Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolio/:address` | Get portfolio summary |
| GET | `/api/portfolio/:address/history` | Get historical data |
| GET | `/api/portfolio/:address/transactions` | Get transactions |
| GET | `/api/portfolio/:address/pnl` | Get profit/loss |
| GET | `/api/portfolio/resolve/:name` | Resolve BNS name |

---

## Common Request Bodies

### Create Wallet
```json
{
  "password": "string",
  "label": "string (optional)"
}
```

### Import Wallet
```json
{
  "mnemonic": "24 word phrase",
  "password": "string",
  "label": "string (optional)"
}
```

### Swap Quote
```json
{
  "fromToken": "STX",
  "toToken": "WELSH",
  "amount": "100"
}
```

### Execute Swap
```json
{
  "fromToken": "STX",
  "toToken": "WELSH",
  "amount": "100",
  "slippage": 1,
  "password": "wallet-password"
}
```

### Generate Contract
```json
{
  "requirements": "description",
  "contractType": "fungible-token|non-fungible-token|vault|dao",
  "features": ["mintable", "burnable"]
}
```

### Audit Contract
```json
{
  "contractCode": "clarity code here"
}
```

### Stack STX
```json
{
  "amount": "10000",
  "cycles": 12,
  "poxAddress": "bc1q...",
  "password": "wallet-password"
}
```

---

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Quick Start

```bash
# Start API
npm run api

# Test health
curl http://localhost:3001/health

# Get STX price
curl http://localhost:3001/api/price/STX

# Get stacking info
curl http://localhost:3001/api/stacking/info

# Get wallet balance
curl http://localhost:3001/api/wallet/balance/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7

# Get portfolio
curl http://localhost:3001/api/portfolio/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7

# Get swap quote
curl -X POST http://localhost:3001/api/dex/quote \
  -H "Content-Type: application/json" \
  -d '{"fromToken":"STX","toToken":"WELSH","amount":"100"}'
```
