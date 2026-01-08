# Stacks Agent - Cursor Command

AI-powered intelligence for building Stacks blockchain applications.

## Command
Use `/stacks-agent` to activate this workflow for Stacks development tasks.

## Capabilities

- **Clarity Contracts**: Generate, audit, and deploy smart contracts
- **Token Standards**: SIP-010 (fungible) and SIP-009 (NFT) templates
- **DeFi Integration**: Alex, Velar, Bitflow, Zest, Boost, Faktory
- **Security Analysis**: Vulnerability detection and best practices
- **Stacks.js**: Frontend integration code snippets
- **BNS**: Bitcoin Name System operations
- **Stacking**: PoX stacking and pool delegation

## Knowledge Search

Use the search script to query the knowledge base:

```bash
python3 .shared/stacks-agent/scripts/search.py "<query>" --domain <domain>
```

**Available domains**: clarity, templates, security, defi, stacksjs, bns, stacking, deployment, auto

## Workflow

1. **Understand** the user's request (contract type, features, network)
2. **Search** knowledge base for relevant patterns and examples
3. **Generate** code based on templates and best practices
4. **Review** security patterns and apply fixes
5. **Provide** deployment instructions

## Examples

- "Create a SIP-010 token called MOON with 1M supply"
- "Build an NFT collection with royalties"
- "How do I swap tokens on Velar?"
- "Deploy my contract to testnet"

## Resources

- Docs: https://docs.stacks.co
- Explorer: https://explorer.hiro.so
- Clarinet: https://github.com/hirosystems/clarinet

## Version
1.0.0 - 170+ knowledge entries across 8 domains
