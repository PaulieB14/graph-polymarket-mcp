# graph-polymarket-mcp

[![npm version](https://img.shields.io/npm/v/graph-polymarket-mcp)](https://www.npmjs.com/package/graph-polymarket-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-published-blue)](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.PaulieB14/graph-polymarket-mcp)
[![Glama](https://glama.ai/mcp/servers/@PaulieB14/graph-polymarket-mcp/badge)](https://glama.ai/mcp/servers/@PaulieB14/graph-polymarket-mcp)

MCP server for querying [Polymarket](https://polymarket.com/) prediction market data via [The Graph](https://thegraph.com/) subgraphs.

Exposes 9 tools that AI agents (Claude, Cursor, etc.) can use to query market data, trader P&L, positions, activity, and orderbook trades.

> Published to the [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.PaulieB14/graph-polymarket-mcp) as `io.github.PaulieB14/graph-polymarket-mcp`

## Prerequisites

You need a **free** Graph API key (takes ~2 minutes):

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Connect your wallet (MetaMask, WalletConnect, etc.)
3. Click **"API Keys"** in the sidebar and create one
4. Free tier includes 100,000 queries/month

## Installation

```bash
npm install -g graph-polymarket-mcp
```

Or use directly with npx:

```bash
npx graph-polymarket-mcp
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "graph-polymarket": {
      "command": "npx",
      "args": ["-y", "graph-polymarket-mcp"],
      "env": {
        "GRAPH_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add graph-polymarket -- npx -y graph-polymarket-mcp
```

Set the environment variable `GRAPH_API_KEY` before running.

### Cursor / Other MCP Clients

Use the stdio transport with `npx graph-polymarket-mcp` as the command, passing `GRAPH_API_KEY` as an environment variable.

## Available Tools

### Core Tools

| Tool | Description |
|------|-------------|
| `list_subgraphs` | List all available Polymarket subgraphs with descriptions and key entities |
| `get_subgraph_schema` | Get the full GraphQL schema for a specific subgraph |
| `query_subgraph` | Execute a custom GraphQL query against any subgraph |

### Domain-Specific Tools

| Tool | Description | Subgraph |
|------|-------------|----------|
| `get_market_data` | Get market/condition data with outcomes and volumes | Main |
| `get_account_pnl` | Get a trader's P&L and performance metrics | Beefy P&L |
| `get_user_positions` | Get a user's current positions | Slimmed P&L |
| `get_recent_activity` | Get recent splits, merges, and redemptions | Activity |
| `get_orderbook_trades` | Get recent order fills | Orderbook |
| `get_global_stats` | Get aggregate platform statistics | Main |

## Subgraphs

| Name | IPFS Hash | Description |
|------|-----------|-------------|
| Main | `QmdyCguLEisTtQFveEkvMhTH7UzjyhnrF9kpvhYeG4QX8a` | Complete ecosystem data |
| Beefy P&L | `QmbHwcGkumWdyTK2jYWXV3vX4WyinftEGbuwi7hDkhPWqG` | Comprehensive P&L tracking |
| Slimmed P&L | `QmZAYiMeZiWC7ZjdWepek7hy1jbcW3ngimBF9ibTiTtwQU` | Minimal position data |
| Activity | `Qmf3qPUsfQ8et6E3QNBmuXXKqUJi91mo5zbsaTkQrSnMAP` | Position management events |
| Orderbook | `QmVGA9vvNZtEquVzDpw8wnTFDxVjB6mavTRMTrKuUBhi4t` | Order fill analytics |

## Example Queries

Once connected, an AI agent can:

- "What are the current Polymarket global stats?"
- "Show me the latest 20 orderbook trades"
- "What are the positions for address 0x...?"
- "Get the P&L for trader 0x...?"
- "Query the main subgraph for all conditions with more than 100 trades"

## Development

```bash
git clone https://github.com/PaulieB14/graph-polymarket-mcp.git
cd graph-polymarket-mcp
npm install
npm run build
GRAPH_API_KEY=your-key node build/index.js
```

## License

MIT
