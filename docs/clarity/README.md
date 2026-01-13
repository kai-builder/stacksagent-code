# Clarity Smart Contract Tools - Documentation

This directory contains documentation and examples for the Clarity smart contract generation and auditing features.

## Overview

The StacksAgent MCP server now includes two powerful MCP tools for working with Clarity smart contracts:

1. **clarity_write_contract** - Generate Clarity smart contracts from natural language
2. **clarity_audit_contract** - Comprehensive security audit of Clarity contracts

## Directory Structure

```
docs/clarity/
├── README.md                    # This file
├── patterns/                    # Contract pattern templates
├── examples/                    # Example Clarity contracts
│   ├── counter.clar            # Simple counter example
│   └── token-ft.clar           # Full SIP-010 token implementation
├── security/                    # Security documentation
│   ├── common-vulnerabilities.md   # Known security issues
│   └── best-practices.md          # Coding standards
└── syntax/                      # Clarity language reference (to be added)
```

## Using clarity_write_contract

Generate Clarity smart contracts from natural language requirements.

### Parameters

- **requirements** (required): Natural language description of the contract
- **contractType** (optional): Type of contract - `fungible-token`, `non-fungible-token`, `vault`, `dao`, `marketplace`, or `custom` (default)
- **features** (optional): Array of additional features like `["pausable", "mintable", "burnable"]`
- **includeComments** (optional): Include documentation comments (default: true)
- **includeTests** (optional): Generate test cases (future feature, default: false)

### Examples

#### Generate a Fungible Token
```
User: "Generate a fungible token named MyToken with symbol MTK, total supply of 1000000 and 6 decimals"

Tool Parameters:
{
  "requirements": "Create a fungible token named MyToken with symbol MTK, total supply of 1000000 and 6 decimals",
  "contractType": "fungible-token"
}
```

#### Generate an NFT Collection
```
User: "Create an NFT collection called CoolArt with symbol CART"

Tool Parameters:
{
  "requirements": "Create an NFT collection called CoolArt with symbol CART",
  "contractType": "non-fungible-token"
}
```

#### Generate a Vault
```
User: "Create a simple vault for holding STX"

Tool Parameters:
{
  "requirements": "Create a simple vault for holding STX",
  "contractType": "vault"
}
```

### Response Format

```json
{
  "success": true,
  "contractName": "mytoken",
  "contractCode": "(define-fungible-token...)",
  "analysis": {
    "syntaxValid": true,
    "functionCount": 7,
    "dataVarCount": 1,
    "mapCount": 0,
    "complexity": "medium",
    "traits": ["SP3FBR...sip-010-trait"],
    "functions": [...]
  },
  "filePath": "contracts/mytoken.clar",
  "message": "Contract generated successfully...",
  "nextSteps": [...]
}
```

## Using clarity_audit_contract

Perform comprehensive security audits on Clarity smart contracts.

### Parameters

- **contractCode** (required): The full Clarity contract code as a string
- **includeOptimizations** (optional): Include gas optimization suggestions (default: true)
- **severityThreshold** (optional): Minimum severity to report - `critical`, `high`, `medium`, `low`, `informational` (default: `low`)

### Example

```
User: "Audit this Clarity contract: (define-public (transfer...) ...)"

Tool Parameters:
{
  "contractCode": "(define-public (transfer...) ...)",
  "includeOptimizations": true,
  "severityThreshold": "medium"
}
```

### Response Format

```json
{
  "success": true,
  "contractName": "my-contract",
  "auditDate": "2025-12-20T...",
  "summary": {
    "totalIssues": 5,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 2,
    "informational": 0,
    "score": 77,
    "recommendation": "needs-review",
    "status": "Review required before deployment"
  },
  "securityIssues": [...],
  "bestPractices": [...],
  "optimizations": [...],
  "message": "Audit completed. Score: 77/100...",
  "criticalActions": [...]
}
```

### Audit Scoring

- **90-100**: Excellent - Ready for deployment
- **70-89**: Good - Minor improvements recommended
- **50-69**: Fair - Review and address issues
- **Below 50**: Poor - Significant issues found

### Recommendation Levels

- **approved**: Contract passed audit, ready for deployment
- **needs-review**: Review recommended before deployment (high severity or score < 70)
- **critical-issues**: DO NOT DEPLOY - Critical vulnerabilities found

## Security Checks

The audit performs the following checks:

### Critical Severity
- Unchecked return values from transfers
- Missing access controls on sensitive functions
- Unvalidated external contract calls

### High Severity
- Missing input validation on public functions
- Unsafe STX/token transfers
- Improper use of tx-sender vs contract-caller

### Medium Severity
- Front-running vulnerabilities
- Insufficient error handling
- Missing event emissions

### Low Severity
- Non-standard naming conventions
- Missing documentation
- Overly broad function visibility

### Informational
- Code style inconsistencies
- Redundant operations
- Gas optimization opportunities

## Contract Templates

The following contract templates are available:

### fungible-token
SIP-010 compliant fungible token with:
- Transfer function
- Read-only getters (name, symbol, decimals, balance, total-supply)
- Token URI support

### non-fungible-token
SIP-009 compliant NFT with:
- Transfer function
- Minting capability (owner only)
- Token URI management

### vault
Simple STX vault with:
- Deposit function
- Withdraw function
- Balance tracking

### dao
Basic DAO with:
- Member management
- Proposal creation
- Voting mechanism

### marketplace
NFT marketplace with:
- Listing creation
- Buying functionality
- Platform fee collection

### custom
Minimal contract skeleton for custom implementations

## Best Practices

See [best-practices.md](security/best-practices.md) for detailed guidelines on:
- Naming conventions (kebab-case)
- Error handling patterns
- Access control
- Input validation
- Gas optimization
- Code organization

## Security Resources

See [common-vulnerabilities.md](security/common-vulnerabilities.md) for:
- Common vulnerability patterns
- CWE references
- Secure coding examples
- Prevention checklist

## Examples

See the [examples/](examples/) directory for:
- **counter.clar**: Simple counter demonstrating basic concepts
- **token-ft.clar**: Full SIP-010 fungible token implementation

## Generated Contracts

All generated contracts are saved to the `contracts/` directory in the project root.

## Next Steps

After generating a contract:
1. Review the generated code carefully
2. Run `clarity_audit_contract` to check for issues
3. Test using Clarinet or similar tools
4. Deploy to testnet for verification
5. Consider professional security audit for high-value contracts

## Support

For issues or questions:
- Check the documentation in this directory
- Review example contracts
- Consult the Clarity language documentation at https://docs.stacks.co/clarity
