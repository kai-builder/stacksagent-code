# Stacks Agent - Antigravity Workflow

Build on Stacks blockchain - Bitcoin's smart contract layer.

## Overview

AI-powered development intelligence for Clarity smart contracts, DeFi integration, and blockchain development on Stacks.

## Core Features

- **Smart Contracts**: Generate and audit Clarity contracts
- **Standards**: SIP-010 tokens, SIP-009 NFTs
- **DeFi**: Alex, Velar, Bitflow, Zest, Boost
- **Frontend**: Stacks.js integration snippets
- **Security**: Pattern detection and fixes
- **Deployment**: Testnet and mainnet guides

## Knowledge Base Access

Query 170+ entries across 8 domains:

```bash
python3 .shared/stacks-agent/scripts/search.py "<query>" --domain <domain>
```

**Domains**:
- `clarity` - Language syntax and functions
- `templates` - Contract templates
- `security` - Security patterns
- `defi` - DeFi protocols
- `stacksjs` - JavaScript snippets
- `bns` - Name system
- `stacking` - PoX stacking
- `deployment` - Deploy guides

## Workflow Steps

1. **Understand**: Analyze requirements (type, features, network)
2. **Search**: Query knowledge base for patterns
3. **Generate**: Create code from templates
4. **Secure**: Apply security patterns
5. **Deploy**: Provide deployment steps

## Best Practices

- Use kebab-case naming
- Define error constants
- Validate inputs with asserts!
- Handle errors with try!/unwrap!
- Test on testnet first
- Use correct network trait addresses

## Quick Examples

```clarity
# Token
(define-fungible-token my-token u1000000)

# NFT
(define-non-fungible-token my-nft uint)

# Transfer with security
(try! (stx-transfer? amount tx-sender recipient))
```

## Links

- https://docs.stacks.co
- https://explorer.hiro.so

v1.0.0
