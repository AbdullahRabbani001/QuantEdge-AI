import { LucideIcon, Activity, TrendingUp, TrendingDown, DollarSign, BarChart2, Zap, AlertTriangle } from "lucide-react";

export interface Coin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  regime: "Bull" | "Bear" | "Sideways";
  volatility: "High" | "Normal" | "Low";
  score: number; // 0-100
}

export interface PortfolioItem {
  symbol: string;
  amount: number;
  avgEntry: number;
  currentPrice: number;
}

export const MOCK_COINS: Coin[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    price: 64231.50,
    change24h: 2.4,
    volume: 32000000000,
    marketCap: 1200000000000,
    regime: "Bull",
    volatility: "Normal",
    score: 78,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    price: 3452.12,
    change24h: -1.2,
    volume: 15000000000,
    marketCap: 400000000000,
    regime: "Sideways",
    volatility: "Low",
    score: 65,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    price: 145.60,
    change24h: 5.6,
    volume: 4000000000,
    marketCap: 65000000000,
    regime: "Bull",
    volatility: "High",
    score: 88,
  },
  {
    id: "binancecoin",
    name: "BNB",
    symbol: "BNB",
    price: 590.20,
    change24h: 0.5,
    volume: 1200000000,
    marketCap: 87000000000,
    regime: "Sideways",
    volatility: "Low",
    score: 60,
  },
  {
    id: "ripple",
    name: "XRP",
    symbol: "XRP",
    price: 0.62,
    change24h: -0.8,
    volume: 1100000000,
    marketCap: 34000000000,
    regime: "Bear",
    volatility: "Normal",
    score: 42,
  },
];

export const MOCK_PORTFOLIO: PortfolioItem[] = [
  { symbol: "BTC", amount: 0.5, avgEntry: 55000, currentPrice: 64231.50 },
  { symbol: "ETH", amount: 5.0, avgEntry: 2800, currentPrice: 3452.12 },
  { symbol: "SOL", amount: 100, avgEntry: 80, currentPrice: 145.60 },
];

export const MARKET_REGIME = {
  regime: "Bull",
  volatility: "Elevated",
  trendStrength: 72, // 0-100
  confidence: 85,
  explanation: "Major indices trading above 200 EMA with positive momentum divergence. Volatility is expanding, suggesting strong trend continuation.",
};

export const CHAT_MESSAGES = [
  { role: "system", content: "QuantEdge-AI System initialized. Ask me about market regimes, specific coins, or portfolio risk." },
  { role: "user", content: "What is the current market regime?" },
  { role: "assistant", content: "The market is currently in a **Bull Regime** with elevated volatility. Trend strength is at 72/100. Bitcoin is leading the charge with a 2.4% gain today. Recommendation: Maintain long exposure but tighten stops due to volatility." },
];
