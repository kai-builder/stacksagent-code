# Stacks Agent - Windsurf Workflow

AI-powered intelligence for building Stacks blockchain applications.

## Workflow Trigger
This workflow activates for Stacks blockchain development tasks.

## Capabilities

- **Clarity Contracts**: Generate, audit, and deploy smart contracts
- **Token Standards**: SIP-010 (fungible) and SIP-009 (NFT) templates
- **DeFi Integration**: Alex, Velar, Bitflow, Zest, Boost, Faktory
- **Security Analysis**: Vulnerability detection and best practices
- **Stacks.js**: Frontend integration code snippets
- **BNS**: Bitcoin Name System operations
- **Stacking**: PoX stacking and pool delegation

## Knowledge Search

Search the knowledge base with:

```bash
python3 .shared/stacks-agent/scripts/search.py "<query>" --domain <domain>
```

**Domains**: clarity, templates, security, defi, stacksjs, bns, stacking, deployment

## Process

1. Analyze user request for contract type and requirements
2. Search knowledge base for relevant patterns
3. Generate code following Clarity best practices
4. Apply security checks and validations
5. Provide network-appropriate deployment guide

## Security Checks

Always verify:
- Access control (tx-sender validation)
- Error handling (try! unwrap!)
- Input validation (asserts!)
- Network trait compatibility
- Arithmetic safety

## Networks

- **Mainnet**: SP... addresses (production)
- **Testnet**: ST... addresses (testing)
- **Devnet**: Local with Clarinet

## Key Resources

- Stacks Docs: https://docs.stacks.co
- Clarity Reference: https://docs.stacks.co/clarity
- Hiro Explorer: https://explorer.hiro.so

## Version
1.0.0 by kai-builder
