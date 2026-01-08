/**
 * Stacks Agent API Client
 * Handles all communication with the Stacks Agent HTTP API
 */

const STACKS_API_URL = process.env.STACKS_API_URL || "http://localhost:3001";

/**
 * Generic fetch wrapper with error handling
 */
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${STACKS_API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Unable to connect to Stacks API at ${STACKS_API_URL}`);
    }
    throw error;
  }
}

/**
 * Execute a tool call by name with given input
 */
export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    let result: unknown;

    switch (toolName) {
      case "get_wallet_balance": {
        const address = toolInput.address as string;
        result = await apiCall(`/api/wallet/balance/${encodeURIComponent(address)}`);
        break;
      }

      case "get_token_price": {
        const symbol = toolInput.symbol as string;
        result = await apiCall(`/api/price/${encodeURIComponent(symbol)}`);
        break;
      }

      case "get_stacking_info": {
        result = await apiCall("/api/stacking/info");
        break;
      }

      case "get_stacking_status": {
        const address = toolInput.address as string;
        result = await apiCall(`/api/stacking/status/${encodeURIComponent(address)}`);
        break;
      }

      case "get_swap_quote": {
        result = await apiCall("/api/dex/quote", {
          method: "POST",
          body: JSON.stringify({
            fromToken: toolInput.fromToken,
            toToken: toolInput.toToken,
            amount: toolInput.amount,
          }),
        });
        break;
      }

      case "get_portfolio": {
        const address = toolInput.address as string;
        result = await apiCall(`/api/portfolio/${encodeURIComponent(address)}`);
        break;
      }

      case "get_trending_tokens": {
        const params = new URLSearchParams();
        if (toolInput.limit) params.set("limit", String(toolInput.limit));
        if (toolInput.filter) params.set("filter", String(toolInput.filter));
        const query = params.toString() ? `?${params.toString()}` : "";
        result = await apiCall(`/api/price/trending/tokens${query}`);
        break;
      }

      case "get_liquidity_pools": {
        const params = new URLSearchParams();
        if (toolInput.protocol) params.set("protocol", String(toolInput.protocol));
        if (toolInput.limit) params.set("limit", String(toolInput.limit));
        const query = params.toString() ? `?${params.toString()}` : "";
        result = await apiCall(`/api/price/pools/list${query}`);
        break;
      }

      case "generate_contract": {
        result = await apiCall("/api/contract/generate", {
          method: "POST",
          body: JSON.stringify({
            requirements: toolInput.requirements,
            contractType: toolInput.contractType,
            features: toolInput.features || [],
          }),
        });
        break;
      }

      case "audit_contract": {
        result = await apiCall("/api/contract/audit", {
          method: "POST",
          body: JSON.stringify({
            contractCode: toolInput.contractCode,
          }),
        });
        break;
      }

      case "get_transaction_history": {
        const address = toolInput.address as string;
        const limit = toolInput.limit || 20;
        result = await apiCall(
          `/api/portfolio/${encodeURIComponent(address)}/transactions?limit=${limit}`
        );
        break;
      }

      default:
        return JSON.stringify({
          success: false,
          error: `Unknown tool: ${toolName}`,
        });
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Health check for the Stacks API
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${STACKS_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
