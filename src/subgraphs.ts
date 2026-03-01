export interface SubgraphConfig {
  name: string;
  ipfsHash: string;
  description: string;
  keyEntities: string[];
}

export const SUBGRAPHS: Record<string, SubgraphConfig> = {
  main: {
    name: "Main",
    ipfsHash: "QmdyCguLEisTtQFveEkvMhTH7UzjyhnrF9kpvhYeG4QX8a",
    description:
      "Complete Polymarket ecosystem data including markets, conditions, FPMMs, trading, and liquidity provision.",
    keyEntities: [
      "Global",
      "Account",
      "Condition",
      "FixedProductMarketMaker",
      "MarketData",
      "MarketPosition",
      "Transaction",
      "OrderFilledEvent",
    ],
  },
  beefy_pnl: {
    name: "Beefy Profit and Loss",
    ipfsHash: "QmbHwcGkumWdyTK2jYWXV3vX4WyinftEGbuwi7hDkhPWqG",
    description:
      "Comprehensive P&L tracking with performance analytics including win rate, profit factor, max drawdown, and daily stats.",
    keyEntities: [
      "Global",
      "Account",
      "Condition",
      "Market",
      "MarketPosition",
      "MarketProfit",
      "Transaction",
      "DailyStats",
    ],
  },
  slimmed_pnl: {
    name: "Slimmed P&L",
    ipfsHash: "QmZAYiMeZiWC7ZjdWepek7hy1jbcW3ngimBF9ibTiTtwQU",
    description:
      "Minimal schema focused on essential user position data with buy/sell amounts and realized P&L.",
    keyEntities: ["UserPosition", "NegRiskEvent", "Condition", "FPMM"],
  },
  activity: {
    name: "Activity",
    ipfsHash: "Qmf3qPUsfQ8et6E3QNBmuXXKqUJi91mo5zbsaTkQrSnMAP",
    description:
      "Lightweight activity and event logging for position management operations (splits, merges, redemptions).",
    keyEntities: [
      "Split",
      "Merge",
      "Redemption",
      "NegRiskConversion",
      "NegRiskEvent",
      "Condition",
    ],
  },
  orderbook: {
    name: "Orderbook",
    ipfsHash: "QmVGA9vvNZtEquVzDpw8wnTFDxVjB6mavTRMTrKuUBhi4t",
    description:
      "Orderbook-specific trading data with enhanced analytics, order fills, and per-market/per-account statistics.",
    keyEntities: [
      "Global",
      "Account",
      "MarketData",
      "OrderFilledEvent",
      "OrdersMatchedEvent",
      "Orderbook",
    ],
  },
};

export const SUBGRAPH_NAMES = Object.keys(SUBGRAPHS) as [string, ...string[]];
