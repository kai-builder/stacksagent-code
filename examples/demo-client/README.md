# Stacks Agent Demo Client

A sample Next.js application demonstrating how to integrate the **Stacks Agent HTTP API** with the **Claude API** to build an AI-powered Stacks blockchain assistant.

![Stacks Agent Demo](https://via.placeholder.com/800x400?text=Stacks+Agent+Demo)

## Features

- Chat interface with Claude AI
- Real-time blockchain data via Stacks Agent API
- Tool use for:
  - Wallet balance lookups
  - Token price queries
  - Stacking information
  - Swap quotes
  - Portfolio summaries
  - Smart contract generation
  - Contract auditing
- Markdown rendering for responses
- Responsive design with Tailwind CSS

## Prerequisites

1. **Node.js 18+**
2. **Claude API Key** from [Anthropic Console](https://console.anthropic.com)
3. **Stacks Agent API** running locally or hosted

## Quick Start

### 1. Start the Stacks Agent API

First, make sure the Stacks Agent HTTP API is running:

```bash
# From the stacksagent-mcp root directory
npm run build
npm run api

# API will be available at http://localhost:3001
```

### 2. Setup the Demo Client

```bash
# Navigate to the demo directory
cd examples/demo-client

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Configure Environment

Edit `.env` and add your API keys:

```env
# Required: Your Claude API key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional: Stacks Agent API URL (defaults to localhost:3001)
STACKS_API_URL=http://localhost:3001
```

### 4. Run the Demo

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
demo-client/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # API route handling Claude + tool execution
│   ├── components/
│   │   ├── Chat.tsx          # Main chat interface
│   │   └── ChatMessage.tsx   # Individual message component
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── lib/
│   ├── tools.ts              # Claude tool definitions
│   └── stacks-api.ts         # Stacks Agent API client
├── .env.example              # Environment template
├── package.json
└── README.md
```

## How It Works

### 1. User Sends Message

User types a message like "What's my STX balance at SP2J6..."

### 2. API Route Processes

`/api/chat/route.ts` receives the message and:
- Sends it to Claude API with tool definitions
- Claude decides which tool(s) to call

### 3. Tool Execution

When Claude wants to use a tool:
- The API route calls the Stacks Agent HTTP API
- Results are sent back to Claude
- Claude generates a natural language response

### 4. Response Displayed

The assistant's response is displayed in the chat UI with Markdown formatting.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_wallet_balance` | Get STX and token balances for an address |
| `get_token_price` | Get current price of a token |
| `get_stacking_info` | Get PoX stacking information |
| `get_stacking_status` | Get stacking status for an address |
| `get_swap_quote` | Get a quote for token swap |
| `get_portfolio` | Get comprehensive portfolio summary |
| `get_trending_tokens` | Get trending tokens list |
| `get_liquidity_pools` | Get DEX liquidity pools |
| `generate_contract` | Generate a Clarity smart contract |
| `audit_contract` | Audit a contract for security issues |
| `get_transaction_history` | Get recent transactions |

## Example Prompts

Try these prompts in the demo:

- "What's the current STX price?"
- "Check the balance for SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"
- "Show me the top 5 trending tokens"
- "What's the current stacking APY?"
- "Get me a quote to swap 100 STX to WELSH"
- "Generate a fungible token contract called MyToken with 1 million supply"
- "Show me the top liquidity pools on Bitflow"

## Customization

### Adding New Tools

1. Add tool definition in `lib/tools.ts`:

```typescript
{
  name: "my_new_tool",
  description: "Description of what the tool does",
  input_schema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "Parameter description" }
    },
    required: ["param1"]
  }
}
```

2. Add handler in `lib/stacks-api.ts`:

```typescript
case "my_new_tool": {
  result = await apiCall("/api/my-endpoint", {
    method: "POST",
    body: JSON.stringify({ param1: toolInput.param1 })
  });
  break;
}
```

### Styling

The app uses Tailwind CSS. Modify styles in:
- `app/globals.css` - Global styles
- `tailwind.config.js` - Tailwind configuration
- Individual components - Component-specific styles

### System Prompt

Modify the AI behavior by editing `systemPrompt` in `lib/tools.ts`.

## Production Deployment

### Environment Variables

Set these environment variables in your hosting platform:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
STACKS_API_URL=https://your-stacks-api.com
```

### Build

```bash
npm run build
npm start
```

### Hosting Options

- **Vercel** - Recommended for Next.js apps
- **Netlify** - With serverless functions
- **AWS/GCP/Azure** - With Node.js runtime
- **Docker** - Containerized deployment

## Security Considerations

1. **API Keys**: Never expose API keys in client-side code
2. **BYOK**: Consider letting users provide their own Claude API key
3. **Rate Limiting**: Implement rate limiting for production
4. **Input Validation**: Validate all user inputs
5. **CORS**: Configure CORS properly for the Stacks Agent API

## Troubleshooting

### "Unable to connect to Stacks API"

Make sure the Stacks Agent API is running:
```bash
npm run api  # In the stacksagent-mcp directory
```

### "Invalid API key"

Check that your `ANTHROPIC_API_KEY` in `.env` is correct.

### "Rate limited"

You've hit Claude's rate limits. Wait a moment and try again.

### Tools not working

1. Check the browser console for errors
2. Check the terminal running the Next.js dev server
3. Verify the Stacks Agent API is responding:
   ```bash
   curl http://localhost:3001/health
   ```

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Related Documentation

- [Client Integration Guide](../../docs/CLIENT_INTEGRATION.md)
- [API Quick Reference](../../docs/API_QUICK_REFERENCE.md)
- [Claude API Documentation](https://docs.anthropic.com)
- [Stacks Documentation](https://docs.stacks.co)
