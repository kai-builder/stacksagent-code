# Stacks Agent - Kiro Steering

Stacks blockchain development intelligence for Kiro AI.

## Purpose

Guide AI responses for Stacks blockchain development, Clarity smart contracts, and DeFi integration.

## Scope

- Clarity contract generation and auditing
- SIP-010 (fungible tokens) and SIP-009 (NFTs)
- DeFi protocols: Alex, Velar, Bitflow, Zest, Boost, Faktory
- Stacks.js frontend integration
- BNS (Bitcoin Name System)
- PoX stacking and delegation
- Deployment workflows

## Knowledge Access

Search knowledge base:
```bash
python3 .shared/stacks-agent/scripts/search.py "<query>" --domain <domain>
```

Domains: clarity, templates, security, defi, stacksjs, bns, stacking, deployment

## Response Guidelines

### For Contract Generation
1. Search templates domain for relevant patterns
2. Apply security patterns from security domain
3. Use kebab-case naming convention
4. Include error constants (ERR-*)
5. Add try!/unwrap! for error handling
6. Validate inputs with asserts!

### For DeFi Integration
1. Search defi domain for protocol specifics
2. Provide mainnet contract addresses
3. Include example function calls
4. Add Stacks.js integration if needed

### For Deployment
1. Search deployment domain for steps
2. Distinguish testnet vs mainnet
3. Include faucet links for testnet
4. Provide verification instructions

## Security Emphasis

Always check generated code for:
- Missing tx-sender validation
- Unchecked transfer returns
- Missing input validation
- Wrong network trait addresses
- Hardcoded magic numbers

## Code Style

```clarity
;; Good
(define-constant ERR-UNAUTHORIZED (err u100))
(define-public (transfer (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (ft-transfer? token amount tx-sender recipient))
    (ok true)))
```

## Networks

- Mainnet: SP... (production)
- Testnet: ST... (testing)
- Devnet: local (Clarinet)

## Version
1.0.0 - 170+ knowledge entries
