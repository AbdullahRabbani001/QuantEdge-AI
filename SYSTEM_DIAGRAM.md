# QuantArchitect System Architecture Diagram

## High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ Dashboard  │  │  Markets   │  │ Quant Lab  │  │Coin Page │ │
│  │            │  │            │  │            │  │          │ │
│  │ - Top 50   │  │ - Top 50   │  │ - Top 50   │  │ - Single │ │
│  │ - Signals  │  │ - Prices   │  │ - Scores   │  │ - Full   │ │
│  │ - Regime   │  │ - Volume   │  │ - Regime   │  │ Metrics  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │
│        │               │                │               │        │
│        └───────────────┴────────────────┴───────────────┘        │
│                           │                                        │
│                    ┌──────▼──────┐                                │
│                    │  API Client │                                │
│                    │  (api.ts)   │                                │
│                    └──────┬──────┘                                │
└───────────────────────────┼───────────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────┼───────────────────────────────────────┐
│                    BACKEND SERVER                                  │
│                            │                                        │
│                    ┌───────▼────────┐                              │
│                    │  Express Routes │                             │
│                    │   (routes.ts)   │                             │
│                    └───────┬────────┘                              │
│                            │                                        │
│        ┌───────────────────┼───────────────────┐                  │
│        │                   │                   │                  │
│  ┌─────▼─────┐      ┌──────▼──────┐    ┌───────▼──────┐          │
│  │  Quant    │      │   Market    │    │   AI Chat    │          │
│  │  Engine   │      │   Data      │    │   Handler    │          │
│  │           │      │             │    │              │          │
│  │ - Top 50  │      │ - Binance   │    │ - Symbol     │          │
│  │ - Symbol  │      │ - CoinGecko │    │   Extract    │          │
│  │ - Signal  │      │ - OHLCV     │    │ - Grok       │          │
│  │ - Regime  │      │             │    │ - OpenAI     │          │
│  └─────┬─────┘      └──────┬──────┘    └──────┬───────┘          │
│        │                   │                   │                  │
│        └───────────────────┼───────────────────┘                  │
│                            │                                        │
│                    ┌───────▼────────┐                              │
│                    │ Unified Quant  │                              │
│                    │     Engine      │                              │
│                    │  (engine.ts)   │                              │
│                    └───────┬────────┘                              │
│                            │                                        │
│        ┌───────────────────┼───────────────────┐                  │
│        │                   │                   │                  │
│  ┌─────▼─────┐      ┌──────▼──────┐    ┌───────▼──────┐          │
│  │  Trend    │      │  Momentum   │    │  Volatility  │          │
│  │           │      │             │    │              │          │
│  │ - Slope   │      │ - Z-Score   │    │ - Historical │          │
│  │ - Hurst   │      │ - Sharpe    │    │ - Parkinson  │          │
│  │ - MACD    │      │ - Sortino   │    │ - Garman-Klass│         │
│  │           │      │ - RSI       │    │ - ATR        │          │
│  │           │      │ - RSI-Z     │    │              │          │
│  │           │      │ - ROC       │    │              │          │
│  └───────────┘      └─────────────┘    └──────────────┘          │
│                                                                     │
│  ┌───────────┐      ┌───────────┐    ┌───────────┐              │
│  │  Volume   │      │   Risk    │    │ Sentiment │              │
│  │           │      │           │    │           │              │
│  │ - Z-Score │      │ - Beta    │    │ - Grok    │              │
│  │ - MFI     │      │ - Drawdown│    │ - OpenAI  │              │
│  │ - OBV     │      │ - VaR     │    │           │              │
│  │           │      │ - Downside│    │           │              │
│  └───────────┘      └───────────┘    └───────────┘              │
│                                                                     │
│                    ┌───────────────┐                              │
│                    │   Composite   │                              │
│                    │     Score      │                              │
│                    │                │                              │
│                    │ 20% Trend      │                              │
│                    │ 20% Momentum   │                              │
│                    │ 20% Volatility │                              │
│                    │ 15% Volume     │                              │
│                    │ 15% Risk       │                              │
│                    │ 10% Sentiment  │                              │
│                    └───────┬───────┘                              │
│                            │                                        │
│                    ┌───────▼────────┐                              │
│                    │  Signal Logic  │                              │
│                    │                │                              │
│                    │ BUY/SELL/HOLD  │                              │
│                    └───────┬────────┘                              │
│                            │                                        │
│                    ┌───────▼────────┐                              │
│                    │     Cache      │                              │
│                    │  (1-5 min TTL) │                              │
│                    └───────┬────────┘                              │
│                            │                                        │
│                    ┌───────▼────────┐                              │
│                    │   Database     │                              │
│                    │  (PostgreSQL)  │                              │
│                    └────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example: User Queries "Should I buy BTC?"

```
1. User Input
   │
   ▼
2. Frontend: AIChatWidget
   │ POST /api/chatbot
   │ { message: "Should I buy BTC?" }
   │
   ▼
3. Backend: routes.ts
   │ processAIChat(message)
   │
   ▼
4. AI Chat Handler: aiChat.ts
   │
   ├─► extractSymbol() → "BTC"
   │
   ├─► runQuantEngine()
   │   │
   │   ├─► fetchOHLCData("BTC", "1d", 200)
   │   │   │
   │   │   ├─► Binance API (primary)
   │   │   └─► CoinGecko API (fallback)
   │   │
   │   ├─► calculateTrendMetrics()
   │   │   ├─► calculateRegressionSlope()
   │   │   ├─► calculateHurstExponent()
   │   │   └─► calculateMACD()
   │   │
   │   ├─► calculateMomentumMetrics()
   │   │   ├─► calculateZScore()
   │   │   ├─► calculateSharpeRatio()
   │   │   ├─► calculateSortinoRatio()
   │   │   ├─► calculateRSI()
   │   │   ├─► calculateRSIZ()
   │   │   └─► calculateROC()
   │   │
   │   ├─► calculateVolatilityMetrics()
   │   │   ├─► calculateHistoricalVolatility()
   │   │   ├─► calculateParkinsonVolatility()
   │   │   ├─► calculateGarmanKlassVolatility()
   │   │   └─► calculateATR()
   │   │
   │   ├─► calculateVolumeMetrics()
   │   │   ├─► calculateVolumeZScore()
   │   │   ├─► calculateMFI()
   │   │   └─► determinePriceVolumeConfirmation()
   │   │
   │   ├─► calculateRiskMetrics()
   │   │   ├─► calculateBeta()
   │   │   ├─► calculateMaxDrawdown()
   │   │   ├─► calculateDownsideDeviation()
   │   │   └─► calculateVaR()
   │   │
   │   └─► calculateCompositeScore()
   │       │ 20% trend + 20% momentum + 20% volatility
   │       │ + 15% volume + 15% risk + 10% sentiment
   │
   ├─► getSentimentAnalysis()
   │   │
   │   ├─► Grok API (primary)
   │   │   └─► Sentiment text + score (0-100)
   │   │
   │   └─► OpenAI API (fallback)
   │       └─► Sentiment text + score (0-100)
   │
   ├─► Re-run quant engine with sentiment score
   │
   └─► getTradingSignalFromGPT()
       │
       └─► OpenAI GPT-4o
           └─► Enhanced signal + reasoning
   │
   ▼
5. Format Response
   │
   ├─► Trading Signal (BUY/SELL/HOLD)
   ├─► Composite Score
   ├─► All Factor Scores
   ├─► Market Regime
   ├─► Sentiment Analysis
   └─► AI Reasoning
   │
   ▼
6. Frontend: Display formatted response
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    QUANT ENGINE CORE                         │
│                                                               │
│  Input:                                                       │
│  - symbol: string                                            │
│  - prices: number[]                                          │
│  - ohlc: OHLC[]                                              │
│  - volumes: number[]                                         │
│  - sentimentScore?: number                                   │
│                                                               │
│  Output:                                                      │
│  {                                                            │
│    symbol: string                                            │
│    scores: {                                                 │
│      trend: 0-100                                            │
│      momentum: 0-100                                         │
│      volatility: 0-100                                       │
│      volume: 0-100                                            │
│      risk: 0-100                                             │
│      sentiment: 0-100                                        │
│      compositeScore: 0-100                                   │
│    }                                                          │
│    signal: "BUY" | "SELL" | "HOLD"                          │
│    marketRegime: "bull" | "bear" | "sideways"               │
│    confidence: 0-100                                         │
│    metrics: { ...all raw metrics... }                        │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘
```

## External Dependencies

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Binance    │    │  CoinGecko   │    │     Grok     │
│     API      │    │     API      │    │     API      │
│              │    │              │    │              │
│ - OHLCV      │    │ - Market Data│    │ - Sentiment  │
│ - Prices     │    │ - Top Coins  │    │ - Analysis   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  QuantArchitect │
                   │     Backend     │
                   └─────────────────┘
                            │
                   ┌────────▼────────┐
                   │   OpenAI API    │
                   │                 │
                   │ - GPT-4o        │
                   │ - Formatting    │
                   │ - Fallback      │
                   └─────────────────┘
```

## Caching Strategy

```
Request → Cache Check → Valid? → Return Cached
                          │
                          No
                          ▼
                    Fetch Data
                          │
                          ▼
                    Calculate
                          │
                          ▼
                    Store Cache
                          │
                          ▼
                    Return Result
```

**Cache TTL:**
- Quant calculations: 1 minute
- Regime analysis: 5 minutes
- Top 50 coins: 1 hour (symbol mapping)

## Database Schema

```
quant_signals
├── id
├── symbol
├── score (compositeScore)
├── signal (BUY/SELL/HOLD)
├── confidence
├── factors (JSON: all scores)
├── explanation
└── createdAt

regime_logs
├── id
├── regime (bull/bear/sideways)
├── volatility (High/Normal/Low)
├── trendStrength
├── confidence
├── explanation
└── createdAt
```

