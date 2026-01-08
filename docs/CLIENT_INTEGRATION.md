# Stacks Agent API - Client Integration Guide

This guide explains how to build a client application (web or mobile) that uses the **Stacks Agent HTTP API** together with the **Claude API** to create an AI-powered Stacks blockchain assistant.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Getting Started](#getting-started)
3. [API Reference](#api-reference)
4. [Integrating with Claude API](#integrating-with-claude-api)
5. [Authentication & Security](#authentication--security)
6. [Example Implementations](#example-implementations)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Web App                              │
│                    (stacksagent.com)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐          ┌──────────────────────────────┐    │
│  │   Frontend   │          │      Backend (Optional)       │    │
│  │   (React)    │◄────────►│   - Session management        │    │
│  │              │          │   - API key storage           │    │
│  └──────┬───────┘          │   - Rate limiting             │    │
│         │                  └──────────────────────────────┘    │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
├─────────────────────┬───────────────────────────────────────────┤
│                     │                                            │
│  ┌─────────────┐   │   ┌─────────────────────────────────┐     │
│  │ Claude API  │   │   │    Stacks Agent HTTP API        │     │
│  │ (Anthropic) │   │   │    (localhost:3001 or hosted)   │     │
│  │             │   │   │                                  │     │
│  │ - Chat      │   │   │  - /api/wallet/*                │     │
│  │ - Tool use  │   │   │  - /api/dex/*                   │     │
│  │ - Streaming │   │   │  - /api/stacking/*              │     │
│  │             │   │   │  - /api/contract/*              │     │
│  └─────────────┘   │   │  - /api/price/*                 │     │
│                     │   │  - /api/portfolio/*             │     │
│                     │   └─────────────────────────────────┘     │
│                     │                                            │
└─────────────────────┴───────────────────────────────────────────┘
```

### How It Works

1. **User sends a message** to your app (e.g., "What's my STX balance?")
2. **Your app sends the message to Claude API** with tool definitions
3. **Claude decides which tool to call** (e.g., `get_wallet_balance`)
4. **Your app calls the Stacks Agent API** with the tool parameters
5. **Your app sends the result back to Claude** for final response
6. **Claude generates a human-friendly response** for the user

---

## Getting Started

### Prerequisites

- Node.js 18+
- Claude API key from [Anthropic Console](https://console.anthropic.com)
- Stacks Agent API running (locally or hosted)

### Starting the Stacks Agent API

```bash
# Clone and install
git clone https://github.com/kai-builder/stacksagent-mcp.git
cd stacksagent-mcp
npm install

# Build and run API server
npm run build
npm run api

# API available at http://localhost:3001
```

### Quick Test

```bash
# Health check
curl http://localhost:3001/health

# Get stacking info
curl http://localhost:3001/api/stacking/info

# Get STX price
curl http://localhost:3001/api/price/STX
```

---

## API Reference

### Base URL

```
http://localhost:3001  (development)
https://api.stacksagent.com  (production - example)
```

### Response Format

All endpoints return JSON with this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

### Wallet Endpoints

#### GET /api/wallet/balance/:address

Get wallet balance for any Stacks address.

```bash
curl http://localhost:3001/api/wallet/balance/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7
```

**Response:**
```json
{
  "success": true,
  "address": "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
  "balance": {
    "stx": "1234567890",
    "tokens": [
      {
        "symbol": "WELSH",
        "balance": "1000000000",
        "decimals": 6
      }
    ]
  }
}
```

#### POST /api/wallet/create

Create a new wallet.

```bash
curl -X POST http://localhost:3001/api/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"password": "your-secure-password", "label": "My Wallet"}'
```

**Response:**
```json
{
  "success": true,
  "walletId": "uuid-here",
  "mnemonic": "word1 word2 ... word24",
  "accounts": [
    {
      "index": 0,
      "mainnetAddress": "SP...",
      "testnetAddress": "ST..."
    }
  ],
  "warning": "SAVE YOUR MNEMONIC PHRASE!"
}
```

#### POST /api/wallet/import

Import existing wallet from mnemonic.

```bash
curl -X POST http://localhost:3001/api/wallet/import \
  -H "Content-Type: application/json" \
  -d '{
    "mnemonic": "word1 word2 ... word24",
    "password": "your-secure-password",
    "label": "Imported Wallet"
  }'
```

#### POST /api/wallet/unlock

Unlock wallet for signing transactions.

```bash
curl -X POST http://localhost:3001/api/wallet/unlock \
  -H "Content-Type: application/json" \
  -d '{"password": "your-secure-password"}'
```

#### POST /api/wallet/lock

Lock the wallet (clear keys from memory).

```bash
curl -X POST http://localhost:3001/api/wallet/lock
```

#### GET /api/wallet/list

List all wallets.

```bash
curl http://localhost:3001/api/wallet/list
```

#### GET /api/wallet/status

Get current wallet status.

```bash
curl http://localhost:3001/api/wallet/status
```

---

### Price Endpoints

#### GET /api/price/:symbol

Get current price for a token.

```bash
curl http://localhost:3001/api/price/STX
```

**Response:**
```json
{
  "success": true,
  "price": {
    "symbol": "STX",
    "priceUsd": 1.25,
    "change24h": 5.2,
    "lastUpdated": 1704537600000
  }
}
```

#### POST /api/price/batch

Get prices for multiple tokens.

```bash
curl -X POST http://localhost:3001/api/price/batch \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["STX", "WELSH", "sBTC"]}'
```

#### GET /api/price/trending/tokens

Get trending tokens.

```bash
curl "http://localhost:3001/api/price/trending/tokens?limit=10&filter=trending"
```

**Query Parameters:**
- `limit` (number): Max tokens to return (default: 10)
- `filter` (string): `trending`, `new`, or `volume`

#### GET /api/price/pools/list

Get liquidity pools.

```bash
curl "http://localhost:3001/api/price/pools/list?protocol=bitflow&limit=20"
```

**Query Parameters:**
- `protocol` (string): `alex`, `velar`, `bitflow`, or omit for all
- `limit` (number): Max pools to return (default: 20)

---

### DEX/Swap Endpoints

#### POST /api/dex/quote

Get a swap quote from Bitflow.

```bash
curl -X POST http://localhost:3001/api/dex/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "STX",
    "toToken": "WELSH",
    "amount": "100"
  }'
```

**Response:**
```json
{
  "success": true,
  "quote": {
    "fromToken": "STX",
    "toToken": "WELSH",
    "fromAmount": "100",
    "toAmount": "12500000",
    "rate": "125000",
    "slippage": 1,
    "fee": "variable",
    "route": ["STX", "WELSH"],
    "protocol": "bitflow"
  }
}
```

#### POST /api/dex/multi-quote

Get quotes from all available AMMs.

```bash
curl -X POST http://localhost:3001/api/dex/multi-quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx",
    "toToken": "SP3NE50GEXFG9SZGEPBER57M5V1CM4TDVXKBY0CH9.welshcorgicoin-token",
    "amount": 100
  }'
```

**Response:**
```json
{
  "success": true,
  "quotes": [
    {
      "amm": "bitflow",
      "fromToken": { "contract_id": "...", "symbol": "STX" },
      "toToken": { "contract_id": "...", "symbol": "WELSH" },
      "amountIn": 100,
      "amountOut": 12500000
    }
  ],
  "bestQuote": { ... }
}
```

#### POST /api/dex/swap

Execute a swap (requires unlocked wallet).

```bash
curl -X POST http://localhost:3001/api/dex/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "STX",
    "toToken": "WELSH",
    "amount": "100",
    "slippage": 1,
    "password": "your-wallet-password"
  }'
```

**Response:**
```json
{
  "success": true,
  "swap": {
    "txHash": "0x...",
    "status": "pending",
    "fromToken": "STX",
    "toToken": "WELSH",
    "fromAmount": "100",
    "toAmount": "12500000"
  }
}
```

#### POST /api/dex/execute

Execute swap using multi-AMM service.

```bash
curl -X POST http://localhost:3001/api/dex/execute \
  -H "Content-Type: application/json" \
  -d '{
    "fromToken": "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx",
    "toToken": "SP3NE50GEXFG9SZGEPBER57M5V1CM4TDVXKBY0CH9.welshcorgicoin-token",
    "amount": 100,
    "slippage": 0.5,
    "password": "your-wallet-password",
    "preferredAmm": "bitflow"
  }'
```

---

### Stacking Endpoints

#### GET /api/stacking/info

Get current stacking/PoX information.

```bash
curl http://localhost:3001/api/stacking/info
```

**Response:**
```json
{
  "success": true,
  "stacking": {
    "currentCycle": 84,
    "nextCycleStart": 1704624000000,
    "minStackingAmount": "100",
    "estimatedApy": 8.0
  }
}
```

#### GET /api/stacking/status/:address

Get stacking status for an address.

```bash
curl http://localhost:3001/api/stacking/status/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7
```

#### GET /api/stacking/pox

Get detailed PoX information.

```bash
curl http://localhost:3001/api/stacking/pox
```

#### GET /api/stacking/cycles

Get stacking cycle history.

```bash
curl "http://localhost:3001/api/stacking/cycles?limit=10&offset=0"
```

#### GET /api/stacking/signers/:cycleId

Get signers for a specific cycle.

```bash
curl "http://localhost:3001/api/stacking/signers/84?limit=50"
```

#### GET /api/stacking/positions/:address

Search stacking positions for an address.

```bash
curl http://localhost:3001/api/stacking/positions/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7
```

#### POST /api/stacking/stack

Stack STX for PoX rewards.

```bash
curl -X POST http://localhost:3001/api/stacking/stack \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "10000",
    "cycles": 12,
    "poxAddress": "bc1q...",
    "password": "your-wallet-password"
  }'
```

---

### Contract Endpoints

#### POST /api/contract/generate

Generate a Clarity smart contract from requirements.

```bash
curl -X POST http://localhost:3001/api/contract/generate \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Create a fungible token called MyToken with symbol MTK and supply of 1000000",
    "contractType": "fungible-token",
    "features": ["mintable", "burnable"]
  }'
```

**Response:**
```json
{
  "success": true,
  "contract": {
    "name": "my-token",
    "code": ";; MyToken contract...",
    "analysis": {
      "syntaxValid": true,
      "functions": [...],
      "dataVars": [...],
      "estimatedComplexity": "low"
    }
  }
}
```

#### POST /api/contract/audit

Audit a Clarity contract for security issues.

```bash
curl -X POST http://localhost:3001/api/contract/audit \
  -H "Content-Type: application/json" \
  -d '{
    "contractCode": "(define-fungible-token my-token) ..."
  }'
```

**Response:**
```json
{
  "success": true,
  "audit": {
    "contractName": "my-token",
    "timestamp": "2024-01-06T12:00:00Z",
    "summary": {
      "totalIssues": 2,
      "critical": 0,
      "high": 0,
      "medium": 1,
      "low": 1,
      "informational": 0
    },
    "securityIssues": [...],
    "bestPracticeIssues": [...],
    "optimizationSuggestions": [...],
    "score": 85,
    "recommendation": "approved"
  }
}
```

#### POST /api/contract/deploy

Deploy a contract to the blockchain.

```bash
curl -X POST http://localhost:3001/api/contract/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "contractName": "my-token",
    "contractCode": "(define-fungible-token my-token) ...",
    "password": "your-wallet-password",
    "network": "testnet"
  }'
```

---

### Portfolio Endpoints

#### GET /api/portfolio/:address

Get portfolio summary for an address.

```bash
curl http://localhost:3001/api/portfolio/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7
```

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "address": "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
    "totalValueUsd": 12500.50,
    "stxBalance": "10000000000",
    "stxValueUsd": 12500.00,
    "tokens": [
      {
        "symbol": "WELSH",
        "balance": "1000000000",
        "decimals": 6,
        "usdValue": 0.50
      }
    ],
    "stackingValue": 0
  }
}
```

**Note:** You can also pass BNS names like `satoshi.btc`:

```bash
curl http://localhost:3001/api/portfolio/satoshi.btc
```

#### GET /api/portfolio/:address/history

Get historical portfolio data.

```bash
curl "http://localhost:3001/api/portfolio/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7/history?days=30"
```

#### GET /api/portfolio/:address/transactions

Get recent transactions.

```bash
curl "http://localhost:3001/api/portfolio/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7/transactions?limit=20"
```

#### GET /api/portfolio/:address/pnl

Get profit/loss calculation.

```bash
curl "http://localhost:3001/api/portfolio/SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7/pnl?days=30"
```

---

## Integrating with Claude API

The key to building an AI-powered Stacks assistant is connecting Claude's tool-use capability with the Stacks Agent API.

### Step 1: Define Tools for Claude

Create tool definitions that map to Stacks Agent API endpoints:

```typescript
const tools = [
  {
    name: "get_wallet_balance",
    description: "Get the STX and token balance for a Stacks wallet address",
    input_schema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "The Stacks wallet address (SP... or ST...)"
        }
      },
      required: ["address"]
    }
  },
  {
    name: "get_stx_price",
    description: "Get the current price of STX in USD",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_stacking_info",
    description: "Get current stacking/PoX cycle information",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_swap_quote",
    description: "Get a quote for swapping tokens on Stacks DEXes",
    input_schema: {
      type: "object",
      properties: {
        fromToken: {
          type: "string",
          description: "Token to swap from (e.g., 'STX', 'WELSH')"
        },
        toToken: {
          type: "string",
          description: "Token to swap to"
        },
        amount: {
          type: "string",
          description: "Amount to swap"
        }
      },
      required: ["fromToken", "toToken", "amount"]
    }
  },
  {
    name: "get_portfolio",
    description: "Get portfolio summary including total value, holdings, and stacking status",
    input_schema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Stacks address or BNS name (e.g., satoshi.btc)"
        }
      },
      required: ["address"]
    }
  },
  {
    name: "generate_contract",
    description: "Generate a Clarity smart contract from requirements",
    input_schema: {
      type: "object",
      properties: {
        requirements: {
          type: "string",
          description: "Natural language description of the contract"
        },
        contractType: {
          type: "string",
          enum: ["fungible-token", "non-fungible-token", "vault", "dao"],
          description: "Type of contract to generate"
        }
      },
      required: ["requirements", "contractType"]
    }
  },
  {
    name: "audit_contract",
    description: "Audit a Clarity contract for security issues",
    input_schema: {
      type: "object",
      properties: {
        contractCode: {
          type: "string",
          description: "The Clarity contract code to audit"
        }
      },
      required: ["contractCode"]
    }
  }
];
```

### Step 2: Handle Tool Calls

Create a function to execute tools by calling the Stacks Agent API:

```typescript
const STACKS_API_BASE = "http://localhost:3001";

async function executeTool(toolName: string, toolInput: any): Promise<string> {
  switch (toolName) {
    case "get_wallet_balance": {
      const response = await fetch(
        `${STACKS_API_BASE}/api/wallet/balance/${toolInput.address}`
      );
      return JSON.stringify(await response.json());
    }

    case "get_stx_price": {
      const response = await fetch(`${STACKS_API_BASE}/api/price/STX`);
      return JSON.stringify(await response.json());
    }

    case "get_stacking_info": {
      const response = await fetch(`${STACKS_API_BASE}/api/stacking/info`);
      return JSON.stringify(await response.json());
    }

    case "get_swap_quote": {
      const response = await fetch(`${STACKS_API_BASE}/api/dex/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toolInput)
      });
      return JSON.stringify(await response.json());
    }

    case "get_portfolio": {
      const response = await fetch(
        `${STACKS_API_BASE}/api/portfolio/${toolInput.address}`
      );
      return JSON.stringify(await response.json());
    }

    case "generate_contract": {
      const response = await fetch(`${STACKS_API_BASE}/api/contract/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toolInput)
      });
      return JSON.stringify(await response.json());
    }

    case "audit_contract": {
      const response = await fetch(`${STACKS_API_BASE}/api/contract/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toolInput)
      });
      return JSON.stringify(await response.json());
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
```

### Step 3: Chat Loop with Tool Use

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

async function chat(userMessage: string, conversationHistory: any[] = []) {
  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  // Initial Claude API call
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are a helpful Stacks blockchain assistant. You help users:
- Check wallet balances and portfolio values
- Get token prices and market information
- Understand stacking/PoX rewards
- Generate and audit Clarity smart contracts
- Execute token swaps

Always use the available tools to get real-time data. Be concise and helpful.`,
    tools: tools,
    messages: conversationHistory
  });

  // Handle tool use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    // Execute all tool calls
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeTool(toolUse.name, toolUse.input);
        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result
        };
      })
    );

    // Add assistant response and tool results to history
    conversationHistory.push({
      role: "assistant",
      content: response.content
    });
    conversationHistory.push({
      role: "user",
      content: toolResults
    });

    // Continue conversation
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a helpful Stacks blockchain assistant...`,
      tools: tools,
      messages: conversationHistory
    });
  }

  // Extract final text response
  const textBlock = response.content.find((block) => block.type === "text");
  const assistantMessage = textBlock?.text || "";

  // Add to history
  conversationHistory.push({
    role: "assistant",
    content: response.content
  });

  return {
    message: assistantMessage,
    history: conversationHistory
  };
}

// Usage example
async function main() {
  let history = [];

  // First message
  let result = await chat("What's the current STX price?", history);
  console.log("Assistant:", result.message);
  history = result.history;

  // Follow-up
  result = await chat("What's my balance at SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7?", history);
  console.log("Assistant:", result.message);
}

main();
```

---

## Authentication & Security

### BYOK (Bring Your Own Key)

For production apps, users should provide their own Claude API key:

```typescript
// Client-side: User enters their API key
const userApiKey = getUserApiKeyFromInput();

// Option 1: Direct API calls from client (not recommended for web)
const anthropic = new Anthropic({ apiKey: userApiKey });

// Option 2: Proxy through your backend
const response = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Claude-API-Key": userApiKey  // Pass to backend
  },
  body: JSON.stringify({ message: userMessage })
});
```

### Wallet Security

**Important:** The Stacks Agent API stores encrypted wallet keystores on the server. For a production multi-user app:

1. **Don't share wallet state** - Each user should have their own wallet instance
2. **Use session-based wallet management** - Associate wallets with user sessions
3. **Consider client-side signing** - Use Stacks Connect for transaction signing instead

```typescript
// Example: Using Stacks Connect for client-side signing
import { openSTXTransfer } from "@stacks/connect";

// Instead of server-side swap execution:
openSTXTransfer({
  recipient: "SP...",
  amount: "1000000",
  network: "mainnet",
  onFinish: (data) => {
    console.log("Transaction:", data.txId);
  }
});
```

### Rate Limiting

Implement rate limiting to protect both APIs:

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});

app.use("/api/", limiter);
```

---

## Example Implementations

### React Frontend Example

```tsx
import { useState } from "react";

function StacksChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages
        })
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message }
      ]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && <div className="loading">Thinking...</div>}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about Stacks..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

### Next.js API Route Example

```typescript
// pages/api/chat.ts
import { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

const STACKS_API = process.env.STACKS_API_URL || "http://localhost:3001";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history = [] } = req.body;

  // Use user's API key if provided (BYOK)
  const apiKey = req.headers["x-claude-api-key"] || process.env.CLAUDE_API_KEY;

  const anthropic = new Anthropic({ apiKey });

  try {
    // ... implement chat logic with tool use
    const response = await chat(message, history, anthropic);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Python Client Example

```python
import anthropic
import requests

STACKS_API = "http://localhost:3001"

def execute_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "get_wallet_balance":
        response = requests.get(
            f"{STACKS_API}/api/wallet/balance/{tool_input['address']}"
        )
        return response.text
    elif tool_name == "get_stx_price":
        response = requests.get(f"{STACKS_API}/api/price/STX")
        return response.text
    elif tool_name == "get_stacking_info":
        response = requests.get(f"{STACKS_API}/api/stacking/info")
        return response.text
    # ... more tools
    return '{"error": "Unknown tool"}'

def chat(user_message: str, history: list = None):
    if history is None:
        history = []

    client = anthropic.Anthropic()

    history.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system="You are a helpful Stacks blockchain assistant...",
        tools=tools,  # Define tools similar to JS example
        messages=history
    )

    # Handle tool use loop
    while response.stop_reason == "tool_use":
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        history.append({"role": "assistant", "content": response.content})
        history.append({"role": "user", "content": tool_results})

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system="You are a helpful Stacks blockchain assistant...",
            tools=tools,
            messages=history
        )

    # Extract text response
    text_content = next(
        (b.text for b in response.content if hasattr(b, 'text')),
        ""
    )

    return {"message": text_content, "history": history}

# Usage
result = chat("What's the STX price?")
print(result["message"])
```

---

## Error Handling

### API Errors

```typescript
async function safeApiCall(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error
      throw new Error("Unable to connect to Stacks API");
    }
    throw error;
  }
}
```

### Claude API Errors

```typescript
try {
  const response = await anthropic.messages.create({ ... });
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      // Invalid API key
    } else if (error.status === 429) {
      // Rate limited
    } else if (error.status === 500) {
      // Server error
    }
  }
}
```

### User-Friendly Error Messages

```typescript
function formatErrorForUser(error: Error): string {
  const errorMap = {
    "Invalid password": "The wallet password is incorrect. Please try again.",
    "Wallet is locked": "Please unlock your wallet first.",
    "Insufficient balance": "You don't have enough tokens for this transaction.",
    "No quotes available": "Unable to find a swap route for these tokens.",
  };

  for (const [key, message] of Object.entries(errorMap)) {
    if (error.message.includes(key)) {
      return message;
    }
  }

  return "Something went wrong. Please try again.";
}
```

---

## Best Practices

### 1. Cache Frequently Accessed Data

```typescript
const priceCache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function getCachedPrice(symbol: string) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(`${STACKS_API}/api/price/${symbol}`);
  const data = await response.json();

  priceCache.set(symbol, { data, timestamp: Date.now() });
  return data;
}
```

### 2. Validate User Inputs

```typescript
function isValidStacksAddress(address: string): boolean {
  return /^(SP|ST)[A-Z0-9]{38,40}$/.test(address);
}

function isValidBnsName(name: string): boolean {
  return /^[a-z0-9-]+\.(btc|stx)$/.test(name);
}
```

### 3. Use Streaming for Better UX

```typescript
// Stream Claude responses for real-time display
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [{ role: "user", content: userMessage }]
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    // Update UI with partial response
    onPartialResponse(event.delta.text);
  }
}
```

### 4. Log and Monitor

```typescript
// Log all API calls for debugging
async function loggedFetch(url: string, options?: RequestInit) {
  const startTime = Date.now();

  try {
    const response = await fetch(url, options);
    console.log(`[API] ${options?.method || 'GET'} ${url} - ${response.status} (${Date.now() - startTime}ms)`);
    return response;
  } catch (error) {
    console.error(`[API] ${options?.method || 'GET'} ${url} - ERROR (${Date.now() - startTime}ms)`, error);
    throw error;
  }
}
```

### 5. Handle Network Failures Gracefully

```typescript
async function fetchWithRetry(url: string, options?: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
    }
  }
}
```

---

## Support

- **GitHub Issues**: [stacksagent-mcp/issues](https://github.com/kai-builder/stacksagent-mcp/issues)
- **Stacks Documentation**: [docs.stacks.co](https://docs.stacks.co)
- **Claude API Documentation**: [docs.anthropic.com](https://docs.anthropic.com)

---

## License

MIT License - See [LICENSE](../LICENSE) for details.
