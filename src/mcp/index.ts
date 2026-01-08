#!/usr/bin/env node

/**
 * MCP Server Entry Point
 *
 * This is the stdio-based MCP server for Claude Desktop integration.
 * It uses services from the core module.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Import services from core
import { WalletService } from '../core/wallet.js';
import { PriceService } from '../core/price.js';
import { DexService } from '../core/dex.js';
import { StackingService } from '../core/stacking.js';
import { PortfolioService } from '../core/portfolio.js';
import { BnsService } from '../core/bns.js';
import { ClarityService } from '../core/clarity.js';
import { ZestService } from '../core/zest.js';
import { SwapService } from '../core/swap.js';
import { PythService } from '../core/pyth.js';
import { BoostService } from '../core/boost.js';
import { WalletMigration } from '../core/wallet-migration.js';
import { configManager } from '../utils/config.js';

// Import tool definitions
import { walletTools } from './tools/wallet-tools.js';
import { marketTools } from './tools/market-tools.js';
import { stackingAndPortfolioTools } from './tools/stacking-tools.js';
import { bnsTools } from './tools/bns-tools.js';
import { clarityTools } from './tools/clarity-tools.js';
import { zestTools } from './tools/zest-tools.js';
import { boostTools } from './tools/boost-tools.js';

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
  private zestService: ZestService;
  private swapService: SwapService;
  private pythService: PythService;
  private boostService: BoostService;
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

    // Initialize services from core
    const config = configManager.get();
    this.walletService = new WalletService();
    this.priceService = new PriceService();
    this.dexService = new DexService(config.network);
    this.stackingService = new StackingService(config.network);
    this.portfolioService = new PortfolioService(this.walletService, config.network);
    this.bnsService = new BnsService(config.network);
    this.clarityService = new ClarityService(config.network);
    this.zestService = new ZestService(config.network);
    this.swapService = new SwapService(config.network);
    this.pythService = new PythService();
    this.boostService = new BoostService(config.network);

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
    const market = marketTools(this.priceService, this.dexService, this.swapService, this.walletService);
    for (const [name, tool] of Object.entries(market)) {
      this.tools.set(name, tool);
    }

    // Stacking and portfolio tools
    const stacking = stackingAndPortfolioTools(
      this.stackingService,
      this.portfolioService,
      this.walletService,
      this.bnsService
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

    // Zest Protocol tools
    const zest = zestTools(this.zestService, this.pythService, this.walletService);
    for (const [name, tool] of Object.entries(zest)) {
      this.tools.set(name, tool);
    }

    // BoostBTC tools
    const boost = boostTools(this.boostService, this.walletService);
    for (const [name, tool] of Object.entries(boost)) {
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

    // Check and perform wallet migration if needed
    await this.checkMigration();

    // Create transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    console.error('Stacks MCP Server running on stdio');
  }

  /**
   * Check if wallet migration is needed and perform it
   */
  private async checkMigration(): Promise<void> {
    try {
      const migration = new WalletMigration(this.walletService);

      // Check if migration is needed
      const needsMigration = await migration.needsMigration();

      if (needsMigration) {
        console.error('='.repeat(80));
        console.error('WALLET MIGRATION REQUIRED');
        console.error('='.repeat(80));
        console.error('');
        console.error('Your wallet is being migrated to the new multi-wallet system...');
        console.error('');

        // Perform migration
        const result = await migration.migrate();

        if (result.success) {
          console.error('Migration completed successfully');
          console.error('');
          console.error(result.message);
          console.error('');

          if (result.requiresUserAction) {
            console.error('ACTION REQUIRED:');
            console.error('   You need to re-import your wallet using your 24-word mnemonic phrase.');
            console.error('   Use the wallet_import tool to import your wallet.');
            console.error('');
          }

          if (result.backupPath) {
            console.error(`   Legacy wallet backed up to: ${result.backupPath}`);
            console.error('');
          }
        } else {
          console.error('Migration failed:', result.message);
          console.error('');
          console.error('The server will continue, but you may need to manually migrate your wallet.');
          console.error('');
        }

        console.error('='.repeat(80));
        console.error('');
      } else {
        // Check migration status for informational purposes
        const status = await migration.getStatus();

        if (status.migrated) {
          console.error(`Wallet system: Multi-wallet (${status.walletsCount} wallet(s))`);
        } else if (status.walletsCount === 0) {
          console.error('No wallets found. Use wallet_create or wallet_import to get started.');
        }
      }
    } catch (error: any) {
      console.error('Warning: Failed to check wallet migration status:', error.message);
      // Continue server startup even if migration check fails
    }
  }
}

// Start the server
const server = new StacksMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
