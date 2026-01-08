#!/usr/bin/env node

/**
 * HTTP API Entry Point
 *
 * This is the Express-based HTTP API server for web application integration.
 * It uses the same core services as the MCP server.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

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
import { configManager } from '../utils/config.js';

// Import routes
import { createContractRoutes } from './routes/contract.js';
import { createDexRoutes } from './routes/dex.js';
import { createWalletRoutes } from './routes/wallet.js';
import { createStackingRoutes } from './routes/stacking.js';
import { createPriceRoutes } from './routes/price.js';
import { createPortfolioRoutes } from './routes/portfolio.js';

/**
 * Services container for dependency injection
 */
export interface ApiServices {
  wallet: WalletService;
  price: PriceService;
  dex: DexService;
  stacking: StackingService;
  portfolio: PortfolioService;
  bns: BnsService;
  clarity: ClarityService;
  zest: ZestService;
  swap: SwapService;
  pyth: PythService;
  boost: BoostService;
}

/**
 * Creates and configures the Express application
 */
function createApp(services: ApiServices): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // API info endpoint
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      name: 'Stacks Agent API',
      version: '1.0.0',
      endpoints: {
        contract: '/api/contract',
        dex: '/api/dex',
        wallet: '/api/wallet',
        stacking: '/api/stacking',
        price: '/api/price',
        portfolio: '/api/portfolio',
      },
    });
  });

  // Mount routes
  app.use('/api/contract', createContractRoutes(services.clarity, services.wallet));
  app.use('/api/dex', createDexRoutes(services.dex, services.swap, services.wallet));
  app.use('/api/wallet', createWalletRoutes(services.wallet));
  app.use('/api/stacking', createStackingRoutes(services.stacking, services.wallet));
  app.use('/api/price', createPriceRoutes(services.price));
  app.use('/api/portfolio', createPortfolioRoutes(services.portfolio, services.wallet, services.bns));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

/**
 * Main function to start the API server
 */
async function main(): Promise<void> {
  // Load configuration
  await configManager.load();
  const config = configManager.get();

  // Initialize services
  const services: ApiServices = {
    wallet: new WalletService(),
    price: new PriceService(),
    dex: new DexService(config.network),
    stacking: new StackingService(config.network),
    portfolio: new PortfolioService(new WalletService(), config.network),
    bns: new BnsService(config.network),
    clarity: new ClarityService(config.network),
    zest: new ZestService(config.network),
    swap: new SwapService(config.network),
    pyth: new PythService(),
    boost: new BoostService(config.network),
  };

  // Create and start app
  const app = createApp(services);
  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`Stacks Agent API running on port ${PORT}`);
    console.log(`Network: ${config.network}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API info: http://localhost:${PORT}/api`);
  });
}

// Start the server
main().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});

export { createApp };
