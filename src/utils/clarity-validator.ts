/**
 * Clarity contract validation utilities
 */

import { FunctionInfo, DataVarInfo, MapInfo, ParameterInfo } from '../types/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  line: number;
  column?: number;
  message: string;
  type: 'syntax' | 'semantic' | 'security';
}

export interface ValidationWarning {
  line: number;
  message: string;
  type: 'best-practice' | 'optimization';
}

/**
 * Validates Clarity syntax using basic pattern matching
 */
export function validateClaritySyntax(code: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic bracket matching
  const brackets = { '(': 0, ')': 0 };
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    for (const char of line) {
      if (char === '(') brackets['(']++;
      if (char === ')') brackets[')']++;
    }

    // Check for common syntax errors
    if (line.includes('define-public') && !line.includes('(define-public')) {
      errors.push({
        line: index + 1,
        message: 'define-public must be wrapped in parentheses',
        type: 'syntax',
      });
    }

    if (line.includes('define-private') && !line.includes('(define-private')) {
      errors.push({
        line: index + 1,
        message: 'define-private must be wrapped in parentheses',
        type: 'syntax',
      });
    }

    if (line.includes('define-read-only') && !line.includes('(define-read-only')) {
      errors.push({
        line: index + 1,
        message: 'define-read-only must be wrapped in parentheses',
        type: 'syntax',
      });
    }
  });

  // Check bracket balance
  if (brackets['('] !== brackets[')']) {
    errors.push({
      line: 0,
      message: `Unbalanced parentheses: ${brackets['(']} opening, ${brackets[')']} closing`,
      type: 'syntax',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extracts function definitions from contract
 */
export function extractFunctions(code: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Match public functions: (define-public (function-name (param type) ...) ...)
  const publicRegex = /\(define-public\s+\(([a-z][a-z0-9-]*)/g;
  let match;

  while ((match = publicRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      type: 'public',
      parameters: [],
      returnType: 'response',
    });
  }

  // Match private functions
  const privateRegex = /\(define-private\s+\(([a-z][a-z0-9-]*)/g;
  while ((match = privateRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      type: 'private',
      parameters: [],
      returnType: 'unknown',
    });
  }

  // Match read-only functions
  const readOnlyRegex = /\(define-read-only\s+\(([a-z][a-z0-9-]*)/g;
  while ((match = readOnlyRegex.exec(code)) !== null) {
    functions.push({
      name: match[1],
      type: 'read-only',
      parameters: [],
      returnType: 'response',
    });
  }

  return functions;
}

/**
 * Extracts data variable definitions
 */
export function extractDataVars(code: string): DataVarInfo[] {
  const dataVars: DataVarInfo[] = [];
  const dataVarRegex = /\(define-data-var\s+([a-z][a-z0-9-]*)\s+([^\s)]+)\s+([^)]+)\)/g;
  let match;

  while ((match = dataVarRegex.exec(code)) !== null) {
    dataVars.push({
      name: match[1],
      type: match[2],
      initialValue: match[3].trim(),
    });
  }

  return dataVars;
}

/**
 * Extracts map definitions
 */
export function extractMaps(code: string): MapInfo[] {
  const maps: MapInfo[] = [];
  const mapRegex = /\(define-map\s+([a-z][a-z0-9-]*)\s+([^\s]+)\s+([^)]+)\)/g;
  let match;

  while ((match = mapRegex.exec(code)) !== null) {
    maps.push({
      name: match[1],
      keyType: match[2],
      valueType: match[3].trim(),
    });
  }

  return maps;
}

/**
 * Extracts trait implementations
 */
export function extractTraits(code: string): string[] {
  const traits: string[] = [];
  const traitRegex = /\(impl-trait\s+['"]?([^'")\s]+)['"]?\)/g;
  let match;

  while ((match = traitRegex.exec(code)) !== null) {
    traits.push(match[1]);
  }

  return traits;
}

/**
 * Extracts contract dependencies
 */
export function extractDependencies(code: string): string[] {
  const dependencies: string[] = [];
  const contractCallRegex = /\(contract-call\?\s+['"]?([^'")\s]+)['"]?/g;
  let match;

  while ((match = contractCallRegex.exec(code)) !== null) {
    if (!dependencies.includes(match[1])) {
      dependencies.push(match[1]);
    }
  }

  return dependencies;
}

/**
 * Checks for common security patterns
 */
export function checkSecurityPatterns(code: string): any[] {
  const issues: any[] = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    // Check for stx-transfer without proper validation
    if (line.includes('stx-transfer?') && !code.includes('asserts!')) {
      issues.push({
        type: 'security',
        severity: 'high',
        line: index + 1,
        message: 'STX transfer detected without asserts! validation in contract',
        category: 'Missing Validation',
      });
    }

    // Check for unwrap! without error handling
    if (line.includes('unwrap!') && !line.includes('try!')) {
      issues.push({
        type: 'security',
        severity: 'medium',
        line: index + 1,
        message: 'unwrap! used without try! - can cause transaction to abort',
        category: 'Error Handling',
      });
    }

    // Check for contract-call? without proper checks
    if (line.includes('contract-call?') && !code.includes('asserts!')) {
      issues.push({
        type: 'security',
        severity: 'medium',
        line: index + 1,
        message: 'External contract call without validation',
        category: 'External Calls',
      });
    }
  });

  return issues;
}

/**
 * Checks for naming convention compliance
 */
export function checkNamingConventions(code: string): any[] {
  const issues: any[] = [];
  const functions = extractFunctions(code);

  functions.forEach((func) => {
    // Check for camelCase or PascalCase (should be kebab-case)
    if (/[A-Z]/.test(func.name) || /_/.test(func.name)) {
      issues.push({
        type: 'best-practice',
        severity: 'low',
        message: `Function "${func.name}" should use kebab-case naming`,
        category: 'Naming Conventions',
      });
    }
  });

  return issues;
}

/**
 * Checks for missing access control
 */
export function checkAccessControl(code: string, functions: FunctionInfo[]): any[] {
  const issues: any[] = [];

  functions.forEach((func) => {
    if (func.type === 'public') {
      // Extract function body
      const funcRegex = new RegExp(`\\(define-public\\s+\\(${func.name}[^)]*\\)([\\s\\S]*?)(?=\\n\\(define-|$)`, 'm');
      const match = code.match(funcRegex);

      if (match) {
        const funcBody = match[1];

        // Check if function modifies state without checking tx-sender
        const hasStateChange = /\b(map-set|map-delete|var-set|ft-mint|ft-burn|nft-mint|nft-burn)\b/.test(funcBody);
        const hasAccessCheck = /\b(is-eq\s+tx-sender|asserts!.*tx-sender)\b/.test(funcBody);

        if (hasStateChange && !hasAccessCheck) {
          issues.push({
            type: 'security',
            severity: 'high',
            function: func.name,
            message: `Public function "${func.name}" modifies state without checking tx-sender`,
            category: 'Access Control',
          });
        }
      }
    }
  });

  return issues;
}

/**
 * Estimates contract complexity
 */
export function estimateComplexity(
  functions: FunctionInfo[],
  dataVars: DataVarInfo[],
  maps: MapInfo[]
): 'low' | 'medium' | 'high' {
  const score = functions.length * 2 + dataVars.length + maps.length * 1.5;

  if (score < 10) return 'low';
  if (score < 25) return 'medium';
  return 'high';
}

/**
 * Extracts contract name from code
 */
export function extractContractName(code: string): string {
  // Try to extract from comment header
  const commentMatch = code.match(/^;;?\s*(.+?)(?:\s*-|$)/m);
  if (commentMatch) {
    return commentMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
  }

  // Fallback to generic name
  return 'unnamed-contract';
}

/**
 * Validates that trait addresses match the target network
 * Returns array of mismatched trait addresses
 */
export function validateTraitAddresses(
  code: string,
  targetNetwork: 'mainnet' | 'testnet'
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Known trait addresses
  const MAINNET_TRAITS = [
    'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', // SIP-010 FT
    'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', // SIP-009 NFT
  ];

  const TESTNET_TRAITS = [
    'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18', // SIP-010 FT
    'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT', // SIP-009 NFT
  ];

  // Extract all trait implementations
  const traitRegex = /\((?:impl-trait|use-trait)\s+[a-z-]+\s+['"]?([^'")\s]+)['"]?\)/g;
  let match;

  while ((match = traitRegex.exec(code)) !== null) {
    const traitAddress = match[1];

    // Extract the principal (contract deployer address) from trait reference
    // Format: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait
    const principalMatch = traitAddress.match(/^([A-Z0-9]+)\./);
    if (principalMatch) {
      const principal = principalMatch[1];

      // Check if it's a known trait address
      const isMainnetTrait = MAINNET_TRAITS.includes(principal);
      const isTestnetTrait = TESTNET_TRAITS.includes(principal);

      if (isMainnetTrait || isTestnetTrait) {
        // Verify it matches the target network
        if (targetNetwork === 'mainnet' && isTestnetTrait) {
          errors.push(
            `Testnet trait address detected: ${principal}\n` +
            `  Contract is deploying to MAINNET but uses testnet trait: ${traitAddress}\n` +
            `  Expected mainnet trait starting with: ${MAINNET_TRAITS.join(' or ')}`
          );
        } else if (targetNetwork === 'testnet' && isMainnetTrait) {
          errors.push(
            `Mainnet trait address detected: ${principal}\n` +
            `  Contract is deploying to TESTNET but uses mainnet trait: ${traitAddress}\n` +
            `  Expected testnet trait starting with: ${TESTNET_TRAITS.join(' or ')}`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks for redundant operations
 */
export function findRedundantOperations(code: string): any[] {
  const suggestions: any[] = [];
  const lines = code.split('\n');

  // Track map-get calls
  const mapGetCalls = new Map<string, number[]>();

  lines.forEach((line, index) => {
    const mapGetMatch = line.match(/map-get\?\s+([a-z][a-z0-9-]*)/);
    if (mapGetMatch) {
      const mapName = mapGetMatch[1];
      if (!mapGetCalls.has(mapName)) {
        mapGetCalls.set(mapName, []);
      }
      mapGetCalls.get(mapName)!.push(index + 1);
    }
  });

  // Report if same map is accessed multiple times in nearby lines
  mapGetCalls.forEach((lineNumbers, mapName) => {
    if (lineNumbers.length > 2) {
      const sorted = lineNumbers.sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] < 5) {
          suggestions.push({
            title: 'Redundant map-get calls',
            description: `Map "${mapName}" is accessed multiple times in nearby lines. Consider storing the result in a let binding.`,
            estimatedGasSavings: 'Low',
            location: { line: sorted[i] },
          });
          break;
        }
      }
    }
  });

  return suggestions;
}
