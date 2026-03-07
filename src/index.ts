#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { querySubgraph } from "./graphClient.js";
import { SUBGRAPHS, SUBGRAPH_NAMES } from "./subgraphs.js";

const server = new McpServer({
  name: "graph-polymarket-mcp",
  version: "1.3.0",
});

// Helper to format tool responses
function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Tool 1: list_subgraphs
// ---------------------------------------------------------------------------
server.registerTool(
  "list_subgraphs",
  {
    description: "List all available Polymarket subgraphs with descriptions and key entities",
  },
  async () => {
    const list = Object.entries(SUBGRAPHS).map(([key, cfg]) => ({
      id: key,
      name: cfg.name,
      ipfsHash: cfg.ipfsHash,
      description: cfg.description,
      keyEntities: cfg.keyEntities,
    }));
    return textResult(list);
  }
);

// ---------------------------------------------------------------------------
// Tool 2: get_subgraph_schema
// ---------------------------------------------------------------------------
server.registerTool(
  "get_subgraph_schema",
  {
    description: "Get the full GraphQL schema (introspection) for a Polymarket subgraph",
    inputSchema: {
      subgraph: z
        .enum(SUBGRAPH_NAMES)
        .describe("Subgraph identifier: main, beefy_pnl, slimmed_pnl, activity, or orderbook"),
    },
  },
  async ({ subgraph }) => {
    try {
      const cfg = SUBGRAPHS[subgraph];
      const introspectionQuery = `{
        __schema {
          types {
            name
            kind
            fields {
              name
              type { name kind ofType { name kind } }
            }
          }
        }
      }`;
      const data = await querySubgraph(cfg.ipfsHash, introspectionQuery);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 3: query_subgraph
// ---------------------------------------------------------------------------
server.registerTool(
  "query_subgraph",
  {
    description: "Execute a custom GraphQL query against a Polymarket subgraph",
    inputSchema: {
      subgraph: z
        .enum(SUBGRAPH_NAMES)
        .describe("Subgraph identifier: main, beefy_pnl, slimmed_pnl, activity, or orderbook"),
      query: z.string().describe("GraphQL query string"),
      variables: z
        .record(z.unknown())
        .optional()
        .describe("Optional GraphQL variables as key-value pairs"),
    },
  },
  async ({ subgraph, query, variables }) => {
    try {
      const cfg = SUBGRAPHS[subgraph];
      const data = await querySubgraph(cfg.ipfsHash, query, variables);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 4: get_market_data
// ---------------------------------------------------------------------------
server.registerTool(
  "get_market_data",
  {
    description: "Get Polymarket market/condition data including outcomes and volumes from the Main subgraph",
    inputSchema: {
      first: z.number().min(1).max(100).default(10).describe("Number of markets to return (1-100)"),
      orderBy: z.string().default("id").describe("Field to order by"),
      orderDirection: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
    },
  },
  async ({ first, orderBy, orderDirection }) => {
    try {
      const query = `{
        conditions(first: ${first}, orderBy: ${orderBy}, orderDirection: ${orderDirection}) {
          id
          oracle
          questionId
          outcomeSlotCount
          resolutionTimestamp
          payoutNumerators
          payoutDenominator
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.main.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 5: get_account_pnl
// ---------------------------------------------------------------------------
server.registerTool(
  "get_account_pnl",
  {
    description: "Get a trader's P&L and performance metrics from the Beefy P&L subgraph",
    inputSchema: {
      account: z.string().describe("Ethereum address of the trader (lowercase)"),
    },
  },
  async ({ account }) => {
    try {
      const query = `{
        account(id: "${account.toLowerCase()}") {
          id
          creationTimestamp
          lastTradedTimestamp
          isActive
          numTrades
          collateralVolume
          totalRealizedPnl
          totalUnrealizedPnl
          totalFeesPaid
          winRate
          profitFactor
          maxDrawdown
          numWinningPositions
          numLosingPositions
          totalProfitsSum
          totalLossesSum
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.beefy_pnl.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 6: get_user_positions
// ---------------------------------------------------------------------------
server.registerTool(
  "get_user_positions",
  {
    description:
      "Get a user's current positions from the Slimmed P&L subgraph. Falls back gracefully if indexers are behind.",
    inputSchema: {
      account: z.string().describe("Ethereum address of the user (lowercase)"),
    },
  },
  async ({ account }) => {
    try {
      const query = `{
        userPositions(where: { user: "${account.toLowerCase()}" }, first: 100) {
          id
          user
          tokenId
          amount
          avgPrice
          realizedPnl
          totalBought
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.slimmed_pnl.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 7: get_recent_activity
// ---------------------------------------------------------------------------
server.registerTool(
  "get_recent_activity",
  {
    description: "Get recent splits, merges, and redemptions from the Activity subgraph",
    inputSchema: {
      first: z.number().min(1).max(100).default(20).describe("Number of events to return"),
      account: z.string().optional().describe("Optional: filter by Ethereum address"),
    },
  },
  async ({ first, account }) => {
    try {
      const stakeholderWhere = account
        ? `, where: { stakeholder: "${account.toLowerCase()}" }`
        : "";
      const redeemerWhere = account
        ? `, where: { redeemer: "${account.toLowerCase()}" }`
        : "";
      const query = `{
        splits(first: ${first}, orderBy: timestamp, orderDirection: desc${stakeholderWhere}) {
          id
          stakeholder
          amount
          timestamp
        }
        merges(first: ${first}, orderBy: timestamp, orderDirection: desc${stakeholderWhere}) {
          id
          stakeholder
          amount
          timestamp
        }
        redemptions(first: ${first}, orderBy: timestamp, orderDirection: desc${redeemerWhere}) {
          id
          redeemer
          payout
          indexSets
          timestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.activity.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 8: get_orderbook_trades
// ---------------------------------------------------------------------------
server.registerTool(
  "get_orderbook_trades",
  {
    description: "Get recent order fills from the Orderbook subgraph",
    inputSchema: {
      first: z.number().min(1).max(100).default(20).describe("Number of trades to return"),
      maker: z.string().optional().describe("Optional: filter by maker address"),
      taker: z.string().optional().describe("Optional: filter by taker address"),
    },
  },
  async ({ first, maker, taker }) => {
    try {
      const filters: string[] = [];
      if (maker) filters.push(`maker: "${maker.toLowerCase()}"`);
      if (taker) filters.push(`taker: "${taker.toLowerCase()}"`);
      const where = filters.length > 0 ? `, where: { ${filters.join(", ")} }` : "";

      const query = `{
        orderFilledEvents(first: ${first}, orderBy: timestamp, orderDirection: desc${where}) {
          id
          maker
          taker
          makerAssetId
          takerAssetId
          makerAmountFilled
          takerAmountFilled
          fee
          price
          side
          timestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.orderbook.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 9: get_global_stats
// ---------------------------------------------------------------------------
server.registerTool(
  "get_global_stats",
  {
    description:
      "Get aggregate Polymarket platform statistics. Combines market counts from the Main subgraph with accurate volume/fee/trade data from the Orderbook subgraph.",
  },
  async () => {
    try {
      // Main subgraph: reliable for condition/trader counts
      const mainQuery = `{
        globals {
          id
          numConditions
          numOpenConditions
          numClosedConditions
          numTraders
        }
      }`;
      // Orderbook subgraph: authoritative source for volume (main Global has zeroed volume fields)
      const orderbookQuery = `{
        ordersMatchedGlobals(first: 1) {
          id
          tradesQuantity
          buysQuantity
          sellsQuantity
          collateralVolume
          scaledCollateralVolume
          collateralBuyVolume
          scaledCollateralBuyVolume
          collateralSellVolume
          scaledCollateralSellVolume
          totalFees
          averageTradeSize
        }
      }`;
      const [mainData, orderbookData] = await Promise.all([
        querySubgraph(SUBGRAPHS.main.ipfsHash, mainQuery),
        querySubgraph(SUBGRAPHS.orderbook.ipfsHash, orderbookQuery),
      ]);
      return textResult({ markets: mainData, volume: orderbookData });
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 10: get_daily_stats
// ---------------------------------------------------------------------------
server.registerTool(
  "get_daily_stats",
  {
    description:
      "Get daily platform statistics from the Beefy P&L subgraph: volume, fees, trader counts, and market activity per day. Use this for trend analysis and historical performance.",
    inputSchema: {
      days: z.number().min(1).max(90).default(7).describe("Number of recent days to return (1-90)"),
    },
  },
  async ({ days }) => {
    try {
      const query = `{
        dailyStats_collection(first: ${days}, orderBy: date, orderDirection: desc) {
          id
          date
          volume
          fees
          numTraders
          numNewMarkets
          numResolvedMarkets
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.beefy_pnl.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 11: get_top_traders
// ---------------------------------------------------------------------------
server.registerTool(
  "get_top_traders",
  {
    description:
      "Get the top Polymarket traders ranked by realized P&L, win rate, or volume from the Beefy P&L subgraph.",
    inputSchema: {
      first: z.number().min(1).max(100).default(10).describe("Number of traders to return (1-100)"),
      orderBy: z
        .enum(["totalRealizedPnl", "collateralVolume", "winRate", "profitFactor", "numTrades"])
        .default("totalRealizedPnl")
        .describe("Metric to rank traders by"),
      minTrades: z
        .number()
        .min(1)
        .default(10)
        .describe("Minimum number of trades to filter out inactive accounts"),
    },
  },
  async ({ first, orderBy, minTrades }) => {
    try {
      const query = `{
        accounts(
          first: ${first},
          orderBy: ${orderBy},
          orderDirection: desc,
          where: { numTrades_gte: "${minTrades}" }
        ) {
          id
          numTrades
          collateralVolume
          totalRealizedPnl
          totalUnrealizedPnl
          totalFeesPaid
          winRate
          profitFactor
          maxDrawdown
          numWinningPositions
          numLosingPositions
          lastTradedTimestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.beefy_pnl.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 12: get_market_positions
// ---------------------------------------------------------------------------
server.registerTool(
  "get_market_positions",
  {
    description:
      "Get the top positions for a specific market token from the Beefy P&L subgraph. Shows who holds the largest positions and their P&L.",
    inputSchema: {
      tokenId: z
        .string()
        .describe(
          "The outcome token ID (large integer string from orderbook takerAssetId/makerAssetId)"
        ),
      first: z.number().min(1).max(100).default(20).describe("Number of positions to return"),
      orderBy: z
        .enum(["realizedPnl", "unrealizedPnl", "valueBought"])
        .default("valueBought")
        .describe("Field to sort by"),
    },
  },
  async ({ tokenId, first, orderBy }) => {
    try {
      const query = `{
        marketPositions(
          first: ${first},
          orderBy: ${orderBy},
          orderDirection: desc,
          where: { id_contains: "${tokenId}" }
        ) {
          id
          realizedPnl
          unrealizedPnl
          valueBought
          valueSold
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.beefy_pnl.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 13: get_market_open_interest
// ---------------------------------------------------------------------------
server.registerTool(
  "get_market_open_interest",
  {
    description:
      "Get the top Polymarket markets ranked by open interest (USDC locked in outstanding positions). This data is unique to the Open Interest subgraph — no other Polymarket subgraph tracks OI.",
    inputSchema: {
      first: z.number().min(1).max(100).default(10).describe("Number of markets to return (1-100)"),
      orderBy: z
        .enum(["amount", "splitCount", "mergeCount", "lastUpdatedTimestamp"])
        .default("amount")
        .describe("Field to rank markets by"),
      orderDirection: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
    },
  },
  async ({ first, orderBy, orderDirection }) => {
    try {
      const query = `{
        marketOpenInterests(first: ${first}, orderBy: ${orderBy}, orderDirection: ${orderDirection}) {
          id
          conditionId
          amount
          amountRaw
          splitCount
          mergeCount
          redemptionCount
          createdAtTimestamp
          lastUpdatedTimestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.open_interest.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 14: get_oi_history
// ---------------------------------------------------------------------------
server.registerTool(
  "get_oi_history",
  {
    description:
      "Get hourly open interest snapshots for a specific Polymarket market. Use this to chart OI trends over time. The conditionId can be obtained from get_market_open_interest or the main subgraph.",
    inputSchema: {
      conditionId: z.string().describe("The conditionId (hex string) of the market"),
      first: z.number().min(1).max(1000).default(168).describe("Number of hourly snapshots to return (default 168 = 1 week)"),
      orderDirection: z.enum(["asc", "desc"]).default("desc").describe("Sort direction by timestamp"),
    },
  },
  async ({ conditionId, first, orderDirection }) => {
    try {
      const query = `{
        oisnapshots(
          first: ${first},
          orderBy: timestamp,
          orderDirection: ${orderDirection},
          where: { market: "${conditionId.toLowerCase()}" }
        ) {
          id
          amount
          amountRaw
          blockNumber
          timestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.open_interest.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tool 15: get_global_open_interest
// ---------------------------------------------------------------------------
server.registerTool(
  "get_global_open_interest",
  {
    description:
      "Get the total open interest across all Polymarket markets — the aggregate USDC locked in outstanding positions platform-wide.",
  },
  async () => {
    try {
      const query = `{
        globalOpenInterests(first: 1) {
          id
          amount
          amountRaw
          marketCount
          lastUpdatedBlock
          lastUpdatedTimestamp
        }
      }`;
      const data = await querySubgraph(SUBGRAPHS.open_interest.ipfsHash, query);
      return textResult(data);
    } catch (error) {
      return errorResult(error);
    }
  }
);

// ---------------------------------------------------------------------------
// MCP Prompts - guided workflows for agents
// ---------------------------------------------------------------------------
server.registerPrompt(
  "analyze_trader",
  {
    description: "Analyze a Polymarket trader's full profile: P&L, positions, and recent activity",
    argsSchema: { address: z.string().describe("Ethereum address of the trader") },
  },
  ({ address }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze the Polymarket trader at address ${address}. Follow these steps:
1. Use get_account_pnl to get their P&L metrics and performance stats
2. Use get_user_positions to see their current open positions
3. Use get_orderbook_trades with the maker parameter to see their recent trades
4. Use get_recent_activity with the account parameter to check splits/merges/redemptions
5. Summarize: overall profitability, win rate, active positions, and trading patterns`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "market_overview",
  {
    description: "Get a comprehensive overview of Polymarket platform activity",
    argsSchema: {},
  },
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Give me a comprehensive Polymarket overview. Follow these steps:
1. Use get_global_stats to get platform-wide metrics (market counts from main + real volume from orderbook)
2. Use get_daily_stats with days=7 to see the last week of volume, fees, and trader trends
3. Use get_orderbook_trades with first=10 to see the most recent trades
4. Use get_top_traders with first=5 orderBy=totalRealizedPnl to identify leading traders
5. Summarize: total volume, active markets, daily trends, recent trades, and top performers`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "explore_subgraph",
  {
    description: "Explore a specific Polymarket subgraph's schema and sample data",
    argsSchema: {
      subgraph: z.string().describe("Subgraph id: main, beefy_pnl, slimmed_pnl, activity, orderbook, or open_interest"),
    },
  },
  ({ subgraph }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Help me explore the "${subgraph}" Polymarket subgraph. Follow these steps:
1. Use list_subgraphs to show what this subgraph contains and note any caveats
2. Use query_subgraph with subgraph="${subgraph}" to run this introspection: { __schema { queryType { fields { name } } } }
3. Pick 2-3 of the most interesting query fields and fetch sample data with query_subgraph
4. Explain what kinds of questions this subgraph can answer and any known limitations

Working example queries by subgraph:
- main: { conditions(first: 5, orderBy: id, orderDirection: desc) { id oracle questionId outcomeSlotCount resolutionTimestamp payoutNumerators } }
- beefy_pnl: { accounts(first: 5, orderBy: totalRealizedPnl, orderDirection: desc, where: { numTrades_gte: "10" }) { id winRate profitFactor totalRealizedPnl numTrades } }
- beefy_pnl daily: { dailyStats_collection(first: 7, orderBy: date, orderDirection: desc) { id date volume fees numTraders } }
- orderbook: { ordersMatchedGlobals(first: 1) { tradesQuantity collateralVolume totalFees averageTradeSize } }
- orderbook fills: { orderFilledEvents(first: 5, orderBy: timestamp, orderDirection: desc) { maker taker price side fee timestamp } }
- activity: { splits(first: 5, orderBy: timestamp, orderDirection: desc) { stakeholder amount timestamp } }
- open_interest: { marketOpenInterests(first: 5, orderBy: amount, orderDirection: desc) { id amount splitCount mergeCount lastUpdatedTimestamp } }
- open_interest global: { globalOpenInterests(first: 1) { amount marketCount lastUpdatedTimestamp } }
- open_interest history: { oisnapshots(first: 24, orderBy: timestamp, orderDirection: desc, where: { market: "0x..." }) { amount timestamp } }`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "daily_trends",
  {
    description: "Analyze Polymarket daily trading trends over a time period",
    argsSchema: {
      days: z.string().default("30").describe("Number of days to analyze (e.g. 7, 30, 90)"),
    },
  },
  ({ days }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze Polymarket trading trends over the last ${days} days. Follow these steps:
1. Use get_daily_stats with days=${days} to get daily volume, fees, trader counts, and market activity
2. Identify: highest and lowest volume days, trend direction (growing/declining), average daily volume
3. Use get_global_stats to compare daily averages against all-time totals
4. Use get_top_traders with orderBy=collateralVolume to see the most active traders driving volume
5. Summarize key trends, anomalies, and what they suggest about platform health`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "oi_analysis",
  {
    description: "Analyze Polymarket open interest — which markets have the most capital locked in and how OI is trending",
    argsSchema: {},
  },
  () => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze Polymarket open interest. Follow these steps:
1. Use get_global_open_interest to get total platform OI and market count
2. Use get_market_open_interest with first=10 to find the top 10 markets by OI
3. For the top 2-3 markets, use get_oi_history with their conditionIds to see how OI has trended
4. Use get_market_data from the main subgraph to cross-reference conditionIds with market details (oracle, questionId, resolution status)
5. Summarize: total platform OI, top markets by capital locked, OI trends (growing/declining), and any notable patterns`,
        },
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Graph Polymarket MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
