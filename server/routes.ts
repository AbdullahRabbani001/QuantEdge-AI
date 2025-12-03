import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTradeSchema, insertChatLogSchema } from "@shared/schema";
import {
  fetchTopCoins,
  fetchCoinData,
  fetchOHLCData,
  klinesToOHLC,
  extractPriceVolume,
  fetchCurrentPrice,
  symbolToCoinGeckoId
} from "./lib/marketData";
import { calculateQuantScore, calculateMarketRegime } from "./lib/quant/scoring";
import { exponentialMovingAverage } from "./lib/quant/statistics";

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🚀 Running in local development mode (no authentication)');

  // Mock user ID for local development
  const MOCK_USER_ID = 'local-dev-user';

  // ============================================
  // AUTH ROUTES
  // ============================================
  app.get('/api/login', async (req: any, res) => {
    // Local development mode - auto login
    // Just redirect to home, the /api/auth/user will handle user creation
    res.redirect('/');
  });

  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Return or create mock user for local development
      let user = await storage.getUser(MOCK_USER_ID);
      if (!user) {
        await storage.upsertUser({
          id: MOCK_USER_ID,
          email: 'dev@localhost',
          firstName: 'Local',
          lastName: 'Developer',
          profileImageUrl: null,
        });
        user = await storage.getUser(MOCK_USER_ID);
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============================================
  // MARKET DATA ROUTES
  // ============================================

  /**
   * GET /api/markets
   * Fetch top crypto coins with market data
   */
  app.get("/api/markets", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const coins = await fetchTopCoins(limit);
      res.json(coins);
    } catch (error) {
      console.error("Error in /api/markets:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  /**
   * GET /api/coin/:symbol
   * Fetch detailed coin information
   */
  app.get("/api/coin/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const coinId = symbolToCoinGeckoId(symbol);
      const coinData = await fetchCoinData(coinId);

      if (!coinData) {
        return res.status(404).json({ error: "Coin not found" });
      }

      res.json(coinData);
    } catch (error) {
      console.error(`Error in /api/coin/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to fetch coin data" });
    }
  });

  /**
   * GET /api/price/:symbol
   * Get current price for a symbol using direct fetch with fallbacks
   */
  app.get("/api/price/:symbol", async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const price = await fetchCurrentPrice(symbol);

      if (!price) {
        return res.status(404).json({ error: "Coin not found" });
      }

      res.json({
        symbol: symbol,
        price: price
      });
    } catch (error) {
      console.error(`Error fetching price for ${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to fetch price" });
    }
  });

  /**
   * GET /api/klines/:symbol
   * Fetch OHLC candlestick data
   */
  app.get("/api/klines/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = (req.query.interval as '1h' | '4h' | '1d' | '1w') || '1d';
      const limit = parseInt(req.query.limit as string) || 100;

      const klines = await fetchOHLCData(symbol, interval, limit);
      res.json(klines);
    } catch (error) {
      console.error(`Error in /api/klines/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to fetch kline data" });
    }
  });

  // ============================================
  // QUANT ANALYSIS ROUTES
  // ============================================

  /**
   * GET /api/quant/score/:symbol
   * Calculate multi-factor quant score
   */
  app.get("/api/quant/score/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = (req.query.interval as '1h' | '4h' | '1d' | '1w') || '1d';

      // Fetch market data
      const klines = await fetchOHLCData(symbol, interval, 200);

      if (klines.length === 0) {
        return res.status(404).json({ error: "No data available for symbol" });
      }

      const ohlc = klinesToOHLC(klines);
      const { closes, volumes, highs, lows } = extractPriceVolume(klines);

      // Calculate quant score (sentiment defaults to 50)
      const score = calculateQuantScore(symbol.toUpperCase(), closes, ohlc, volumes, 50);

      // Save to database
      await storage.createQuantSignal({
        symbol: symbol.toUpperCase(),
        score: score.score,
        signal: score.signal,
        confidence: score.confidence,
        factors: score.factors as any,
        explanation: score.explanation,
      });

      res.json(score);
    } catch (error) {
      console.error(`Error in /api/quant/score/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to calculate quant score" });
    }
  });

  /**
   * GET /api/quant/signals
   * Fetch recent quant signals from database
   */
  app.get("/api/quant/signals", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const signals = await storage.getRecentQuantSignals(limit);
      res.json(signals);
    } catch (error) {
      console.error("Error in /api/quant/signals:", error);
      res.status(500).json({ error: "Failed to fetch quant signals" });
    }
  });

  /**
   * GET /api/regime
   * Calculate market regime
   */
  app.get("/api/regime", async (req, res) => {
    try {
      // Use BTC as benchmark
      const klines = await fetchOHLCData('BTC', '1d', 300);

      if (klines.length === 0) {
        return res.status(500).json({ error: "Failed to fetch BTC data" });
      }

      const ohlc = klinesToOHLC(klines);
      const { closes } = extractPriceVolume(klines);

      // Calculate 200 EMA
      const ema200 = exponentialMovingAverage(closes, 200);

      // Calculate regime
      const regime = calculateMarketRegime(closes, ohlc, ema200);

      // Save to database
      await storage.createRegimeLog({
        regime: regime.regime,
        volatility: regime.volatility,
        trendStrength: regime.trendStrength,
        confidence: regime.confidence,
        explanation: regime.explanation,
      });

      res.json(regime);
    } catch (error) {
      console.error("Error in /api/regime:", error);
      res.status(500).json({ error: "Failed to calculate market regime" });
    }
  });

  // ============================================
  // PORTFOLIO ROUTES
  // ============================================

  /**
   * GET /api/portfolio
   * Get authenticated user's portfolio with all trades
   */
  app.get("/api/portfolio", async (req: any, res) => {
    try {
      const userId = MOCK_USER_ID;

      // Get user's portfolios
      const portfolios = await storage.getPortfoliosByUserId(userId);

      if (portfolios.length === 0) {
        // Create default portfolio
        const portfolio = await storage.createPortfolio({
          userId,
          name: "Default Portfolio",
        });

        return res.json({
          portfolio,
          trades: [],
          holdings: {},
          totalValue: 0,
        });
      }

      // Get trades for first portfolio
      const portfolio = portfolios[0];
      const trades = await storage.getTradesByPortfolioId(portfolio.id);

      // Calculate holdings
      const holdings: Record<string, { quantity: number; avgEntry: number }> = {};

      for (const trade of trades) {
        const symbol = trade.symbol;
        const quantity = parseFloat(trade.quantity);
        const price = parseFloat(trade.buyPrice);

        if (!holdings[symbol]) {
          holdings[symbol] = { quantity: 0, avgEntry: 0 };
        }

        if (trade.side === 'buy') {
          const prevTotal = holdings[symbol].quantity * holdings[symbol].avgEntry;
          holdings[symbol].quantity += quantity;
          holdings[symbol].avgEntry = (prevTotal + quantity * price) / holdings[symbol].quantity;
        } else {
          holdings[symbol].quantity -= quantity;
        }
      }

      // Get realized PnL logs
      const realizedPnlLogs = await storage.getRealizedPnlLogsByPortfolioId(portfolio.id);
      const totalRealizedPnl = realizedPnlLogs.reduce((sum, log) => sum + parseFloat(log.realizedPnl), 0);

      // Calculate total value and unrealized PnL (fetch current prices)
      let totalValue = 0;
      let totalUnrealizedPnl = 0;
      const holdingsWithValue = [];

      for (const [symbol, data] of Object.entries(holdings)) {
        if (data.quantity > 0) {
          const currentPrice = await fetchCurrentPrice(symbol) || data.avgEntry;
          const value = data.quantity * currentPrice;
          const unrealizedPnl = (currentPrice - data.avgEntry) * data.quantity;

          totalValue += value;
          totalUnrealizedPnl += unrealizedPnl;

          holdingsWithValue.push({
            symbol,
            quantity: data.quantity,
            avgEntry: data.avgEntry,
            currentPrice,
            value,
            unrealizedPnl,
            pnlPercent: ((currentPrice - data.avgEntry) / data.avgEntry) * 100,
          });
        }
      }

      res.json({
        portfolio,
        trades,
        holdings: holdingsWithValue,
        totalValue,
        realizedPnl: totalRealizedPnl,
        unrealizedPnl: totalUnrealizedPnl,
        totalPnl: totalRealizedPnl + totalUnrealizedPnl,
        realizedPnlLogs,
      });
    } catch (error) {
      console.error(`Error in /api/portfolio/${req.params.userId}:`, error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  /**
   * POST /api/portfolio/trade
   * Add a new trade (buy or sell)
   */
  app.post("/api/portfolio/trade", async (req, res) => {
    try {
      const validated = insertTradeSchema.parse(req.body);

      // If it's a sell trade, calculate realized PnL
      if (validated.side === 'sell') {
        // Get portfolio to find avg entry price
        const trades = await storage.getTradesByPortfolioId(validated.portfolioId);
        const holdings: Record<string, { quantity: number; avgEntry: number }> = {};

        // Calculate current holdings and avg entry
        for (const trade of trades) {
          const symbol = trade.symbol;
          const quantity = parseFloat(trade.quantity);
          const price = parseFloat(trade.buyPrice);

          if (!holdings[symbol]) {
            holdings[symbol] = { quantity: 0, avgEntry: 0 };
          }

          if (trade.side === 'buy') {
            const prevTotal = holdings[symbol].quantity * holdings[symbol].avgEntry;
            holdings[symbol].quantity += quantity;
            holdings[symbol].avgEntry = (prevTotal + quantity * price) / holdings[symbol].quantity;
          } else {
            holdings[symbol].quantity -= quantity;
          }
        }

        const holding = holdings[validated.symbol];
        if (!holding || holding.quantity < parseFloat(validated.quantity)) {
          return res.status(400).json({ error: "Insufficient quantity to sell" });
        }

        // Calculate realized PnL
        const sellPrice = parseFloat(validated.buyPrice); // buyPrice field holds sell price for sell trades
        const quantity = parseFloat(validated.quantity);
        const realizedPnl = (sellPrice - holding.avgEntry) * quantity;

        // Create sell trade
        const trade = await storage.createTrade(validated);

        // Log realized PnL
        await storage.createRealizedPnlLog({
          portfolioId: validated.portfolioId,
          symbol: validated.symbol,
          quantity: validated.quantity,
          buyPrice: holding.avgEntry.toString(),
          sellPrice: sellPrice.toString(),
          realizedPnl: realizedPnl.toString(),
          tradeId: trade.id,
        });

        return res.json(trade);
      }

      // Regular buy trade
      const trade = await storage.createTrade(validated);
      res.json(trade);
    } catch (error: any) {
      console.error("Error in /api/portfolio/trade:", error);
      res.status(400).json({ error: error.message || "Failed to add trade" });
    }
  });

  /**
   * DELETE /api/portfolio/trade/:id
   * Delete a trade
   */
  app.delete("/api/portfolio/trade/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrade(id);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error in /api/portfolio/trade/${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete trade" });
    }
  });

  // ============================================
  // CHAT ROUTES
  // ============================================

  /**
   * POST /api/chat
   * AI chatbot with Grok sentiment + GPT signals + Quant analysis
   */
  app.post("/api/chat", async (req: any, res) => {
    try {
      const { message } = req.body;
      const userId = MOCK_USER_ID;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Import AI chat functions
      const { processAIChat, getMarketRegimeAnalysis } = await import('./lib/aiChat');

      let response: string;

      // Check if asking about market regime
      if (message.toLowerCase().includes('regime') ||
        message.toLowerCase().includes('overall market') ||
        message.toLowerCase().includes('market condition')) {
        response = await getMarketRegimeAnalysis();
      } else {
        // Process with AI (Grok + GPT + Quant)
        response = await processAIChat(message);
      }

      // Save to database
      if (userId) {
        await storage.createChatLog({
          userId,
          message,
          response,
        });
      }

      res.json({ response });
    } catch (error) {
      console.error("Error in /api/chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
