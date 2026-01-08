# Stacks Agent

> AI Skill for building Stacks blockchain applications - Bitcoin's most powerful smart contract layer

An intelligent AI assistant that provides development guidance for Clarity smart contracts, DeFi integration, and blockchain development on Stacks. Works with **Claude Code, Cursor, Windsurf, Antigravity, GitHub Copilot, Kiro, and Codex**.

![Stacks Agent](https://img.shields.io/npm/v/stacks-agent?color=blue&label=stacks-agent)
![License](https://img.shields.io/npm/l/stacks-agent)
![Downloads](https://img.shields.io/npm/dm/stacks-agent)

## ✨ Features

- **🔷 61 Clarity Functions** - Complete language reference with examples
- **📋 14 Contract Templates** - SIP-010, SIP-009, DAO, Vault, Marketplace, Stacking
- **🔐 15 Security Patterns** - Common vulnerabilities and fixes
- **🔄 15 DeFi Protocols** - Alex, Velar, Bitflow, Zest, StackingDAO, Boost, Faktory
- **⚛️ 30 Stacks.js Snippets** - Wallet, transactions, API integration
- **🌐 10 BNS Operations** - Name registration and resolution
- **💰 15 Stacking Guides** - PoX stacking and pool delegation
- **🚀 25 Deployment Steps** - Testnet, mainnet, and devnet workflows

## 🎯 Use Cases

- Generate Clarity smart contracts from natural language
- Audit contracts for security vulnerabilities
- Integrate with DeFi protocols (swaps, liquidity, lending)
- Deploy to testnet/mainnet
- Build dApps with Stacks.js
- Implement stacking and BNS features

## 📦 Installation

### Using CLI (Recommended)

```bash
# Install globally
npm install -g stacks-agent

# Go to your project
cd /path/to/your/project

# Install for your AI assistant
stacks-agent init --ai claude      # Claude Code
stacks-agent init --ai cursor      # Cursor
stacks-agent init --ai windsurf    # Windsurf
stacks-agent init --ai antigravity # Antigravity
stacks-agent init --ai copilot     # GitHub Copilot
stacks-agent init --ai kiro        # Kiro
stacks-agent init --ai codex       # OpenAI Codex
stacks-agent init --ai all         # All platforms
```

### Manual Installation

Copy the appropriate folders to your project:

| AI Assistant    | Folders to Copy                                          |
| --------------- | -------------------------------------------------------- |
| Claude Code     | `.claude/skills/stacks-agent/`                           |
| Cursor          | `.cursor/commands/stacks-agent.md` + `.shared/stacks-agent/` |
| Windsurf        | `.windsurf/workflows/stacks-agent.md` + `.shared/stacks-agent/` |
| Antigravity     | `.agent/workflows/stacks-agent.md` + `.shared/stacks-agent/` |
| GitHub Copilot  | `.github/prompts/stacks-agent.prompt.md` + `.shared/stacks-agent/` |
| Kiro            | `.kiro/steering/stacks-agent.md` + `.shared/stacks-agent/` |
| Codex           | `.codex/skills/stacks-agent/`                            |

## 🚀 Usage

### Claude Code

The skill activates automatically when you request Stacks development work:

```
Create a meme token called PEPE with 1 billion supply
```

### Cursor / Windsurf / Antigravity

Use the slash command:

```
/stacks-agent Create a meme token called PEPE with 1 billion supply
```

### GitHub Copilot

Reference in chat:

```
@stacks-agent How do I swap tokens on Alex?
```

## 💡 Example Prompts

```
"Create a SIP-010 token with burn mechanism"
"Build an NFT collection with royalties"
"Audit this Clarity contract for security issues"
"Show me how to integrate Alex swap in my dApp"
"Deploy my contract to testnet"
"How do I implement stacking in my app?"
"Generate a DAO contract with proposal voting"
```

## 🔍 Knowledge Base Search

The skill includes a powerful BM25-based search engine:

```bash
# Auto-detect domain
python3 .claude/skills/stacks-agent/scripts/search.py "define-public"

# Search specific domain
python3 .claude/skills/stacks-agent/scripts/search.py "swap tokens" --domain defi

# Get more results
python3 .claude/skills/stacks-agent/scripts/search.py "security" --domain security -n 10

# JSON output
python3 .claude/skills/stacks-agent/scripts/search.py "stx transfer" --domain stacksjs -f json
```

**Available domains**:
- `clarity` - Syntax and functions
- `templates` - Contract templates
- `security` - Security patterns
- `defi` - DeFi protocols
- `stacksjs` - JavaScript snippets
- `bns` - BNS operations
- `stacking` - Stacking guides
- `deployment` - Deployment steps
- `auto` - Auto-detect (default)

## 📚 Knowledge Base Contents

### Clarity Language (61 entries)
Types, functions, control flow, arithmetic, comparisons, maps, tokens, STX operations

### Contract Templates (14 entries)
- **Tokens**: SIP-010 basic, mintable, burnable, capped
- **NFTs**: SIP-009 basic, mintable, royalties
- **DeFi**: Vault basic/timelocked, liquidity pool
- **DAO**: Basic DAO, treasury management
- **Other**: Marketplace, stacking pool

### Security Patterns (15 entries)
- Critical: Access control, unchecked transfers
- High: Reentrancy, arithmetic safety
- Medium: Input validation, front-running
- Low: Code style, gas optimization

### DeFi Protocols (15 entries)
Alex, Velar, Bitflow, Zest, StackingDAO, Boost, Faktory integration patterns

### Stacks.js (30 entries)
Wallet connection, transactions, Clarity values, API calls, post-conditions

### BNS (10 entries)
Name resolution, registration, transfer, updates

### Stacking (15 entries)
Direct stacking, delegation, pools, rewards

### Deployment (25 entries)
Testnet, mainnet, devnet workflows with Clarinet

## 🛡️ Security Best Practices

All generated contracts include:

- ✅ Access control (`tx-sender` validation)
- ✅ Error handling (`try!`, `unwrap!`)
- ✅ Input validation (`asserts!`)
- ✅ Named error constants
- ✅ Kebab-case naming
- ✅ Network compatibility checks

## 🌐 Networks

- **Mainnet**: Production (SP... addresses)
- **Testnet**: Testing (ST... addresses, free STX)
- **Devnet**: Local development (Clarinet)

## 🔧 Prerequisites

- Python 3.x (for search functionality)
- Node.js 18+ (for CLI installation)

```bash
python3 --version
node --version
```

## 📖 Documentation

- [Stacks Docs](https://docs.stacks.co)
- [Clarity Reference](https://docs.stacks.co/clarity)
- [Hiro Platform](https://platform.hiro.so)
- [Explorer (Mainnet)](https://explorer.hiro.so)
- [Explorer (Testnet)](https://explorer.hiro.so/?chain=testnet)

## 🔗 DeFi Resources

- [Alex DEX](https://app.alexlab.co)
- [Velar DEX](https://app.velar.co)
- [Bitflow DEX](https://app.bitflow.finance)
- [Zest Protocol](https://www.zestprotocol.com)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add knowledge entries to appropriate CSV files
5. Test the search functionality
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Built for the Stacks community with:
- [Stacks.js](https://github.com/hirosystems/stacks.js) by Hiro Systems
- [Stacks Blockchain](https://www.stacks.co)
- [Clarity Language](https://docs.stacks.co/clarity)

## 📞 Support

- GitHub Issues: [Report bugs or request features](https://github.com/kai-builder/stacks-agent/issues)
- Stacks Discord: [Join the community](https://discord.gg/stacks)
- Twitter: [@kai_builder](https://twitter.com/kai_builder)

## 🎯 Roadmap

- [x] Multi-platform AI skill support
- [x] 170+ knowledge base entries
- [x] BM25 search engine
- [x] CLI installer
- [ ] Web-based search interface
- [ ] VSCode extension
- [ ] Real-time contract analysis
- [ ] Community knowledge contributions
- [ ] Multi-language support

---

**Made with ❤️ for the Stacks community**

*Build Bitcoin-secured dApps with AI assistance*
