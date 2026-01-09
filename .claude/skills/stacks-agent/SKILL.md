---
name: stacks-agent
description: AI-powered intelligence for building Stacks blockchain applications
version: 1.0.0
author: kai-builder
triggers:
  - stacks
  - clarity
  - smart contract
  - blockchain
  - sip-010
  - sip-009
  - nft
  - token
  - defi
  - stacking
  - bns
  - bitcoin
  - web3
---

# Stacks Agent Skill

AI-powered development intelligence for building on Stacks blockchain - Bitcoin's most powerful smart contract layer.

## Capabilities

- **Clarity Contracts**: Generate, audit, and deploy smart contracts
- **Token Standards**: SIP-010 (fungible) and SIP-009 (NFT) templates
- **DeFi Integration**: Alex, Velar, Bitflow, Zest, Boost, Faktory protocol patterns
- **Security Analysis**: Vulnerability detection and best practices
- **Stacks.js**: Frontend integration code snippets
- **BNS**: Bitcoin Name System operations
- **Stacking**: PoX stacking and pool delegation
- **Deployment**: Testnet and mainnet deployment guides

## Knowledge Base

This skill includes searchable databases for:
- **61 Clarity functions** - Complete language reference
- **14 Contract templates** - FT, NFT, DAO, Vault, Marketplace, Stacking
- **15 Security patterns** - Common vulnerabilities and fixes
- **15 DeFi protocols** - Alex, Velar, Bitflow, Zest, StackingDAO, Boost, Faktory
- **76 Stacks.js snippets** - Production wallet patterns (STX/BTC addresses, connect, getLocalStorage, isConnected), transactions, API calls, React hooks, server-side patterns
- **10 BNS operations** - Name registration and resolution
- **15 Stacking guides** - PoX stacking and delegation
- **25 Deployment steps** - Testnet, mainnet, and devnet

## Workflow

### Step 1: Understand Request
Analyze user request to determine:
- Contract type (token, NFT, DeFi, DAO, etc.)
- Features needed (mintable, burnable, etc.)
- Security requirements
- Target network (testnet/mainnet)

### Step 2: Search Knowledge Base
```bash
python3 .shared/stacks-agent/scripts/search.py "<query>" --domain <domain>
```

Available domains:
- `clarity` - Clarity syntax and functions
- `templates` - Contract templates
- `security` - Security patterns
- `defi` - DeFi protocol integrations
- `stacksjs` - Stacks.js code snippets
- `bns` - BNS operations
- `stacking` - PoX stacking
- `deployment` - Deployment guides
- `auto` - Auto-detect domain (default)

### Step 3: Generate Code
Based on search results:
1. Select appropriate template
2. Customize for user requirements
3. Apply security patterns
4. Add proper error handling
5. Include comprehensive comments

### Step 4: Security Review
Check generated code against security-patterns.csv:
- Access control (tx-sender validation)
- Arithmetic safety (overflow/underflow)
- Error handling (try! unwrap!)
- Input validation (asserts!)
- Reentrancy prevention
- Network trait compatibility

### Step 5: Provide Deployment Instructions
Include network-appropriate deployment steps from deployment.csv.

## Example Usage

### Example 1: Create Meme Token

**User**: "Create a meme token called PEPE with 1 billion supply"

**Workflow**:
1. Search templates: `python3 scripts/search.py "fungible token" --domain templates`
2. Search security: `python3 scripts/search.py "token security" --domain security`
3. Generate SIP-010 contract with:
   - Name: PEPE
   - Symbol: PEPE
   - Supply: 1,000,000,000
   - Decimals: 6
4. Apply security patterns (access control, input validation)
5. Provide testnet deployment instructions

### Example 2: NFT Collection

**User**: "Build an NFT collection with royalties"

**Workflow**:
1. Search: `python3 scripts/search.py "nft royalties" --domain templates`
2. Search: `python3 scripts/search.py "nft security" --domain security`
3. Generate SIP-009 contract with royalty tracking
4. Apply security checks
5. Provide deployment guide

### Example 3: DEX Integration

**User**: "How do I swap tokens on Alex?"

**Workflow**:
1. Search: `python3 scripts/search.py "alex swap" --domain defi`
2. Return swap-helper function signature
3. Provide example code
4. Include Stacks.js integration if needed

### Example 4: Deploy Contract

**User**: "Deploy my contract to testnet"

**Workflow**:
1. Search: `python3 scripts/search.py "testnet deploy" --domain deployment`
2. Provide step-by-step deployment guide
3. Include faucet link for testnet STX
4. Explain verification process

## Networks

- **Mainnet**: SP... addresses, real value, production
- **Testnet**: ST... addresses, free STX, testing only
- **Devnet**: Local development with Clarinet

## Traits and Standards

### SIP-010 (Fungible Token)
- Mainnet: `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard`
- Testnet: Same trait address works on testnet

### SIP-009 (Non-Fungible Token)
- Mainnet: `SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait`
- Testnet: Same trait address works on testnet

⚠️ **Important**: Always use the correct trait addresses for the target network. Using wrong trait addresses will cause deployment to fail.

## Security Best Practices

1. **Access Control**: Always check `tx-sender` for sensitive operations
2. **Error Handling**: Use `try!` or `unwrap!` for all transfer operations
3. **Input Validation**: Validate all public function parameters with `asserts!`
4. **Arithmetic Safety**: Clarity prevents overflow/underflow automatically
5. **Naming**: Use kebab-case for all identifiers
6. **Error Codes**: Define as constants (e.g., `ERR-UNAUTHORIZED`)
7. **Testing**: Test on testnet before mainnet deployment
8. **Auditing**: Professional audit recommended for high-value contracts

## Resources

- Stacks Docs: https://docs.stacks.co
- Clarity Reference: https://docs.stacks.co/clarity
- Hiro Platform: https://platform.hiro.so
- Explorer (Mainnet): https://explorer.hiro.so
- Explorer (Testnet): https://explorer.hiro.so/?chain=testnet
- Clarinet: https://github.com/hirosystems/clarinet
- Alex DEX: https://app.alexlab.co
- Velar DEX: https://app.velar.co
- Bitflow DEX: https://app.bitflow.finance
- Zest Protocol: https://www.zestprotocol.com

## Important Notes

- All generated contracts follow Clarity best practices
- Security patterns are based on real-world vulnerabilities
- Always test on testnet before mainnet deployment
- DeFi protocol addresses are for mainnet (use testnet equivalents for testing)
- Search functionality uses BM25 ranking for relevant results
- Auto-domain detection works for most queries, but specifying domain is more accurate

## Search Examples

```bash
# Auto-detect domain
python3 scripts/search.py "define-public"

# Search specific domain
python3 scripts/search.py "swap tokens" --domain defi

# Get more results
python3 scripts/search.py "security vulnerability" --domain security -n 10

# JSON output
python3 scripts/search.py "stx transfer" --domain stacksjs -f json
```

## Version History

- **1.0.0** (2025-01): Initial release with 170+ knowledge entries
  - Clarity syntax and functions
  - Contract templates
  - Security patterns
  - DeFi protocol integrations
  - Stacks.js snippets
  - BNS operations
  - Stacking guides
  - Deployment workflows
