import { z } from 'zod';
import { ClarityService } from '../../core/clarity.js';
import { ContractGenerationOptions } from '../../types/index.js';
import { WalletService } from '../../core/wallet.js';
import { coercedBoolean } from '../../utils/schema-helpers.js';

export const clarityTools = (clarityService: ClarityService, walletService: WalletService) => ({
  clarity_write_contract: {
    description:
      'Generates a new Clarity smart contract (.clar file) from natural language requirements. Supports common patterns like fungible tokens, NFTs, vaults, DAOs, and custom contracts. The generated contract will be saved to the contracts/ directory.',
    parameters: z.object({
      requirements: z
        .string()
        .describe(
          'Natural language description of what the contract should do. Examples: "Create a fungible token named MyToken with symbol MTK, 1000000 total supply and 6 decimals" or "Create an NFT collection called MyArt with symbol MART"'
        ),
      contractType: z
        .enum(['fungible-token', 'non-fungible-token', 'vault', 'dao', 'marketplace', 'custom'])
        .optional()
        .default('custom')
        .describe(
          'Type of contract to generate: fungible-token (SIP-010 token), non-fungible-token (SIP-009 NFT), vault (STX vault), dao (governance), marketplace (NFT marketplace), custom (minimal skeleton)'
        ),
      features: z
        .array(z.string())
        .optional()
        .describe(
          'Additional features to include (e.g., ["pausable", "mintable", "burnable"] for tokens)'
        ),
      includeTests: coercedBoolean(false).describe(
        'Generate test cases alongside contract (future feature)'
      ),
      includeComments: coercedBoolean(true).describe('Include detailed comments in generated code'),
    }),
    handler: async (args: {
      requirements: string;
      contractType?: 'fungible-token' | 'non-fungible-token' | 'vault' | 'dao' | 'marketplace' | 'custom';
      features?: string[];
      includeTests?: boolean;
      includeComments?: boolean;
    }) => {
      try {
        const options: ContractGenerationOptions = {
          contractType: args.contractType || 'custom',
          features: args.features,
          includeTests: args.includeTests,
          includeComments: args.includeComments ?? true,
        };

        const result = await clarityService.generateContract(args.requirements, options);

        return {
          success: true,
          contractName: result.name,
          contractCode: result.code,
          analysis: {
            syntaxValid: result.analysis?.syntaxValid,
            functionCount: result.analysis?.functions.length,
            dataVarCount: result.analysis?.dataVars.length,
            mapCount: result.analysis?.maps.length,
            complexity: result.analysis?.estimatedComplexity,
            traits: result.analysis?.traits,
            functions: result.analysis?.functions.map(f => ({
              name: f.name,
              type: f.type,
            })),
          },
          filePath: `contracts/${result.name}.clar`,
          message: `Contract '${result.name}' generated successfully. Review the code before deployment.`,
          nextSteps: [
            'Review the generated contract code carefully',
            'Run clarity_audit_contract to check for security issues',
            'Test the contract using Clarinet or similar tools',
            'Deploy to testnet for verification before mainnet',
          ],
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  clarity_audit_contract: {
    description:
      'Performs a comprehensive security audit of a Clarity smart contract. Checks for vulnerabilities, best practices, and optimization opportunities. Returns a detailed report with security score (0-100) and actionable recommendations.',
    parameters: z.object({
      contractCode: z
        .string()
        .describe('The Clarity contract code to audit (full .clar file content as a string)'),
      includeOptimizations: coercedBoolean(true).describe(
        'Include gas optimization suggestions in the report'
      ),
      severityThreshold: z
        .enum(['critical', 'high', 'medium', 'low', 'informational'])
        .optional()
        .default('low')
        .describe('Minimum severity level to report (filters out issues below this threshold)'),
    }),
    handler: async (args: {
      contractCode: string;
      includeOptimizations?: boolean;
      severityThreshold?: 'critical' | 'high' | 'medium' | 'low' | 'informational';
    }) => {
      try {
        const report = await clarityService.auditContract(args.contractCode);

        // Filter issues by severity threshold
        const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
        const thresholdIndex = severityOrder.indexOf(args.severityThreshold || 'low');

        const filteredSecurityIssues = report.securityIssues.filter(
          (issue) => severityOrder.indexOf(issue.severity) <= thresholdIndex
        );

        const filteredBestPractices = report.bestPracticeIssues.filter(
          (issue) => severityOrder.indexOf(issue.severity) <= thresholdIndex
        );

        // Determine status message
        let status: string;
        if (report.recommendation === 'approved') {
          status = 'Ready for deployment';
        } else if (report.recommendation === 'needs-review') {
          status = 'Review required before deployment';
        } else {
          status = 'CRITICAL: Do not deploy - security issues found';
        }

        return {
          success: true,
          contractName: report.contractName,
          auditDate: report.timestamp,
          summary: {
            totalIssues: report.summary.totalIssues,
            critical: report.summary.critical,
            high: report.summary.high,
            medium: report.summary.medium,
            low: report.summary.low,
            informational: report.summary.informational,
            score: report.score,
            recommendation: report.recommendation,
            status,
          },
          securityIssues: filteredSecurityIssues.map((issue) => ({
            severity: issue.severity,
            category: issue.category,
            title: issue.title,
            description: issue.description,
            location: issue.location,
            recommendation: issue.recommendation,
            cwe: issue.cwe,
          })),
          bestPractices: filteredBestPractices.map((issue) => ({
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            location: issue.location,
            recommendation: issue.recommendation,
          })),
          optimizations: args.includeOptimizations
            ? report.optimizationSuggestions.map((opt) => ({
                title: opt.title,
                description: opt.description,
                estimatedSavings: opt.estimatedGasSavings,
                location: opt.location,
              }))
            : [],
          message: `Audit completed. Score: ${report.score}/100. ${report.summary.totalIssues} issue(s) found.`,
          criticalActions:
            report.summary.critical > 0
              ? [
                  'DO NOT DEPLOY - Critical security vulnerabilities found',
                  'Review all critical issues immediately',
                  'Consider consulting a security expert',
                  'Re-audit after fixes are applied',
                ]
              : report.summary.high > 0
              ? [
                  'Review high-severity issues before deployment',
                  'Run additional testing',
                  'Consider a professional security audit for production',
                ]
              : report.score < 70
              ? [
                  'Address medium and low severity issues',
                  'Improve code quality and best practices',
                  'Re-audit after improvements',
                ]
              : [
                  'Contract passed audit with good score',
                  'Recommend testing on testnet',
                  'Consider professional audit for high-value contracts',
                ],
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  deploy_clarity_contract: {
    description:
      'Deploys a Clarity smart contract to the Stacks blockchain (testnet or mainnet). Requires an unlocked wallet. IMPORTANT: Always deploy to testnet first for testing before deploying to mainnet.',
    parameters: z.object({
      contractName: z
        .string()
        .describe(
          'Name for the deployed contract (must start with lowercase letter, contain only lowercase letters, numbers, and hyphens). Example: "my-token-v1"'
        ),
      contractCode: z
        .string()
        .describe('The complete Clarity contract code to deploy (full .clar file content as a string)'),
      network: z
        .enum(['testnet', 'mainnet'])
        .describe(
          'Target network for deployment. ALWAYS use "testnet" for testing first, only use "mainnet" for production after thorough testing.'
        ),
      confirmMainnet: coercedBoolean().describe(
        'Required confirmation for mainnet deployment. Must be true to deploy to mainnet. This is a safety check.'
      ),
    }),
    handler: async (args: {
      contractName: string;
      contractCode: string;
      network: 'testnet' | 'mainnet';
      confirmMainnet?: boolean;
    }) => {
      try {
        // Safety check for mainnet deployment
        if (args.network === 'mainnet' && !args.confirmMainnet) {
          return {
            success: false,
            error:
              'Mainnet deployment requires confirmMainnet: true. This is a safety check to prevent accidental mainnet deployments. Always test on testnet first!',
            recommendation: [
              'Deploy to testnet first for testing',
              'Verify contract functionality on testnet',
              'Run clarity_audit_contract to check for issues',
              'Only deploy to mainnet after thorough testing',
              'Set confirmMainnet: true to proceed with mainnet deployment',
            ],
          };
        }

        // Check if wallet is unlocked
        if (!walletService.isUnlocked()) {
          return {
            success: false,
            error: 'Wallet is locked. Please unlock your wallet first using wallet_unlock.',
            nextSteps: [
              'Use wallet_unlock tool to unlock your wallet',
              'Then retry the deployment',
            ],
          };
        }

        // Get private key from wallet service
        const privateKey = walletService.getPrivateKey();

        // Get the actual address that will be used for deployment (network-specific)
        const deployerAddress = walletService.getAddressForNetwork(args.network);

        // Get current config address for comparison
        const currentAddress = walletService.getAddress();

        // Warn user if deploying to different network than current config
        if (deployerAddress !== currentAddress) {
          console.error(
            `⚠️  NOTE: Deploying to ${args.network} using address ${deployerAddress} (current config uses ${currentAddress})`
          );
        }

        // Additional warning for mainnet
        if (args.network === 'mainnet') {
          console.error(
            '⚠️  WARNING: Deploying to MAINNET. This will use real STX for transaction fees!'
          );
        }

        // Deploy contract
        const result = await clarityService.deployContract(
          args.contractName,
          args.contractCode,
          privateKey,
          args.network
        );

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            deploymentAttempt: {
              network: args.network,
              deployerAddress: deployerAddress,
              contractName: args.contractName,
            },
            troubleshooting: [
              'Check that your contract has valid Clarity syntax',
              `Ensure ${deployerAddress} has enough STX on ${args.network} for transaction fees`,
              `For testnet: Get free STX from https://explorer.hiro.so/sandbox/faucet?chain=testnet`,
              'Verify the contract name is valid (lowercase, alphanumeric, hyphens only)',
              'Make sure you are connected to the correct network',
            ],
            hint: `Deployment will use ${args.network} address: ${deployerAddress}. Check this address has sufficient STX balance.`,
          };
        }

        return {
          success: true,
          txId: result.txId,
          contractId: result.contractId,
          network: args.network,
          deployerAddress: deployerAddress,
          explorerUrl: result.explorerUrl,
          message: `Contract '${args.contractName}' deployed successfully to ${args.network}!`,
          deploymentInfo: {
            network: args.network,
            deployerAddress: deployerAddress,
            contractName: args.contractName,
            contractId: result.contractId,
          },
          nextSteps: [
            `Monitor transaction status: ${result.explorerUrl}`,
            'Wait for transaction confirmation (typically 10-30 minutes)',
            `Contract will be available at: ${result.contractId}`,
            `Deployer address: ${deployerAddress}`,
            args.network === 'testnet'
              ? 'After testing on testnet, deploy to mainnet if everything works correctly'
              : 'Contract is now live on mainnet',
          ],
          estimatedConfirmationTime:
            'Transactions typically confirm in 10-30 minutes (depends on Bitcoin block time)',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },
});
