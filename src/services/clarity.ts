import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  ClarityContract,
  ContractAnalysis,
  AuditReport,
  SecurityIssue,
  BestPracticeIssue,
  OptimizationSuggestion,
  ContractGenerationOptions,
} from '../types/index.js';
import { TEMPLATES, fillTemplate, getDefaultPlaceholders } from '../utils/clarity-templates.js';
import {
  validateClaritySyntax,
  extractFunctions,
  extractDataVars,
  extractMaps,
  extractTraits,
  extractDependencies,
  checkSecurityPatterns,
  checkNamingConventions,
  checkAccessControl,
  estimateComplexity,
  extractContractName,
  findRedundantOperations,
} from '../utils/clarity-validator.js';
import { makeContractDeploy, broadcastTransaction, AnchorMode } from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import { STACKS_MAINNET_API, STACKS_TESTNET_API } from '../utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ExampleContract {
  name: string;
  code: string;
  keywords: string[];
  patterns: string[];
}

interface ClarityDocumentation {
  sections: Map<string, string>;
  patterns: Map<string, string>;
  bestPractices: string[];
}

/**
 * Service for Clarity smart contract generation and auditing
 */
export class ClarityService {
  private network: 'mainnet' | 'testnet';
  private docsPath: string;
  private contractsPath: string;
  private examplesCache: ExampleContract[] | null = null;
  private documentationCache: ClarityDocumentation | null = null;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    this.docsPath = join(__dirname, '../../docs/clarity');
    this.contractsPath = join(__dirname, '../../contracts');
  }

  /**
   * Generates a Clarity contract from natural language requirements
   */
  async generateContract(
    requirements: string,
    options: ContractGenerationOptions
  ): Promise<ClarityContract> {
    try {
      // Load examples and documentation for context
      await this.loadExamplesAndDocs();

      // Find relevant examples based on requirements
      const relevantExamples = this.findRelevantExamples(requirements, options.contractType);

      // Get template for contract type
      const template = TEMPLATES[options.contractType];
      if (!template) {
        throw new Error(`Unknown contract type: ${options.contractType}`);
      }

      // Get default placeholder values
      const defaultValues = getDefaultPlaceholders(options.contractType);

      // Parse requirements to extract custom values
      const customValues = this.parseRequirementsForPlaceholders(requirements, template.placeholders);

      // Add network-specific trait addresses
      const networkTraitAddresses = this.getNetworkTraitAddresses();

      // Merge default, custom values, and network-specific addresses
      const placeholderValues = { ...defaultValues, ...customValues, ...networkTraitAddresses };

      // Generate contract code from template
      let contractCode = fillTemplate(template, placeholderValues);

      // Enhance with patterns from relevant examples
      if (relevantExamples.length > 0) {
        contractCode = this.enhanceWithExamplePatterns(contractCode, relevantExamples, requirements);
      }

      // Add additional features if requested
      if (options.features && options.features.length > 0) {
        contractCode = this.addFeatures(contractCode, options.features, options.contractType);
      }

      // Remove comments if requested
      if (options.includeComments === false) {
        contractCode = this.removeComments(contractCode);
      }

      // Analyze the generated contract
      const analysis = await this.analyzeContract(contractCode);

      if (!analysis.syntaxValid) {
        throw new Error('Generated contract has syntax errors. Please refine requirements.');
      }

      // Save contract to file
      const contractName = this.extractContractNameFromCode(contractCode);
      await this.saveContract(contractName, contractCode);

      return {
        name: contractName,
        code: contractCode,
        analysis,
      };
    } catch (error: any) {
      throw new Error(`Contract generation failed: ${error.message}`);
    }
  }

  /**
   * Audits a Clarity contract for security vulnerabilities and best practices
   */
  async auditContract(contractCode: string): Promise<AuditReport> {
    try {
      // Load examples and documentation for context
      await this.loadExamplesAndDocs();

      // Analyze contract structure
      const analysis = await this.analyzeContract(contractCode);

      // Run security checks (enhanced with documentation)
      const securityIssues = this.runSecurityChecks(contractCode, analysis);

      // Check best practices (enhanced with documentation)
      const bestPracticeIssues = this.checkBestPractices(contractCode, analysis);

      // Generate optimization suggestions (compare with examples)
      const optimizations = this.generateOptimizations(contractCode, analysis);

      // Compare with similar examples for additional insights
      const comparisonIssues = await this.compareWithExamples(contractCode, analysis);
      securityIssues.push(...comparisonIssues.security);
      bestPracticeIssues.push(...comparisonIssues.bestPractices);

      // Calculate summary and score
      const summary = this.calculateSummary(securityIssues, bestPracticeIssues);
      const score = this.calculateScore(summary);
      const recommendation = this.getRecommendation(score, summary);

      return {
        contractName: extractContractName(contractCode),
        timestamp: new Date().toISOString(),
        summary,
        securityIssues,
        bestPracticeIssues,
        optimizationSuggestions: optimizations,
        score,
        recommendation,
      };
    } catch (error: any) {
      throw new Error(`Contract audit failed: ${error.message}`);
    }
  }

  /**
   * Analyzes contract structure and syntax
   */
  private async analyzeContract(contractCode: string): Promise<ContractAnalysis> {
    const functions = extractFunctions(contractCode);
    const dataVars = extractDataVars(contractCode);
    const maps = extractMaps(contractCode);
    const traits = extractTraits(contractCode);
    const dependencies = extractDependencies(contractCode);

    // Validate syntax
    const validation = validateClaritySyntax(contractCode);
    const syntaxValid = validation.valid;

    // Estimate complexity
    const estimatedComplexity = estimateComplexity(functions, dataVars, maps);

    return {
      syntaxValid,
      functions,
      dataVars,
      maps,
      traits,
      dependencies,
      estimatedComplexity,
    };
  }

  /**
   * Parses requirements to extract placeholder values
   */
  private parseRequirementsForPlaceholders(
    requirements: string,
    placeholders: string[]
  ): Record<string, string> {
    const values: Record<string, string> = {};

    // Extract token name
    if (placeholders.includes('TOKEN_NAME')) {
      const nameMatch = requirements.match(/(?:token|coin)\s+(?:named|called)\s+["']?([^"'\n,]+)["']?/i);
      if (nameMatch) {
        values.TOKEN_NAME = nameMatch[1].trim();
      }
    }

    // Extract token symbol
    if (placeholders.includes('TOKEN_SYMBOL')) {
      const symbolMatch = requirements.match(/symbol\s+["']?([A-Z]{2,6})["']?/i);
      if (symbolMatch) {
        values.TOKEN_SYMBOL = symbolMatch[1].toUpperCase();
      } else if (values.TOKEN_NAME) {
        // Generate symbol from name
        values.TOKEN_SYMBOL = values.TOKEN_NAME
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 6);
      }
    }

    // Extract total supply
    if (placeholders.includes('TOTAL_SUPPLY')) {
      const supplyMatch = requirements.match(/supply\s+(?:of\s+)?(\d+(?:,\d+)*)/i);
      if (supplyMatch) {
        values.TOTAL_SUPPLY = supplyMatch[1].replace(/,/g, '');
      }
    }

    // Extract decimals
    if (placeholders.includes('DECIMALS')) {
      const decimalsMatch = requirements.match(/(\d+)\s+decimals?/i);
      if (decimalsMatch) {
        values.DECIMALS = decimalsMatch[1];
      }
    }

    // Extract NFT name
    if (placeholders.includes('NFT_NAME')) {
      const nftMatch = requirements.match(/(?:nft|collection)\s+(?:named|called)\s+["']?([^"'\n,]+)["']?/i);
      if (nftMatch) {
        values.NFT_NAME = nftMatch[1].trim();
      }
    }

    // Extract NFT symbol
    if (placeholders.includes('NFT_SYMBOL')) {
      const nftSymbolMatch = requirements.match(/symbol\s+["']?([A-Z]{2,6})["']?/i);
      if (nftSymbolMatch) {
        values.NFT_SYMBOL = nftSymbolMatch[1].toUpperCase();
      } else if (values.NFT_NAME) {
        values.NFT_SYMBOL = values.NFT_NAME
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 6);
      }
    }

    // Extract base URI
    if (placeholders.includes('BASE_URI')) {
      const uriMatch = requirements.match(/(?:uri|url):\s*["']?([^"'\n]+)["']?/i);
      if (uriMatch) {
        values.BASE_URI = uriMatch[1].trim();
      }
    }

    // Extract contract name for custom contracts
    if (placeholders.includes('CONTRACT_NAME')) {
      const contractMatch = requirements.match(/contract\s+(?:named|called)\s+["']?([^"'\n,]+)["']?/i);
      if (contractMatch) {
        values.CONTRACT_NAME = contractMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      }
    }

    return values;
  }

  /**
   * Adds additional features to contract
   */
  private addFeatures(code: string, features: string[], contractType: string): string {
    let modifiedCode = code;

    features.forEach((feature) => {
      const featureLower = feature.toLowerCase();

      if (featureLower === 'pausable' && contractType === 'fungible-token') {
        modifiedCode = this.addPausableFeature(modifiedCode);
      } else if (featureLower === 'burnable' && contractType === 'fungible-token') {
        modifiedCode = this.addBurnableFeature(modifiedCode);
      } else if (featureLower === 'mintable' && contractType === 'fungible-token') {
        modifiedCode = this.addMintableFeature(modifiedCode);
      }
    });

    return modifiedCode;
  }

  /**
   * Adds pausable feature to contract
   */
  private addPausableFeature(code: string): string {
    const pausableCode = `
;; Pausable feature
(define-data-var contract-paused bool false)

(define-public (pause)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set contract-paused true))))

(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ok (var-set contract-paused false))))

(define-read-only (is-paused)
  (var-get contract-paused))
`;

    // Insert after constants
    const constantsEnd = code.indexOf(';; Token definitions');
    if (constantsEnd !== -1) {
      return code.slice(0, constantsEnd) + pausableCode + '\n' + code.slice(constantsEnd);
    }
    return code;
  }

  /**
   * Adds burnable feature to contract
   */
  private addBurnableFeature(code: string): string {
    const burnableCode = `
;; Burn function
(define-public (burn (amount uint))
  (begin
    (asserts! (> amount u0) (err u200))
    (ft-burn? token-symbol amount tx-sender)))
`;

    // Append before the last closing bracket
    return code.trim() + '\n' + burnableCode + '\n';
  }

  /**
   * Adds mintable feature to contract
   */
  private addMintableFeature(code: string): string {
    const mintableCode = `
;; Mint function (owner only)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> amount u0) (err u201))
    (ft-mint? token-symbol amount recipient)))
`;

    return code.trim() + '\n' + mintableCode + '\n';
  }

  /**
   * Removes comments from contract
   */
  private removeComments(code: string): string {
    return code
      .split('\n')
      .filter((line) => !line.trim().startsWith(';;'))
      .join('\n');
  }

  /**
   * Extracts contract name from generated code
   */
  private extractContractNameFromCode(code: string): string {
    return extractContractName(code);
  }

  /**
   * Gets network-specific trait addresses for contract templates
   * SIP-010 (Fungible Token) and SIP-009 (NFT) trait addresses differ between networks
   */
  private getNetworkTraitAddresses(): Record<string, string> {
    if (this.network === 'mainnet') {
      return {
        TRAIT_ADDRESS: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        NFT_TRAIT_ADDRESS: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9',
      };
    } else {
      // testnet
      return {
        TRAIT_ADDRESS: 'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18',
        NFT_TRAIT_ADDRESS: 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT',
      };
    }
  }

  /**
   * Loads all example contracts and documentation (cached)
   */
  private async loadExamplesAndDocs(): Promise<void> {
    if (this.examplesCache && this.documentationCache) {
      return; // Already loaded
    }

    // Load example contracts
    const examplesDir = join(this.docsPath, 'examples');
    try {
      const files = await fs.readdir(examplesDir);
      const clarFiles = files.filter(f => f.endsWith('.clar'));

      this.examplesCache = await Promise.all(
        clarFiles.map(async (file) => {
          const code = await fs.readFile(join(examplesDir, file), 'utf-8');
          const name = file.replace('.clar', '');
          return {
            name,
            code,
            keywords: this.extractKeywords(name, code),
            patterns: this.extractPatterns(code),
          };
        })
      );
    } catch (error) {
      this.examplesCache = [];
    }

    // Load Clarity.md documentation
    try {
      const clarityMdPath = join(this.docsPath, 'Clarity.md');
      const docContent = await fs.readFile(clarityMdPath, 'utf-8');
      this.documentationCache = this.parseDocumentation(docContent);
    } catch (error) {
      this.documentationCache = {
        sections: new Map(),
        patterns: new Map(),
        bestPractices: [],
      };
    }
  }

  /**
   * Extracts keywords from contract name and code
   */
  private extractKeywords(name: string, code: string): string[] {
    const keywords: string[] = [];

    // Add name components
    keywords.push(...name.toLowerCase().split(/[-_]/));

    // Extract from comments
    const commentLines = code.split('\n').filter(line => line.trim().startsWith(';;'));
    commentLines.forEach(line => {
      const words = line.replace(/^;;/, '').toLowerCase().split(/\s+/);
      keywords.push(...words.filter(w => w.length > 3));
    });

    // Detect patterns
    if (code.includes('define-fungible-token')) keywords.push('token', 'fungible', 'sip-010');
    if (code.includes('define-non-fungible-token')) keywords.push('nft', 'non-fungible', 'sip-009');
    if (code.includes('lottery') || code.includes('random')) keywords.push('lottery', 'random', 'vrf');
    if (code.includes('presale') || code.includes('crowdfund')) keywords.push('presale', 'crowdfunding', 'ico');
    if (code.includes('swap') || code.includes('amm')) keywords.push('swap', 'dex', 'amm', 'liquidity');
    if (code.includes('staking') || code.includes('stake')) keywords.push('staking', 'rewards');
    if (code.includes('dao') || code.includes('proposal') || code.includes('vote')) keywords.push('dao', 'governance', 'voting');
    if (code.includes('marketplace') || code.includes('listing')) keywords.push('marketplace', 'listing', 'buy', 'sell');
    if (code.includes('oracle') || code.includes('pyth')) keywords.push('oracle', 'price', 'feed');
    if (code.includes('vault') || code.includes('deposit') || code.includes('withdraw')) keywords.push('vault', 'deposit', 'withdraw');

    return [...new Set(keywords)];
  }

  /**
   * Extracts common patterns from contract code
   */
  private extractPatterns(code: string): string[] {
    const patterns: string[] = [];

    if (/asserts!.*tx-sender/.test(code)) patterns.push('access-control');
    if (/burn-block-height/.test(code)) patterns.push('time-gating');
    if (/map-get\?.*map-set/.test(code)) patterns.push('state-management');
    if (/stx-transfer\?/.test(code)) patterns.push('stx-transfers');
    if (/ft-transfer\?/.test(code)) patterns.push('token-transfers');
    if (/contract-call\?/.test(code)) patterns.push('external-calls');
    if (/as-contract/.test(code)) patterns.push('contract-principal');
    if (/define-trait|impl-trait/.test(code)) patterns.push('traits');
    if (/fold|map|filter/.test(code)) patterns.push('list-operations');
    if (/match.*unwrap/.test(code)) patterns.push('error-handling');

    return patterns;
  }

  /**
   * Parses Clarity.md documentation into searchable sections
   */
  private parseDocumentation(content: string): ClarityDocumentation {
    const sections = new Map<string, string>();
    const patterns = new Map<string, string>();
    const bestPractices: string[] = [];

    // Split by markdown headers
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    lines.forEach(line => {
      if (line.startsWith('##')) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections.set(currentSection.toLowerCase(), currentContent.join('\n'));
        }
        // Start new section
        currentSection = line.replace(/^#+\s*/, '').trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    });

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections.set(currentSection.toLowerCase(), currentContent.join('\n'));
    }

    // Extract patterns (code blocks with clarity syntax)
    const codeBlockRegex = /```clarity\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const codeSnippet = match[1];
      const patternName = this.detectPatternType(codeSnippet);
      if (patternName) {
        patterns.set(patternName, codeSnippet);
      }
    }

    // Extract best practices from specific sections
    const bestPracticesSection = sections.get('security best practices') ||
                                  sections.get('best practices') ||
                                  sections.get('critical gotchas & best practices') || '';

    if (bestPracticesSection) {
      const practiceLines = bestPracticesSection.split('\n').filter(line =>
        line.trim().startsWith('-') || line.trim().startsWith('*')
      );
      bestPractices.push(...practiceLines);
    }

    return { sections, patterns, bestPractices };
  }

  /**
   * Detects pattern type from code snippet
   */
  private detectPatternType(code: string): string | null {
    if (/define-public.*transfer/.test(code)) return 'transfer-pattern';
    if (/asserts!.*tx-sender/.test(code)) return 'authorization-check';
    if (/stx-transfer\?/.test(code)) return 'stx-transfer-pattern';
    if (/burn-block-height/.test(code)) return 'time-check';
    if (/map-get\?.*default-to/.test(code)) return 'safe-map-read';
    if (/try!|unwrap!/.test(code)) return 'error-handling';
    if (/as-contract/.test(code)) return 'contract-principal';
    if (/fold|map/.test(code)) return 'list-processing';
    return null;
  }

  /**
   * Finds relevant examples based on requirements and contract type
   */
  private findRelevantExamples(requirements: string, contractType: string): ExampleContract[] {
    if (!this.examplesCache) return [];

    const reqLower = requirements.toLowerCase();
    const relevantExamples: Array<{ example: ExampleContract; score: number }> = [];

    this.examplesCache.forEach(example => {
      let score = 0;

      // Match contract type
      if (contractType !== 'custom') {
        if (example.keywords.includes(contractType.replace('-', ''))) score += 10;
      }

      // Match keywords from requirements
      example.keywords.forEach(keyword => {
        if (reqLower.includes(keyword)) score += 5;
      });

      // Bonus for specific patterns mentioned in requirements
      if (reqLower.includes('lottery') && example.name.includes('lottery')) score += 15;
      if (reqLower.includes('presale') && example.name.includes('presale')) score += 15;
      if (reqLower.includes('swap') && example.name.includes('swap')) score += 15;
      if (reqLower.includes('staking') && example.name.includes('staking')) score += 15;
      if (reqLower.includes('dao') && (example.name.includes('dao') || example.keywords.includes('governance'))) score += 15;
      if (reqLower.includes('oracle') && example.name.includes('oracle')) score += 15;
      if (reqLower.includes('amm') && example.name.includes('amm')) score += 15;

      if (score > 0) {
        relevantExamples.push({ example, score });
      }
    });

    // Sort by score and return top 3
    return relevantExamples
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(r => r.example);
  }

  /**
   * Enhances generated contract with patterns from relevant examples
   */
  private enhanceWithExamplePatterns(
    contractCode: string,
    examples: ExampleContract[],
    requirements: string
  ): string {
    // This is a placeholder for pattern enhancement
    // In a full implementation, this would:
    // 1. Identify missing patterns from examples
    // 2. Extract relevant functions/patterns
    // 3. Integrate them into the generated contract

    // For now, we return the original code
    // The real value is in the audit comparison
    return contractCode;
  }

  /**
   * Compares contract with examples to find issues
   */
  private async compareWithExamples(
    contractCode: string,
    analysis: ContractAnalysis
  ): Promise<{ security: SecurityIssue[]; bestPractices: BestPracticeIssue[] }> {
    const security: SecurityIssue[] = [];
    const bestPractices: BestPracticeIssue[] = [];

    if (!this.examplesCache || !this.documentationCache) {
      return { security, bestPractices };
    }

    // Check for patterns from documentation that are missing
    const docPatterns = this.documentationCache.patterns;

    // Check if contract has proper authorization pattern
    if (analysis.functions.some(f => f.type === 'public')) {
      const hasAuthPattern = /asserts!.*is-eq.*tx-sender/.test(contractCode);
      const authPattern = docPatterns.get('authorization-check');

      if (!hasAuthPattern && authPattern) {
        bestPractices.push({
          severity: 'medium',
          title: 'Consider adding authorization checks',
          description: 'Public functions that modify state should validate tx-sender. See Clarity.md for authorization pattern.',
          location: {},
          recommendation: 'Add authorization checks like: (asserts! (is-eq tx-sender contract-owner) err-owner-only)',
        });
      }
    }

    // Check for time-gating pattern if contract might need it
    if (contractCode.includes('block-height') && !contractCode.includes('burn-block-height')) {
      bestPractices.push({
        severity: 'low',
        title: 'Use burn-block-height for timing',
        description: 'Clarity.md recommends using burn-block-height (Bitcoin blocks) for timing instead of stacks-block-height',
        location: {},
        recommendation: 'Replace block-height checks with burn-block-height for more reliable timing',
      });
    }

    // Check error handling patterns
    if (contractCode.includes('unwrap-panic')) {
      security.push({
        severity: 'medium',
        category: 'Error Handling',
        title: 'Avoid unwrap-panic in production',
        description: 'unwrap-panic should not be used in production contracts. Use try! or unwrap! instead.',
        location: {},
        recommendation: 'Replace unwrap-panic with proper error handling using try! or unwrap! with error codes',
        cwe: 'CWE-703',
      });
    }

    return { security, bestPractices };
  }

  /**
   * Runs comprehensive security checks
   */
  private runSecurityChecks(contractCode: string, analysis: ContractAnalysis): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Check 1: Security patterns from validator
    const patternIssues = checkSecurityPatterns(contractCode);
    issues.push(
      ...patternIssues.map((issue: any) => ({
        severity: issue.severity,
        category: issue.category,
        title: issue.message,
        description: issue.message,
        location: { line: issue.line },
        recommendation: this.getSecurityRecommendation(issue.category),
        cwe: this.getCWE(issue.category),
      }))
    );

    // Check 2: Access control issues
    const accessIssues = checkAccessControl(contractCode, analysis.functions);
    issues.push(
      ...accessIssues.map((issue: any) => ({
        severity: issue.severity,
        category: issue.category,
        title: issue.message,
        description: issue.message,
        location: { function: issue.function },
        recommendation: 'Add tx-sender validation using asserts! before modifying state',
        cwe: 'CWE-284',
      }))
    );

    // Check 3: Input validation on public functions
    analysis.functions.forEach((func) => {
      if (func.type === 'public') {
        const funcRegex = new RegExp(`\\(define-public\\s+\\(${func.name}[\\s\\S]*?\\)\\s*\\)`, 'm');
        const match = contractCode.match(funcRegex);

        if (match && match[0]) {
          const hasInputValidation = /asserts!/.test(match[0]);
          if (!hasInputValidation) {
            issues.push({
              severity: 'medium',
              category: 'Input Validation',
              title: `Missing input validation in function "${func.name}"`,
              description: `Public function "${func.name}" does not validate its inputs`,
              location: { function: func.name },
              recommendation: 'Add input validation using asserts! to check parameter constraints',
              cwe: 'CWE-20',
            });
          }
        }
      }
    });

    // Check 4: Trait address network compatibility
    // This is CRITICAL for contracts using SIP-010 or SIP-009 traits
    const traitRegex = /\((?:impl-trait|use-trait)\s+[a-z-]+\s+['"]?([^'")\s]+)['"]?\)/g;
    let traitMatch;
    const foundTraits: string[] = [];

    while ((traitMatch = traitRegex.exec(contractCode)) !== null) {
      foundTraits.push(traitMatch[1]);
    }

    // Check each trait for network prefix
    foundTraits.forEach((trait) => {
      const principalMatch = trait.match(/^([A-Z0-9]+)\./);
      if (principalMatch) {
        const principal = principalMatch[1];
        const isMainnet = principal.startsWith('SP');
        const isTestnet = principal.startsWith('ST');

        if (isMainnet || isTestnet) {
          // Known standard traits
          const knownMainnetTraits = [
            'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', // SIP-010
            'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9', // SIP-009
          ];
          const knownTestnetTraits = [
            'ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18', // SIP-010
            'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT', // SIP-009
          ];

          const isKnownMainnet = knownMainnetTraits.includes(principal);
          const isKnownTestnet = knownTestnetTraits.includes(principal);

          if (isKnownMainnet || isKnownTestnet) {
            // Add critical warning about network compatibility
            const network = isKnownMainnet ? 'mainnet' : 'testnet';
            const oppositeNetwork = isKnownMainnet ? 'testnet' : 'mainnet';

            issues.push({
              severity: 'critical',
              category: 'Network Compatibility',
              title: `Trait uses ${network} address - verify deployment target`,
              description:
                `Contract uses ${network} trait address: ${trait}\n` +
                `This contract MUST be deployed to ${network.toUpperCase()}.\n` +
                `If deploying to ${oppositeNetwork}, the deployment will FAIL.\n\n` +
                `Network-specific trait addresses:\n` +
                `• Mainnet SIP-010: SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE\n` +
                `• Testnet SIP-010: ST339A455EK9PAY9NP81WHK73T1JMFC3NN0321T18\n` +
                `• Mainnet SIP-009: SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9\n` +
                `• Testnet SIP-009: ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT`,
              location: { line: 0 },
              recommendation:
                `Ensure this contract is deployed to ${network}. ` +
                `If you need to deploy to ${oppositeNetwork}, regenerate the contract with the correct network configuration.`,
              cwe: 'CWE-668',
            });
          }
        }
      }
    });

    return issues;
  }

  /**
   * Checks contract against best practices
   */
  private checkBestPractices(contractCode: string, analysis: ContractAnalysis): BestPracticeIssue[] {
    const issues: BestPracticeIssue[] = [];

    // Check naming conventions
    const namingIssues = checkNamingConventions(contractCode);
    issues.push(
      ...namingIssues.map((issue: any) => ({
        severity: issue.severity,
        title: issue.message,
        description: issue.message,
        location: {},
        recommendation: 'Use kebab-case for all function and variable names',
      }))
    );

    // Check for documentation
    const hasDocComments = /^;;.*$/m.test(contractCode);
    if (!hasDocComments) {
      issues.push({
        severity: 'informational',
        title: 'Missing documentation comments',
        description: 'Contract lacks comment documentation',
        location: {},
        recommendation: 'Add comments to explain contract purpose and function behavior',
      });
    }

    // Check error handling
    const hasErrorCodes = /err-/.test(contractCode);
    const hasErrorHandling = /try!|unwrap!|match/.test(contractCode);

    if (hasErrorHandling && !hasErrorCodes) {
      issues.push({
        severity: 'low',
        title: 'Inconsistent error handling',
        description: 'Contract uses error handling but lacks defined error codes',
        location: {},
        recommendation: 'Define error codes as constants (e.g., err-owner-only)',
      });
    }

    return issues;
  }

  /**
   * Generates optimization suggestions
   */
  private generateOptimizations(
    contractCode: string,
    analysis: ContractAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for redundant operations
    const redundant = findRedundantOperations(contractCode);
    suggestions.push(...redundant);

    // Check for inefficient data structure usage
    if (analysis.maps.length > 5) {
      suggestions.push({
        title: 'High number of data maps',
        description: `Contract uses ${analysis.maps.length} maps. Consider consolidating related data into composite map values.`,
        estimatedGasSavings: 'Medium',
        location: {},
      });
    }

    return suggestions;
  }

  /**
   * Gets security recommendation for issue category
   */
  private getSecurityRecommendation(category: string): string {
    const recommendations: Record<string, string> = {
      'Missing Validation': 'Add asserts! to validate conditions before executing sensitive operations',
      'Error Handling': 'Use try! or match to handle errors gracefully instead of unwrap!',
      'External Calls': 'Validate return values from external contract calls',
      'Access Control': 'Check tx-sender before allowing state modifications',
    };

    return recommendations[category] || 'Review and fix this security issue';
  }

  /**
   * Gets CWE (Common Weakness Enumeration) for issue category
   */
  private getCWE(category: string): string | undefined {
    const cwes: Record<string, string> = {
      'Missing Validation': 'CWE-20',
      'Error Handling': 'CWE-703',
      'External Calls': 'CWE-20',
      'Access Control': 'CWE-284',
    };

    return cwes[category];
  }

  /**
   * Saves generated contract to file
   */
  private async saveContract(name: string, code: string): Promise<string> {
    await fs.mkdir(this.contractsPath, { recursive: true });
    const filePath = join(this.contractsPath, `${name}.clar`);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }

  /**
   * Calculates audit summary
   */
  private calculateSummary(
    securityIssues: SecurityIssue[],
    bestPracticeIssues: BestPracticeIssue[]
  ): AuditReport['summary'] {
    const critical = securityIssues.filter((i) => i.severity === 'critical').length;
    const high = securityIssues.filter((i) => i.severity === 'high').length;
    const medium =
      securityIssues.filter((i) => i.severity === 'medium').length +
      bestPracticeIssues.filter((i) => i.severity === 'medium').length;
    const low =
      securityIssues.filter((i) => i.severity === 'low').length +
      bestPracticeIssues.filter((i) => i.severity === 'low').length;
    const informational = bestPracticeIssues.filter((i) => i.severity === 'informational').length;

    return {
      totalIssues: critical + high + medium + low + informational,
      critical,
      high,
      medium,
      low,
      informational,
    };
  }

  /**
   * Calculates overall security score (0-100)
   */
  private calculateScore(summary: AuditReport['summary']): number {
    let score = 100;

    score -= summary.critical * 20;
    score -= summary.high * 10;
    score -= summary.medium * 5;
    score -= summary.low * 2;
    score -= summary.informational * 0.5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Gets deployment recommendation based on score
   */
  private getRecommendation(
    score: number,
    summary: AuditReport['summary']
  ): 'approved' | 'needs-review' | 'critical-issues' {
    if (summary.critical > 0) return 'critical-issues';
    if (score < 70 || summary.high > 0) return 'needs-review';
    return 'approved';
  }

  /**
   * Deploys a Clarity contract to Stacks blockchain
   */
  async deployContract(
    contractName: string,
    contractCode: string,
    privateKey: string,
    targetNetwork: 'mainnet' | 'testnet'
  ): Promise<{
    success: boolean;
    txId?: string;
    contractId?: string;
    explorerUrl?: string;
    error?: string;
  }> {
    try {
      // Validate contract name (must be valid Clarity identifier)
      if (!/^[a-z][a-z0-9-]*$/.test(contractName)) {
        throw new Error(
          'Invalid contract name. Must start with lowercase letter and contain only lowercase letters, numbers, and hyphens.'
        );
      }

      // Validate contract code syntax
      const validation = validateClaritySyntax(contractCode);
      if (!validation.valid) {
        throw new Error(
          `Contract has syntax errors: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }

      // CRITICAL: Validate trait addresses match target network
      const { validateTraitAddresses } = await import('../utils/clarity-validator.js');
      const traitValidation = validateTraitAddresses(contractCode, targetNetwork);
      if (!traitValidation.valid) {
        throw new Error(
          `Trait address network mismatch:\n${traitValidation.errors.join('\n\n')}\n\n` +
          `⚠️ DEPLOYMENT BLOCKED: Contract uses wrong trait addresses for ${targetNetwork}.`
        );
      }

      // Select network with explicit API URL
      const network = targetNetwork === 'mainnet'
        ? new StacksMainnet({ url: STACKS_MAINNET_API })
        : new StacksTestnet({ url: STACKS_TESTNET_API });

      // Prepare deployment transaction
      const txOptions = {
        contractName,
        codeBody: contractCode,
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        fee: 100000, // 0.1 STX (100,000 microSTX)
      };

      // Create contract deploy transaction
      const transaction = await makeContractDeploy(txOptions);

      // Broadcast transaction
      const broadcastResponse = await broadcastTransaction(transaction, network);

      // Check for errors in broadcast response
      if ('error' in broadcastResponse) {
        throw new Error(
          `Broadcast failed: ${broadcastResponse.error}${
            broadcastResponse.reason ? ` - ${broadcastResponse.reason}` : ''
          }`
        );
      }

      const txId = broadcastResponse.txid;

      // Get sender address for contract ID
      const senderAddress = transaction.auth.spendingCondition?.signer || 'unknown';
      const contractId = `${senderAddress}.${contractName}`;

      // Generate explorer URL
      const explorerBaseUrl =
        targetNetwork === 'mainnet'
          ? 'https://explorer.stacks.co'
          : 'https://explorer.hiro.so';
      const explorerUrl = `${explorerBaseUrl}/txid/${txId}?chain=${targetNetwork}`;

      return {
        success: true,
        txId,
        contractId,
        explorerUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Deployment failed',
      };
    }
  }
}
