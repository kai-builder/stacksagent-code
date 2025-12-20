#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { WalletService } from './services/wallet.js';
import { PriceService } from './services/price.js';
import { DexService } from './services/dex.js';
import { StackingService } from './services/stacking.js';
import { PortfolioService } from './services/portfolio.js';
import { BnsService } from './services/bns.js';
import { ClarityService } from './services/clarity.js';
import { configManager } from './utils/config.js';

import { walletTools } from './tools/wallet-tools.js';
import { marketTools } from './tools/market-tools.js';
import { stackingAndPortfolioTools } from './tools/stacking-tools.js';
import { bnsTools } from './tools/bns-tools.js';
import { clarityTools } from './tools/clarity-tools.js';

/**
 * Main MCP Server for Stacks blockchain operations
 */
class StacksMCPServer {
  private server: Server;
  private walletService: WalletService;
  private priceService: PriceService;
  private dexService: DexService;
  private stackingService: StackingService;
  private portfolioService: PortfolioService;
  private bnsService: BnsService;
  private clarityService: ClarityService;
  private tools: Map<string, any>;

  constructor() {
    // Initialize server
    this.server = new Server(
      {
        name: 'stacksagent-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize services
    const config = configManager.get();
    this.walletService = new WalletService();
    this.priceService = new PriceService();
    this.dexService = new DexService(config.network);
    this.stackingService = new StackingService(config.network);
    this.portfolioService = new PortfolioService(this.walletService, config.network);
    this.bnsService = new BnsService(config.network);
    this.clarityService = new ClarityService(config.network);

    // Initialize tools map
    this.tools = new Map();

    // Setup handlers
    this.setupHandlers();
    this.registerTools();
  }

  /**
   * Registers all available tools
   */
  private registerTools(): void {
    // Wallet tools
    const wallet = walletTools(this.walletService);
    for (const [name, tool] of Object.entries(wallet)) {
      this.tools.set(name, tool);
    }

    // Market and DEX tools
    const market = marketTools(this.priceService, this.dexService, this.walletService);
    for (const [name, tool] of Object.entries(market)) {
      this.tools.set(name, tool);
    }

    // Stacking and portfolio tools
    const stacking = stackingAndPortfolioTools(
      this.stackingService,
      this.portfolioService,
      this.walletService
    );
    for (const [name, tool] of Object.entries(stacking)) {
      this.tools.set(name, tool);
    }

    // BNS tools
    const bns = bnsTools(this.bnsService);
    for (const [name, tool] of Object.entries(bns)) {
      this.tools.set(name, tool);
    }

    // Clarity tools
    const clarity = clarityTools(this.clarityService, this.walletService);
    for (const [name, tool] of Object.entries(clarity)) {
      this.tools.set(name, tool);
    }
  }

  /**
   * Sets up MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [];

      for (const [name, tool] of this.tools.entries()) {
        tools.push({
          name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.parameters.shape,
            required: Object.keys(tool.parameters.shape).filter(
              (key) => !tool.parameters.shape[key].isOptional()
            ),
          },
        });
      }

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.get(name);
      if (!tool) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
        };
      }

      try {
        // Validate arguments
        const validatedArgs = tool.parameters.parse(args || {});

        // Execute tool
        const result = await tool.handler(validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message || 'Unknown error occurred',
              }, null, 2),
            },
          ],
        };
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Starts the MCP server
   */
  async start(): Promise<void> {
    // Load configuration
    await configManager.load();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    console.error('Stacks MCP Server running on stdio');
  }
}

// Start the server
const server = new StacksMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
