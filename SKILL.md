# Graph Polymarket MCP

Query Polymarket prediction market data via The Graph subgraphs — market stats, trader P&L, positions, orderbook trades, open interest, resolution status, and trader profiles.

## Tools

- **list_subgraphs** — List all available Polymarket subgraphs with descriptions and key entities
- **get_subgraph_schema** — Get the full GraphQL schema for a specific subgraph
- **query_subgraph** — Execute a custom GraphQL query against any subgraph
- **get_market_data** — Get market/condition data with outcomes and resolution status
- **get_global_stats** — Platform stats: market counts, volume, fees, trades
- **get_account_pnl** — Trader P&L and performance metrics (winRate, profitFactor, maxDrawdown)
- **get_top_traders** — Leaderboard ranked by PnL, winRate, volume, or profitFactor
- **get_daily_stats** — Daily volume, fees, trader counts, and market activity
- **get_market_positions** — Top holders for a specific outcome token with their P&L
- **get_user_positions** — A user's current token positions
- **get_recent_activity** — Recent splits, merges, and redemptions
- **get_orderbook_trades** — Recent order fills with maker/taker filtering
- **get_market_open_interest** — Top markets ranked by USDC locked in positions
- **get_oi_history** — Hourly OI snapshots for a specific market
- **get_global_open_interest** — Total platform-wide open interest and market count
- **get_market_resolution** — UMA oracle resolution status with filtering
- **get_disputed_markets** — Markets disputed during oracle resolution
- **get_market_revisions** — Moderator interventions and updates on market resolution
- **get_trader_profile** — Full trader profile: first seen, CTF events, USDC flows
- **get_trader_usdc_flows** — USDC deposit/withdrawal history with direction filtering

## Install

```bash
npx graph-polymarket-mcp
```

## Use Cases

- Get real-time Polymarket platform stats, volume, and market rankings
- Analyze trader P&L, performance metrics, and leaderboards
- Track open interest trends and market positions
- Monitor market resolution lifecycle and disputed markets
- Query orderbook trades and position management events
- Run custom GraphQL queries against 8 specialized Polymarket subgraphs
