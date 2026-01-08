import Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions for Claude API
 * These map to the Stacks Agent HTTP API endpoints
 */
export const tools: Anthropic.Tool[] = [
  {
    name: "get_wallet_balance",
    description:
      "Get the STX and token balance for a Stacks wallet address. Returns balance in microSTX (1 STX = 1,000,000 microSTX) and any token holdings.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description:
            "The Stacks wallet address (starts with SP for mainnet or ST for testnet) or a BNS name like satoshi.btc",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_token_price",
    description:
      "Get the current price of a token in USD. Supports STX, WELSH, sBTC, and other Stacks ecosystem tokens.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description: "The token symbol (e.g., 'STX', 'WELSH', 'sBTC')",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_stacking_info",
    description:
      "Get current stacking/PoX information including the current cycle, minimum stacking amount, and estimated APY.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_stacking_status",
    description:
      "Get the stacking status for a specific address - whether they are stacking, how much, and when it unlocks.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description: "The Stacks wallet address to check stacking status for",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_swap_quote",
    description:
      "Get a quote for swapping one token to another on Stacks DEXes. Returns the expected output amount, exchange rate, and fees.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromToken: {
          type: "string",
          description: "The token symbol to swap from (e.g., 'STX')",
        },
        toToken: {
          type: "string",
          description: "The token symbol to swap to (e.g., 'WELSH')",
        },
        amount: {
          type: "string",
          description: "The amount to swap (in human-readable units, e.g., '100' for 100 STX)",
        },
      },
      required: ["fromToken", "toToken", "amount"],
    },
  },
  {
    name: "get_portfolio",
    description:
      "Get a comprehensive portfolio summary for an address including total value in USD, STX holdings, token holdings, and stacking status.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description:
            "The Stacks wallet address or BNS name (e.g., 'SP...' or 'satoshi.btc')",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_trending_tokens",
    description:
      "Get a list of trending tokens on Stacks with their prices, volume, and liquidity.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of tokens to return (default: 10)",
        },
        filter: {
          type: "string",
          enum: ["trending", "new", "volume"],
          description: "Filter type: 'trending' for most active, 'new' for recently launched, 'volume' for highest volume",
        },
      },
      required: [],
    },
  },
  {
    name: "get_liquidity_pools",
    description:
      "Get information about liquidity pools on Stacks DEXes including TVL, APY, and volume.",
    input_schema: {
      type: "object" as const,
      properties: {
        protocol: {
          type: "string",
          enum: ["alex", "velar", "bitflow"],
          description: "Filter by specific DEX protocol (optional, omit for all)",
        },
        limit: {
          type: "number",
          description: "Maximum number of pools to return (default: 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "generate_contract",
    description:
      "Generate a Clarity smart contract from natural language requirements. Supports fungible tokens, NFTs, vaults, and DAOs.",
    input_schema: {
      type: "object" as const,
      properties: {
        requirements: {
          type: "string",
          description:
            "Natural language description of what the contract should do (e.g., 'Create a fungible token called MyToken with symbol MTK and 1 million supply')",
        },
        contractType: {
          type: "string",
          enum: ["fungible-token", "non-fungible-token", "vault", "dao"],
          description: "The type of contract to generate",
        },
        features: {
          type: "array",
          items: { type: "string" },
          description: "Optional features to include (e.g., ['mintable', 'burnable', 'pausable'])",
        },
      },
      required: ["requirements", "contractType"],
    },
  },
  {
    name: "audit_contract",
    description:
      "Audit a Clarity smart contract for security vulnerabilities, best practices, and optimization suggestions.",
    input_schema: {
      type: "object" as const,
      properties: {
        contractCode: {
          type: "string",
          description: "The Clarity contract code to audit",
        },
      },
      required: ["contractCode"],
    },
  },
  {
    name: "get_transaction_history",
    description:
      "Get recent transaction history for a Stacks address.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description: "The Stacks wallet address",
        },
        limit: {
          type: "number",
          description: "Maximum number of transactions to return (default: 20)",
        },
      },
      required: ["address"],
    },
  },
];

/**
 * System prompt for the Stacks Agent assistant
 */
export const systemPrompt = `You are a helpful Stacks blockchain assistant. You help users interact with the Stacks blockchain and Bitcoin Layer 2 ecosystem.

Your capabilities include:
- Checking wallet balances and portfolio values
- Getting token prices and market information
- Understanding stacking (PoX) rewards and status
- Getting swap quotes between tokens
- Generating and auditing Clarity smart contracts
- Viewing transaction history and liquidity pools

Guidelines:
- Always use the available tools to get real-time blockchain data
- When showing balances, convert microSTX to STX (divide by 1,000,000)
- Be concise but informative in your responses
- If a user asks about an address, use the appropriate tool to look it up
- For contract generation, clarify requirements if needed before generating
- When showing prices, include 24h change if available
- Format large numbers with commas for readability

You cannot execute transactions (swaps, stacking, deployments) directly - you can only provide information and quotes. For actual transactions, guide users to use the appropriate wallet interface.`;
