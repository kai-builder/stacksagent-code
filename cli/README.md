# stacksagent

> AI Skill CLI installer for building Stacks blockchain applications

[![npm version](https://img.shields.io/npm/v/stacksagent.svg)](https://www.npmjs.com/package/stacksagent)
[![npm downloads](https://img.shields.io/npm/dm/stacksagent.svg)](https://www.npmjs.com/package/stacksagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Transform your AI coding assistant into a Stacks blockchain expert with 170+ searchable knowledge entries.

## 🎯 Supported AI Platforms

- **Claude Code** - Claude's official CLI
- **Cursor** - AI-first code editor
- **Windsurf** - AI coding assistant
- **Antigravity** - AI development tool
- **GitHub Copilot** - GitHub's AI assistant
- **Kiro** - AI coding helper
- **Codex** - OpenAI Codex integration

## 📦 Installation

```bash
npm install -g stacksagent
```

## 🚀 Usage

### Install for Your AI Platform

```bash
# Claude Code
stacksagent init --ai claude

# Cursor
stacksagent init --ai cursor

# Windsurf
stacksagent init --ai windsurf

# Antigravity
stacksagent init --ai antigravity

# GitHub Copilot
stacksagent init --ai copilot

# Kiro
stacksagent init --ai kiro

# Codex
stacksagent init --ai codex

# All platforms at once
stacksagent init --ai all
```

### Force Overwrite

```bash
stacksagent init --ai claude --force
```

### Check Version

```bash
stacksagent --version
```

### Update to Latest

```bash
stacksagent update
```

### List Available Versions

```bash
stacksagent versions
```

## 💡 What Gets Installed

The CLI installs platform-specific skill files in your project:

- **Claude Code**: `.claude/skills/stacks-agent/`
- **Cursor**: `.cursor/commands/` + `.shared/stacks-agent/`
- **Windsurf**: `.windsurf/workflows/` + `.shared/stacks-agent/`
- **Antigravity**: `.agent/workflows/` + `.shared/stacks-agent/`
- **Copilot**: `.github/prompts/` + `.shared/stacks-agent/`
- **Kiro**: `.kiro/steering/` + `.shared/stacks-agent/`
- **Codex**: `.codex/skills/stacks-agent/`

## 📚 Knowledge Base

170+ entries across 8 domains:

- **Clarity** (61) - Language syntax and functions
- **Templates** (14) - Contract templates (SIP-010, SIP-009, DAO, Vault)
- **Security** (15) - Vulnerability patterns and fixes
- **DeFi** (15) - Protocol integrations (Alex, Velar, Bitflow, Zest)
- **Stacks.js** (30) - Frontend integration snippets
- **BNS** (10) - Bitcoin Name System operations
- **Stacking** (15) - PoX stacking guides
- **Deployment** (25) - Testnet/mainnet deployment steps

## 🔍 Search Knowledge Base

After installation, search the knowledge base:

```bash
python3 .claude/skills/stacks-agent/scripts/search.py "your query"

# Search specific domain
python3 .claude/skills/stacks-agent/scripts/search.py "swap tokens" --domain defi

# Get more results
python3 .claude/skills/stacks-agent/scripts/search.py "security" -n 10

# JSON output
python3 .claude/skills/stacks-agent/scripts/search.py "stx transfer" -f json
```

## 💬 Example Prompts

After installing the skill, ask your AI assistant:

- "Create a SIP-010 token with burn mechanism"
- "Build an NFT collection with royalties"
- "Audit this Clarity contract for security issues"
- "Show me how to integrate Alex swap"
- "Deploy my contract to testnet"
- "How do I implement stacking?"

## 🛠️ Development

### Requirements

- Node.js 18+
- Python 3.x (for search functionality)

### Build from Source

```bash
git clone https://github.com/kai-builder/stacksagent.git
cd stacksagent/cli
npm install
npm run build
npm link
```

## 📖 Documentation

- [Main Repository](https://github.com/kai-builder/stacksagent)
- [Stacks Docs](https://docs.stacks.co)
- [Clarity Reference](https://docs.stacks.co/clarity)
- [Hiro Platform](https://platform.hiro.so)

## 🤝 Contributing

Contributions welcome! Please see [Contributing Guide](https://github.com/kai-builder/stacksagent/blob/main/CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Built for the Stacks community with:
- [Stacks.js](https://github.com/hirosystems/stacks.js)
- [Stacks Blockchain](https://www.stacks.co)
- [Clarity Language](https://docs.stacks.co/clarity)

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/kai-builder/stacksagent/issues)
- **Stacks Discord**: [Join the community](https://discord.gg/stacks)

---

**Made with ❤️ for the Stacks community**

*Build Bitcoin-secured dApps with AI assistance*
