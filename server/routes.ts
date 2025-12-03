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
import { runQuantEngine, type QuantEngineOutput } from "./lib/quant/engine";
import { quantCache } from "./lib/cache";

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
      const limit = parseInt(req.query.limit as string) || 100;
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
   * GET /api/quant/top50
   * Get quant analysis for top 50 coins
   */
  app.get("/api/quant/top50", async (req, res) => {
    try {
      const interval = (req.query.interval as '1h' | '1d') || '1d';
      const limit = parseInt(req.query.limit as string) || 50;

      console.log(`[quant/top50] Fetching top ${limit} coins with interval ${interval}`);

      // Fetch top coins
      const coins = await fetchTopCoins(limit);
      
      if (!coins || coins.length === 0) {
        console.error("[quant/top50] No coins fetched from CoinGecko");
        return res.status(500).json({ error: "Failed to fetch market data" });
      }

      console.log(`[quant/top50] Fetched ${coins.length} coins, processing quant analysis...`);
      
      // Process each coin in parallel (with rate limiting consideration)
      const results = await Promise.allSettled(
        coins.map(async (coin: any) => {
          const symbol = coin.symbol.toUpperCase();
          const cacheKey = `quant_${symbol}_${interval}`;
          
          // Check cache first, but recalculate if it's a stablecoin to ensure correct score
          const cached = quantCache.get<QuantEngineOutput>(cacheKey);
          const isStablecoinCheck = symbol.includes('USD') && coin.current_price > 0.85 && coin.current_price < 1.15;
          
          // Don't use cache for stablecoins - always recalculate to ensure neutral score
          if (cached && !isStablecoinCheck) {
            console.log(`[quant/top50] Using cached data for ${symbol}`);
            return { ...cached, symbol, currentPrice: coin.current_price };
          }
          
          if (cached && isStablecoinCheck) {
            console.log(`[quant/top50] Stablecoin detected (${symbol}), recalculating to ensure neutral score`);
          }

          try {
            // Fetch OHLC data
            const klines = await fetchOHLCData(symbol, interval, 200);
            if (klines.length === 0) {
              console.warn(`[quant/top50] No OHLC data for ${symbol}`);
              return null;
            }

            const ohlc = klinesToOHLC(klines);
            const { closes, volumes } = extractPriceVolume(klines);

            // Run quant engine
            const result = await runQuantEngine({
              symbol,
              prices: closes,
              ohlc,
              volumes,
              interval,
              sentimentScore: 50 // Default, will be updated with sentiment API
            });

            // Cache for 1 minute
            quantCache.set(cacheKey, result, 60 * 1000);

            // Ensure signal is correctly determined from composite score
            const top50Signal = result.scores.compositeScore >= 65 ? 'BUY' : 
                               result.scores.compositeScore <= 35 ? 'SELL' : 'HOLD';
            
            // Save to database
            await storage.createQuantSignal({
              symbol,
              score: result.scores.compositeScore,
              signal: top50Signal === 'BUY' ? 'Bullish' : top50Signal === 'SELL' ? 'Bearish' : 'Neutral',
              confidence: result.confidence,
              factors: {
                trend: result.scores.trend,
                momentum: result.scores.momentum,
                volatility: result.scores.volatility,
                volume: result.scores.volume,
                risk: result.scores.risk,
                sentiment: result.scores.sentiment
              } as any,
              explanation: `Composite: ${result.scores.compositeScore}, Regime: ${result.marketRegime}`,
            });

            // Ensure signal is correctly determined from composite score
            const top50FinalSignal = result.scores.compositeScore >= 65 ? 'BUY' : 
                                    result.scores.compositeScore <= 35 ? 'SELL' : 'HOLD';
            
            console.log(`[quant/top50] Successfully processed ${symbol} - Score: ${result.scores.compositeScore}, Signal: ${top50FinalSignal}`);
            return { ...result, symbol, currentPrice: coin.current_price, signal: top50FinalSignal };
          } catch (error) {
            console.error(`[quant/top50] Error processing ${symbol}:`, error);
            return null;
          }
        })
      );

      // Filter out failed/null results
      const validResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      console.log(`[quant/top50] Returning ${validResults.length} valid results out of ${coins.length} coins`);

      // Return empty array if no results - frontend will handle the empty state
      // This is better than returning a 500 error, as it allows the UI to show a helpful message
      if (validResults.length === 0) {
        console.error("[quant/top50] No valid results - all coins failed to process. This might be due to API rate limits or network issues.");
      }

      res.json(validResults);
    } catch (error) {
      console.error("[quant/top50] Error in /api/quant/top50:", error);
      res.status(500).json({ error: "Failed to calculate quant scores" });
    }
  });

  /**
   * GET /api/quant/signals
   * Fetch recent quant signals from database
   * NOTE: This must be defined BEFORE /api/quant/:symbol to avoid route conflicts
   */
  app.get("/api/quant/signals", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const signals = await storage.getRecentQuantSignals(limit);
      res.json(signals);
    } catch (error) {
      console.error("Error in /api/quant/signals:", error);
      res.status(500).json({ error: "Failed to fetch quant signals" });
    }
  });

  /**
   * GET /api/quant/:symbol
   * Get detailed quant analysis for a single symbol
   */
  app.get("/api/quant/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = (req.query.interval as '1h' | '1d') || '1d';
      const cacheKey = `quant_${symbol.toUpperCase()}_${interval}`;

      // Check cache
      const cached = quantCache.get<QuantEngineOutput>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Fetch market data
      const klines = await fetchOHLCData(symbol, interval, 200);

      if (klines.length === 0) {
        return res.status(404).json({ error: "No data available for symbol" });
      }

      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);

      // Run quant engine
      const result = await runQuantEngine({
        symbol: symbol.toUpperCase(),
        prices: closes,
        ohlc,
        volumes,
        interval,
        sentimentScore: 50 // Default
      });

      // Cache for 1 minute
      quantCache.set(cacheKey, result, 60 * 1000);

      // Ensure signal is correctly determined from composite score
      const finalSignal = result.scores.compositeScore >= 65 ? 'BUY' : 
                         result.scores.compositeScore <= 35 ? 'SELL' : 'HOLD';
      
      // Save to database
      await storage.createQuantSignal({
        symbol: symbol.toUpperCase(),
        score: result.scores.compositeScore,
        signal: finalSignal === 'BUY' ? 'Bullish' : finalSignal === 'SELL' ? 'Bearish' : 'Neutral',
        confidence: result.confidence,
        factors: {
          trend: result.scores.trend,
          momentum: result.scores.momentum,
          volatility: result.scores.volatility,
          volume: result.scores.volume,
          risk: result.scores.risk,
          sentiment: result.scores.sentiment
        } as any,
        explanation: `Composite: ${result.scores.compositeScore}, Regime: ${result.marketRegime}`,
      });

      res.json(result);
    } catch (error) {
      console.error(`Error in /api/quant/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to calculate quant analysis" });
    }
  });

  /**
   * GET /api/quant/signal/:symbol
   * Get trading signal for a symbol (lightweight endpoint)
   */
  app.get("/api/quant/signal/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const interval = (req.query.interval as '1h' | '1d') || '1d';
      const cacheKey = `quant_${symbol.toUpperCase()}_${interval}`;

      // Check cache first
      const cached = quantCache.get<QuantEngineOutput>(cacheKey);
      if (cached) {
        return res.json({
          symbol: cached.symbol,
          signal: cached.signal,
          compositeScore: cached.scores.compositeScore,
          confidence: cached.confidence,
          marketRegime: cached.marketRegime
        });
      }

      // Fetch and calculate if not cached
      const klines = await fetchOHLCData(symbol, interval, 200);
      if (klines.length === 0) {
        return res.status(404).json({ error: "No data available for symbol" });
      }

      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);

      const result = await runQuantEngine({
        symbol: symbol.toUpperCase(),
        prices: closes,
        ohlc,
        volumes,
        interval,
        sentimentScore: 50
      });

      quantCache.set(cacheKey, result, 60 * 1000);

      res.json({
        symbol: result.symbol,
        signal: result.signal,
        compositeScore: result.scores.compositeScore,
        confidence: result.confidence,
        marketRegime: result.marketRegime
      });
    } catch (error) {
      console.error(`Error in /api/quant/signal/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Failed to calculate signal" });
    }
  });

  /**
   * GET /api/quant/score/:symbol (legacy endpoint, redirects to /api/quant/:symbol)
   */
  app.get("/api/quant/score/:symbol", async (req, res) => {
    // Redirect to new endpoint
    const { symbol } = req.params;
    req.url = `/api/quant/${symbol}`;
    return app._router.handle(req, res);
  });

  /**
   * GET /api/regime
   * Calculate market regime using unified quant engine
   */
  app.get("/api/regime", async (req, res) => {
    try {
      const cacheKey = 'regime_btc_1d';
      
      // Check cache
      const cached = quantCache.get<QuantEngineOutput>(cacheKey);
      if (cached && cached.marketRegime) {
        return res.json({
          regime: cached.marketRegime,
          volatility: cached.metrics.volatility.regime,
          trendStrength: cached.scores.trend,
          confidence: cached.confidence,
          explanation: `Market regime: ${cached.marketRegime}, Volatility: ${cached.metrics.volatility.regime}, Trend: ${cached.scores.trend}/100`
        });
      }

      // Use BTC as benchmark
      const klines = await fetchOHLCData('BTC', '1d', 300);

      if (klines.length === 0) {
        return res.status(500).json({ error: "Failed to fetch BTC data" });
      }

      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);

      // Run quant engine
      const result = await runQuantEngine({
        symbol: 'BTC',
        prices: closes,
        ohlc,
        volumes,
        interval: '1d',
        sentimentScore: 50
      });

      // Cache for 5 minutes
      quantCache.set(cacheKey, result, 5 * 60 * 1000);

      const regimeData = {
        regime: result.marketRegime,
        volatility: result.metrics.volatility.regime,
        trendStrength: result.scores.trend,
        confidence: result.confidence,
        explanation: `Market regime: ${result.marketRegime}, Volatility: ${result.metrics.volatility.regime}, Trend: ${result.scores.trend}/100`
      };

      // Save to database
      await storage.createRegimeLog({
        regime: result.marketRegime,
        volatility: result.metrics.volatility.regime,
        trendStrength: result.scores.trend,
        confidence: result.confidence,
        explanation: regimeData.explanation,
      });

      res.json(regimeData);
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

      // Calculate holdings and realized PnL from trades (recalculate from scratch)
      const holdings: Record<string, { quantity: number; avgEntry: number }> = {};
      let totalRealizedPnl = 0;

      // Process trades in chronological order to calculate realized PnL correctly
      const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const trade of sortedTrades) {
        const symbol = trade.symbol;
        const quantity = parseFloat(trade.quantity);
        const price = parseFloat(trade.buyPrice);

        if (!holdings[symbol]) {
          holdings[symbol] = { quantity: 0, avgEntry: 0 };
        }

        if (trade.side === 'buy') {
          // Buy trade: update holdings
          const prevTotal = holdings[symbol].quantity * holdings[symbol].avgEntry;
          holdings[symbol].quantity += quantity;
          holdings[symbol].avgEntry = (prevTotal + quantity * price) / holdings[symbol].quantity;
        } else {
          // Sell trade: calculate realized PnL and reduce holdings
          const avgEntry = holdings[symbol].avgEntry;
          const realizedPnl = (price - avgEntry) * quantity;
          totalRealizedPnl += realizedPnl;
          
          holdings[symbol].quantity -= quantity;
          
          // If all sold, reset avgEntry
          if (holdings[symbol].quantity <= 0.00000001) {
            holdings[symbol].quantity = 0;
            holdings[symbol].avgEntry = 0;
          }
        }
      }

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
   * Delete a trade and its associated realized PnL log
   */
  app.delete("/api/portfolio/trade/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Delete associated realized PnL log first (if it exists)
      await storage.deleteRealizedPnlLogByTradeId(id);
      
      // Then delete the trade
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
