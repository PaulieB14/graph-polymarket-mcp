#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { querySubgraph } from "./graphClient.js";
import { SUBGRAPHS, SUBGRAPH_NAMES } from "./subgraphs.js";

const server = new McpServer({
  name: "graph-polymarket-mcp",
  version: "1.0.0",
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
server.tool(
  "list_subgraphs",
  "List all available Polymarket subgraphs with descriptions and key entities",
  {},
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
server.tool(
  "get_subgraph_schema",
  "Get the full GraphQL schema (introspection) for a Polymarket subgraph",
  {
    subgraph: z
      .enum(SUBGRAPH_NAMES)
      .describe("Subgraph identifier: main, beefy_pnl, slimmed_pnl, activity, or orderbook"),
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
server.tool(
  "query_subgraph",
  "Execute a custom GraphQL query against a Polymarket subgraph",
  {
    subgraph: z
      .enum(SUBGRAPH_NAMES)
      .describe("Subgraph identifier: main, beefy_pnl, slimmed_pnl, activity, or orderbook"),
    query: z.string().describe("GraphQL query string"),
    variables: z
      .record(z.unknown())
      .optional()
      .describe("Optional GraphQL variables as key-value pairs"),
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
server.tool(
  "get_market_data",
  "Get Polymarket market/condition data including outcomes and volumes from the Main subgraph",
  {
    first: z.number().min(1).max(100).default(10).describe("Number of markets to return (1-100)"),
    orderBy: z.string().default("id").describe("Field to order by"),
    orderDirection: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
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
server.tool(
  "get_account_pnl",
  "Get a trader's P&L and performance metrics from the Beefy P&L subgraph",
  {
    account: z
      .string()
      .describe("Ethereum address of the trader (lowercase)"),
  },
  async ({ account }) => {
    try {
      const query = `{
        account(id: "${account.toLowerCase()}") {
          id
          totalTrades
          totalBuyAmount
          totalSellAmount
          totalFees
          totalProfit
          realizedProfit
          unrealizedProfit
          winRate
          profitFactor
          maxDrawdown
          positions {
            id
            market { id }
            realizedPnl
            unrealizedPnl
            netQuantity
          }
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
server.tool(
  "get_user_positions",
  "Get a user's current positions from the Slimmed P&L subgraph",
  {
    account: z
      .string()
      .describe("Ethereum address of the user (lowercase)"),
  },
  async ({ account }) => {
    try {
      const query = `{
        userPositions(where: { user: "${account.toLowerCase()}" }, first: 100) {
          id
          user
          tokenId
          buyAmount
          sellAmount
          realizedPnl
          netQuantity
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
server.tool(
  "get_recent_activity",
  "Get recent splits, merges, and redemptions from the Activity subgraph",
  {
    first: z.number().min(1).max(100).default(20).describe("Number of events to return"),
    account: z
      .string()
      .optional()
      .describe("Optional: filter by Ethereum address"),
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
          amount
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
server.tool(
  "get_orderbook_trades",
  "Get recent order fills from the Orderbook subgraph",
  {
    first: z.number().min(1).max(100).default(20).describe("Number of trades to return"),
    maker: z.string().optional().describe("Optional: filter by maker address"),
    taker: z.string().optional().describe("Optional: filter by taker address"),
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
server.tool(
  "get_global_stats",
  "Get aggregate Polymarket platform statistics from the Main subgraph",
  {},
  async () => {
    try {
      const query = `{
        globals {
          id
          numConditions
          numOpenConditions
          numClosedConditions
          numTraders
          numTrades
          tradeVolume
          scaledTradeVolume
          totalFees
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
