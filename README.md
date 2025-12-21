# Stacks MCP Server

A Model Context Protocol (MCP) server that enables Claude Desktop to interact with the Stacks blockchain. Manage your wallet, trade tokens, stack STX, track your portfolio, and **develop & deploy Clarity smart contracts**—all through natural conversation.

> **New in v0.2.0**: Complete Clarity smart contract development lifecycle with intelligent example search and blockchain deployment!

> **Note**: This is an MVP (Minimum Viable Product) release. Some features use mock data and are being actively developed. See [Limitations](#limitations-mvp) for details.

## Features

### Wallet Management
- Create new wallets with secure encryption (AES-256-GCM)
- Import existing wallets from mnemonic or private key
- View balances for STX and tokens
- Encrypted keystore with password protection

### Market Data & Trading
- Get real-time token prices
- View trending tokens and liquidity pools
- Get DEX swap quotes (Alex, Velar, Bitflow)
- Execute token swaps with slippage protection
- Add/remove liquidity from pools

### Stacking (PoX)
- Check current cycle and stacking info
- View your stacking status and rewards
- Stack STX to earn Bitcoin rewards
- Delegate to stacking pools

### Portfolio Management
- Comprehensive portfolio summary
- Transaction history
- Portfolio value tracking over time
- P&L calculations

### BNS (Bitcoin Name System)
- Resolve BNS names to addresses
- Get primary names for addresses
- Look up name ownership and details
- Check name resolution status

### 🆕 Clarity Smart Contract Development
- **Generate contracts** from natural language (6 templates: FT, NFT, Vault, DAO, Marketplace, Custom)
- **Audit contracts** with comprehensive security analysis (0-100 score)
- **Deploy contracts** to testnet or mainnet with one command (0.1 STX fee)
- **Network validation** - automatically prevents deployment with wrong trait addresses
- **Intelligent search** through 27+ example contracts
- **Documentation integration** from 1,352 lines of Clarity.md
- **Pattern matching** for better contract generation
- **Security checks** based on best practices (including network compatibility)
- **Explorer integration** for transaction monitoring

## Installation

### Prerequisites
- Node.js 18 or higher
- Claude Desktop app ([Download](https://claude.ai/download))

### Quick Start

**Option 1: Install from npm (Recommended)**

```bash
npm install -g stacks-agent-mcp
```

**Option 2: Build from source**

1. Clone the repository:
```bash
git clone https://github.com/kai-builder/stacksagent-mcp.git
cd stacksagent-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Note the absolute path to your `dist/index.js` file - you'll need this for configuration.
   - On macOS/Linux: Run `pwd` in the project directory, then append `/dist/index.js`
   - On Windows: Run `cd` in the project directory, then append `\dist\index.js`

## Configuration

### 1. Open the Claude Desktop Configuration File

**Configuration file location:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**How to open/edit the file:**

**On macOS:**
```bash
# Option 1: Open in default text editor
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Option 2: Open with VS Code
code ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Option 3: Edit with nano
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**On Windows (PowerShell):**
```powershell
# Open with notepad
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

**On Linux:**
```bash
# Open with default editor
xdg-open ~/.config/Claude/claude_desktop_config.json

# Or with nano
nano ~/.config/Claude/claude_desktop_config.json
```

**If the file doesn't exist**, create it:
```bash
# macOS
mkdir -p ~/Library/Application\ Support/Claude
echo '{"mcpServers":{}}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude"
'{"mcpServers":{}}' | Out-File -FilePath "$env:APPDATA\Claude\claude_desktop_config.json" -Encoding utf8

# Linux
mkdir -p ~/.config/Claude
echo '{"mcpServers":{}}' > ~/.config/Claude/claude_desktop_config.json
```

### 2. Add the MCP Server Configuration

Choose the configuration based on how you installed the package:

#### Option 1: If installed via npm (Recommended)

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stacksagent": {
      "command": "npx",
      "args": ["-y", "stacks-agent-mcp"],
      "env": {
        "STACKS_NETWORK": "mainnet"
      }
    }
  }
}
```

> **⚠️ Common Mistake:** Don't use `"command": "node"` with `"args": ["-y", "stacks-agent-mcp"]` - the `-y` flag only works with `npx`, not `node`!

#### Option 2: If built from source

**macOS/Linux:**
```json
{
  "mcpServers": {
    "stacksagent": {
      "command": "node",
      "args": ["/absolute/path/to/stacksagent-mcp/dist/index.js"],
      "env": {
        "STACKS_NETWORK": "mainnet"
      }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "stacksagent": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\stacksagent-mcp\\dist\\index.js"],
      "env": {
        "STACKS_NETWORK": "mainnet"
      }
    }
  }
}
```

**Get your absolute path:**
```bash
# macOS/Linux
cd /path/to/stacksagent-mcp
pwd
# Copy the output and append /dist/index.js

# Windows
cd C:\path\to\stacksagent-mcp
cd
# Copy the output and append \dist\index.js
```

Example paths:
- macOS: `/Users/yourname/Projects/stacksagent-mcp/dist/index.js`
- Linux: `/home/yourname/projects/stacksagent-mcp/dist/index.js`
- Windows: `C:\\Users\\YourName\\Projects\\stacksagent-mcp\\dist\\index.js`

#### Option 3: Using direct binary path

If you know where the package is installed (find with `which stacks-agent-mcp` on macOS/Linux):

```json
{
  "mcpServers": {
    "stacksagent": {
      "command": "stacks-agent-mcp",
      "args": [],
      "env": {
        "STACKS_NETWORK": "mainnet"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

After editing the configuration file:

1. **Save the file** (Cmd+S or Ctrl+S)
2. **Completely quit** Claude Desktop (not just close the window)
   - macOS: Press `Cmd+Q` or right-click dock icon → Quit
   - Windows: Right-click system tray → Exit
3. **Wait 5 seconds**
4. **Restart** Claude Desktop

### 4. Verify It's Working

Open a new conversation in Claude and ask:
```
What Stacks blockchain tools do you have available?
```

If Claude responds with a list of Stacks tools, you're all set! If not, check the [Troubleshooting](#troubleshooting) section below.

### 5. Server Configuration (Optional)

The server creates a config file at `~/.stacks-mcp/config.json` on first run. You can customize:

```json
{
  "network": "mainnet",
  "wallet": {
    "keystorePath": "~/.stacks-mcp/wallet.enc",
    "autoLockMinutes": 15
  },
  "rpc": {
    "primary": "https://api.hiro.so",
    "fallback": "https://api.mainnet.hiro.so"
  },
  "trading": {
    "defaultSlippage": 0.5,
    "maxSlippage": 5.0,
    "preferredDex": "auto"
  },
  "limits": {
    "maxSingleTxUsd": 1000,
    "dailyTxLimitUsd": 5000,
    "requireConfirmation": true
  },
  "protocols": {
    "alex": { "enabled": true },
    "velar": { "enabled": true },
    "bitflow": { "enabled": true }
  }
}
```

## Usage

### First Time Setup

After installing and configuring the MCP server:

1. **Restart Claude Desktop** completely (quit and reopen)
2. **Start a new conversation** with Claude
3. **Verify the tools are available** by asking:
   ```
   What Stacks blockchain tools do you have access to?
   ```
4. **Create or import a wallet** to start using the features

### Security First

⚠️ **Important**: Your wallet and private keys are stored locally on your machine in encrypted format at `~/.stacks-mcp/wallet.enc`.

Before creating a wallet:
- Choose a **strong password** (store it in a password manager)
- You'll receive a **24-word mnemonic phrase** - write it down and store it securely offline
- **Never share** your mnemonic or private key with anyone
- The wallet **auto-locks** after 15 minutes of inactivity

### Example Conversations

#### Create a New Wallet

```
You: Create a new Stacks wallet for me with password "MySecurePassword123"

Claude: I'll create a new wallet for you...
[Creates wallet and returns address and mnemonic]
```

#### Check Balance

```
You: What's my STX balance?

Claude: Let me check your balance...
Your wallet holds 1,234.56 STX (~$892 USD) and 3 other tokens.
```

#### Get a Swap Quote

```
You: How much WELSH can I get for 100 STX?

Claude: Let me get a quote...
You can swap 100 STX for approximately 4,521,304 WELSH.
Rate: 1 STX = 45,213 WELSH
Fee: 0.3 STX (0.3%)
Slippage: 0.5%
Best route: STX → WELSH via Alex
```

#### Execute a Swap

```
You: Swap 100 STX for WELSH

Claude: I'll need to unlock your wallet first. You'll receive ~4.52M WELSH for 100 STX.
Should I proceed with this swap?

You: Yes, my password is "MySecurePassword123"

Claude: [Unlocks wallet, executes swap]
✓ Swap complete! Transaction: 0x7f3a...
You received 4,512,893 WELSH.
```

#### Check Stacking Info

```
You: What's the current stacking APY?

Claude: Current Stacking info:
- Cycle: 82
- APY: ~8% (paid in BTC)
- Minimum: 100,000 STX
- Next cycle starts: 2025-02-15
```

#### View Portfolio

```
You: Show me my portfolio

Claude: Portfolio Summary:
Total Value: $15,234.56

Holdings:
- 1,234.56 STX ($892.00)
- 4,512,893 WELSH ($1,200.45)
- 500.00 USDA ($500.00)

Stacking: Not currently stacking
```

## Available Tools

### Wallet Tools

- `wallet_create` - Create a new wallet
- `wallet_import` - Import wallet from mnemonic/private key
- `wallet_unlock` - Unlock wallet with password
- `wallet_lock` - Lock wallet
- `wallet_get_address` - Get current wallet address
- `wallet_get_balance` - Get STX and token balances
- `wallet_status` - Check if wallet exists and is unlocked

### Market & DEX Tools

- `market_get_price` - Get token price in USD
- `market_get_tokens` - List trending/new tokens
- `market_get_pools` - Get liquidity pools with APY
- `dex_quote` - Get swap quote
- `dex_swap` - Execute token swap
- `dex_add_liquidity` - Add liquidity to pool
- `dex_remove_liquidity` - Remove liquidity from pool

### Stacking Tools

- `stacking_get_info` - Get current PoX cycle info
- `stacking_get_status` - Check stacking status
- `stacking_stack` - Stack STX for rewards
- `stacking_delegate` - Delegate to stacking pool

### Portfolio Tools

- `portfolio_summary` - Get portfolio summary
- `portfolio_transactions` - View transaction history
- `portfolio_history` - Get portfolio value over time

## Security

### Key Storage
- Private keys are encrypted using scrypt + AES-256-GCM
- Keys never leave your local machine
- Encrypted keystore stored at `~/.stacks-mcp/wallet.enc`

### Transaction Safety
- All write operations require wallet to be unlocked
- Configurable transaction limits
- Slippage protection on swaps
- Post-conditions ensure transaction safety

### Best Practices
1. **Use a strong password** for your wallet
2. **Backup your mnemonic phrase** securely
3. **Never share your mnemonic or private key**
4. **Lock your wallet** when not in use
5. **Review transaction details** before confirming

## Development

### Project Structure

```
stacksagent-mcp/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── services/             # Core services
│   │   ├── wallet.ts         # Wallet management
│   │   ├── stacks-api.ts     # Stacks API client
│   │   ├── price.ts          # Price data
│   │   ├── dex.ts            # DEX operations
│   │   ├── stacking.ts       # Stacking/PoX
│   │   └── portfolio.ts      # Portfolio tracking
│   ├── tools/                # MCP tool definitions
│   │   ├── wallet-tools.ts
│   │   ├── market-tools.ts
│   │   └── stacking-tools.ts
│   ├── types/                # TypeScript types
│   └── utils/                # Utilities
│       ├── config.ts
│       ├── constants.ts
│       └── encryption.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Limitations (MVP)

This is an MVP release. Some features are not yet fully implemented:

1. **DEX Integration**: Currently uses mock quotes. Full Alex/Velar/Bitflow integration coming soon.
2. **Stacking**: Core stacking contract calls need implementation.
3. **Price Data**: Limited to major tokens.
4. **Multi-wallet**: Only supports single wallet currently.
5. **Hardware Wallets**: Not yet supported.

## Roadmap

### Phase 2
- [ ] Full DEX API integration (Alex, Velar, Bitflow)
- [ ] Complete stacking contract implementation
- [ ] Multi-wallet support
- [ ] Enhanced portfolio tracking
- [ ] LP position management

### Phase 3
- [ ] Lending/borrowing (Zest, Granite)
- [ ] sBTC operations
- [ ] Hardware wallet support
- [ ] Automated strategies
- [ ] Price alerts

## Troubleshooting

### Cannot access or edit `claude_desktop_config.json`

**Problem:** Error when trying to navigate to the config file, or file doesn't exist.

**Solution:**

**On macOS:**

1. **Open the config file directly** (don't use `cd` - it's a file, not a directory):
   ```bash
   # Option 1: Open in default text editor
   open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Option 2: Open with VS Code
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Option 3: Open with nano
   nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Option 4: View the file
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **If the file doesn't exist**, create it:
   ```bash
   # Create the directory if needed
   mkdir -p ~/Library/Application\ Support/Claude

   # Create the file with basic structure
   echo '{"mcpServers":{}}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Now edit it
   open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

3. **Verify the file location** (macOS):
   ```bash
   # Check if file exists
   ls -la ~/Library/Application\ Support/Claude/
   ```

**On Windows:**

1. **Open the config file**:
   ```powershell
   # In PowerShell
   notepad "$env:APPDATA\Claude\claude_desktop_config.json"

   # Or navigate to it in File Explorer:
   # Press Win+R, paste: %APPDATA%\Claude
   # Then open claude_desktop_config.json
   ```

2. **If the file doesn't exist**, create it:
   ```powershell
   # Create the directory
   New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude"

   # Create the file
   '{"mcpServers":{}}' | Out-File -FilePath "$env:APPDATA\Claude\claude_desktop_config.json" -Encoding utf8

   # Open it
   notepad "$env:APPDATA\Claude\claude_desktop_config.json"
   ```

**On Linux:**

1. **Open the config file**:
   ```bash
   # With default editor
   xdg-open ~/.config/Claude/claude_desktop_config.json

   # With nano
   nano ~/.config/Claude/claude_desktop_config.json
   ```

2. **If the file doesn't exist**:
   ```bash
   mkdir -p ~/.config/Claude
   echo '{"mcpServers":{}}' > ~/.config/Claude/claude_desktop_config.json
   ```

### "MCP Server failed to attach" or "Could not connect to MCP server"

**Problem:** Claude Desktop shows an error that the MCP server failed to start or couldn't attach.

**Common causes:**

1. **Using `node` command with `-y` flag (Wrong!)**

   ❌ **Incorrect:**
   ```json
   {
     "mcpServers": {
       "stacksagent": {
         "command": "node",
         "args": ["-y", "stacks-agent-mcp"]
       }
     }
   }
   ```

   ✅ **Correct:**
   ```json
   {
     "mcpServers": {
       "stacksagent": {
         "command": "npx",
         "args": ["-y", "stacks-agent-mcp"],
         "env": {
           "STACKS_NETWORK": "mainnet"
         }
       }
     }
   }
   ```

   > The `-y` flag only works with `npx`, not with `node`!

2. **Package not found**
   ```bash
   # Verify the package is installed
   which stacks-agent-mcp

   # If not found, install it
   npm install -g stacks-agent-mcp
   ```

3. **Wrong path in config**
   ```bash
   # Test the command directly
   npx -y stacks-agent-mcp
   # If this fails, your npm installation may have issues
   ```

**Solution:**
1. Open your config file:
   ```bash
   open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```
2. Use the correct configuration (see [Configuration](#configuration) section)
3. Save and completely restart Claude Desktop (Cmd+Q, then reopen)

### Claude Desktop doesn't see the tools

**Common causes and solutions:**

1. **Invalid JSON syntax**
   - Use a JSON validator: https://jsonlint.com/
   - Common mistakes: missing commas, trailing commas, unquoted keys
   - Example of valid JSON:
   ```json
   {
     "mcpServers": {
       "stacksagent": {
         "command": "npx",
         "args": ["-y", "stacks-agent-mcp"],
         "env": {
           "STACKS_NETWORK": "mainnet"
         }
       }
     }
   }
   ```

2. **Wrong file path (if built from source)**
   ```bash
   # On macOS/Linux, get the absolute path:
   cd /path/to/stacksagent-mcp
   pwd
   # Copy the output and append /dist/index.js

   # On Windows:
   cd C:\path\to\stacksagent-mcp
   cd
   # Copy the output and append \dist\index.js
   ```

3. **Package not installed (if using npm)**
   ```bash
   # Verify installation
   npm list -g stacks-agent-mcp

   # Reinstall if needed
   npm install -g stacks-agent-mcp
   ```

4. **Restart Claude Desktop completely**
   - Quit Claude Desktop completely (don't just close the window)
   - On macOS: Cmd+Q or right-click dock icon → Quit
   - On Windows: Right-click system tray → Exit
   - Wait 5 seconds, then restart

5. **Check the logs**
   - macOS: `~/Library/Logs/Claude/mcp*.log`
   - Windows: `%APPDATA%\Claude\logs\mcp*.log`
   - Linux: `~/.config/Claude/logs/mcp*.log`

   View logs:
   ```bash
   # macOS/Linux
   tail -f ~/Library/Logs/Claude/mcp*.log

   # Windows (PowerShell)
   Get-Content "$env:APPDATA\Claude\logs\mcp*.log" -Wait
   ```

### Node.js not found

**Error:** `command not found: node` or `'node' is not recognized`

**Solution:**
1. Install Node.js 18+ from https://nodejs.org/
2. Verify installation:
   ```bash
   node --version  # Should show v18.0.0 or higher
   ```
3. Restart your terminal and Claude Desktop

### "Wallet is locked" error

You need to unlock your wallet first:
```
You: Unlock my wallet with password "YourPassword"
```

### Transaction fails

1. Check your STX balance is sufficient
2. Verify slippage tolerance isn't too low
3. Ensure the token pair has liquidity
4. Try again after a few minutes

### Price data unavailable

Some tokens may not have price data available yet. Major tokens (STX, WELSH, USDA, sBTC) are supported.

### Permission denied errors

**On macOS/Linux:**
```bash
# If you get permission errors, try:
sudo npm install -g stacks-agent-mcp

# Or fix npm permissions (recommended):
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc  # or source ~/.zshrc
```

### Still having issues?

1. **Verify the package is working**:
   ```bash
   # Test the CLI directly
   npx stacks-agent-mcp
   # Should start the MCP server (press Ctrl+C to exit)
   ```

2. **Check Claude Desktop is up to date**
   - Download the latest version from https://claude.ai/download

3. **Report the issue**
   - GitHub Issues: https://github.com/kai-builder/stacksagent-mcp/issues
   - Include: OS version, Node.js version, error logs, and your config file (remove sensitive data)

## Publishing to npm (For Maintainers)

To publish a new version to npm:

1. Ensure all changes are committed and tests pass

2. Update version in `package.json`:
```bash
npm version patch  # or minor, or major
```

3. Login to npm (if not already logged in):
```bash
npm login
```

4. Publish the package:
```bash
npm publish
```

5. Push tags to GitHub:
```bash
git push --tags
```

Users can install the latest version via:
```bash
npm install -g stacks-agent-mcp
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (when test infrastructure is ready)
5. Submit a pull request

Please ensure your code:
- Follows the existing code style
- Includes appropriate error handling
- Doesn't expose private keys or sensitive data
- Works on macOS, Windows, and Linux

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always verify transactions before confirming. Never share your private keys or mnemonic phrase.

## Support

- GitHub Issues: Report bugs and feature requests on the GitHub repository
- Stacks Documentation: [https://docs.stacks.co](https://docs.stacks.co)
- MCP Protocol: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- Stacks Discord: [https://discord.gg/stacks](https://discord.gg/stacks)

## Acknowledgments

Built with:
- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Stacks.js](https://github.com/hirosystems/stacks.js) by Hiro Systems
- [Stacks Blockchain](https://www.stacks.co)

---

Made with ❤️ for the Stacks community
