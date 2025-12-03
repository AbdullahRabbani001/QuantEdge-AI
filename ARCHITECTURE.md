# QuantEdge-AI: Enterprise Architecture Document

**Version:** 1.0  
**Date:** November 26, 2025  
**Classification:** Technical Architecture Documentation

---

## Table of Contents

1. [High-Level System Overview](#1-high-level-system-overview)
2. [Tech Stack Breakdown](#2-tech-stack-breakdown)
3. [Complete File/Folder Architecture](#3-complete-filefolder-architecture)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Chatbot Architecture](#5-chatbot-architecture)
6. [Quant Engine Mathematics](#6-quant-engine-mathematics)
7. [Page-by-Page Functional Breakdown](#7-page-by-page-functional-breakdown)
8. [Real-Time Update System](#8-real-time-update-system)
9. [Security Model](#9-security-model)
10. [Known Limitations / Improvements](#10-known-limitations--improvements)

---

## 1. High-Level System Overview

### 1.1 Purpose of the Application

QuantEdge-AI is a production-grade cryptocurrency quantitative analytics platform that combines institutional-level technical analysis with AI-powered market insights. The platform serves three primary functions:

1. **Quantitative Analysis Engine**: Multi-factor scoring system analyzing momentum, volatility, trend, volume, and risk metrics
2. **Portfolio Management**: Real-time P&L tracking with buy/sell execution and tax calculation
3. **AI Trading Assistant**: Hybrid AI system using Grok for sentiment analysis and GPT-4 for trading signals

### 1.2 Core Modules

The system is architected into six distinct modules:

- **Market Data Aggregation Layer**: Dual-source price feeds (Binance + CoinGecko fallback)
- **Quantitative Analysis Engine**: 7 mathematical modules for technical indicators
- **Portfolio Management System**: Trade execution, position tracking, P&L calculation
- **AI Intelligence Layer**: Grok sentiment + GPT signals + quant integration
- **Authentication & Session Management**: Replit OAuth with PostgreSQL session store
- **Real-Time Price Update System**: 1-second polling for live P&L updates

### 1.3 End-to-End Workflow

**User Journey:**
```
User Login (Replit OAuth)
  ↓
Dashboard Load → Fetch Market Regime (BTC 200-day data)
  ↓
User Navigates to Markets → Fetch Top 50 Coins (CoinGecko API)
  ↓
User Clicks Coin → Fetch OHLC + Calculate Quant Score
  ↓
User Adds Trade → Validate → Store in PostgreSQL → Update Holdings
  ↓
Real-Time Price Updates (every 1s) → Recalculate Unrealized PnL
  ↓
User Asks AI Chatbot → Grok Sentiment + GPT Signal + Quant Data → Response
  ↓
User Sells Position → Calculate Realized PnL → Store in realized_pnl_logs
```

### 1.4 Frontend ↔ Backend ↔ Database ↔ API Interaction

**Layer Communication:**

```
┌─────────────┐
│   React UI  │ (Port 5000)
└──────┬──────┘
       │ TanStack Query (HTTP)
       ↓
┌─────────────┐
│  Express.js │ (Routes Layer)
└──────┬──────┘
       │
       ├→ Storage Interface (storage.ts)
       │    ↓
       │  ┌──────────────┐
       │  │  PostgreSQL  │ (Neon Serverless)
       │  └──────────────┘
       │
       ├→ Market Data Layer (marketData.ts)
       │    ↓
       │  ┌──────────────┐
       │  │  Binance API │
       │  └──────────────┘
       │    ↓ (fallback)
       │  ┌──────────────┐
       │  │ CoinGecko API│
       │  └──────────────┘
       │
       └→ AI Chat Layer (aiChat.ts)
            ↓
          ┌──────────────┐
          │   Grok API   │ (X.AI)
          └──────────────┘
            ↓
          ┌──────────────┐
          │   GPT-4o API │ (Replit AI Integrations)
          └──────────────┘
```

---

## 2. Tech Stack Breakdown

### 2.1 Frontend

**Framework & Build Tool:**
- **React 18**: Functional components with hooks
- **TypeScript**: Full type safety
- **Vite**: Build tool (HMR in dev, ESBuild for production)
- **Configuration**: `vite.config.ts` with aliases (`@/` → `client/src/`)

**UI Framework:**
- **Tailwind CSS 3**: Utility-first styling
- **Shadcn/UI**: 50+ pre-built components (Radix UI primitives)
  - Dialog, Select, Input, Button, Card, Tabs, etc.
- **Custom Theme**: Dark obsidian blue with cyan/primary accents
- **Fonts**: Inter (sans), JetBrains Mono (mono), Space Grotesk (display)

**State Management:**
- **TanStack Query (React Query)**: Server state management
  - Query keys: `['portfolio']`, `['markets']`, `['coin', symbol]`
  - Auto-refetch: 1s for portfolio (live prices), 60s for markets
  - Caching strategy: Stale-while-revalidate

**Routing:**
- **Wouter**: Lightweight client-side routing (2KB)
- Routes:
  - `/` → Dashboard
  - `/markets` → Markets
  - `/portfolio` → Portfolio
  - `/strategies` → Quant Lab (Strategies)
  - `/coin/:symbol` → Coin Detail

**API Integration:**
- **Method**: Fetch API with custom wrapper (`client/src/lib/api.ts`)
- **Base URL**: `/api/*`
- **Error Handling**: Try-catch with user-friendly messages
- **Authentication**: Automatic cookie-based session

### 2.2 Backend

**Framework:**
- **Express.js 4**: Node.js web server
- **TypeScript**: End-to-end type safety
- **Development Mode**: Vite middleware for SSR (`index-dev.ts`)
- **Production Mode**: Static file serving (`index-prod.ts`)

**API Endpoints:**

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/markets` | GET | Fetch top N coins | No |
| `/api/coin/:symbol` | GET | Detailed coin data | No |
| `/api/price/:symbol` | GET | Current price (Binance→CoinGecko fallback) | No |
| `/api/klines/:symbol` | GET | OHLC candlestick data | No |
| `/api/quant/score/:symbol` | GET | Multi-factor quant score | No |
| `/api/regime` | GET | Market regime detection | No |
| `/api/portfolio` | GET | User portfolio + trades + P&L | Yes |
| `/api/portfolio/trade` | POST | Add buy/sell trade | Yes |
| `/api/portfolio/trade/:id` | DELETE | Delete trade | Yes |
| `/api/chat` | POST | AI chatbot with Grok + GPT | Yes |
| `/api/auth/user` | GET | Current user info | Yes |

**Data Processing Pipeline:**

```
Request → Route Handler → Validation (Zod) → Storage Interface → Database
                  ↓
          External API Call (if needed)
                  ↓
          Quant Engine Processing
                  ↓
          Response Formatting → JSON
```

**Validation:**
- **Zod Schemas**: Type-safe runtime validation
- **drizzle-zod**: Auto-generated schemas from database tables
- Example: `insertTradeSchema.parse(req.body)`

**Error Handling:**
- **Try-Catch**: All routes wrapped
- **HTTP Status Codes**: 200 (OK), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 500 (Server Error)
- **Logging**: `console.error()` with route context

**Logging Strategy:**
- **Development**: Console logs with timestamps (`[express]` prefix)
- **Production**: Same (no external logger currently)
- **Error Tracking**: Route name + error object logged

### 2.3 Database

**Engine:**
- **PostgreSQL 15**: Neon Serverless
- **Connection**: WebSocket-based (serverless-compatible)
- **Driver**: `@neondatabase/serverless`
- **Connection Pooling**: Built-in via Neon

**ORM:**
- **Drizzle ORM**: Type-safe SQL query builder
- **Migrations**: `drizzle-kit db:push` (schema-driven)
- **Type Generation**: Automatic TypeScript types from schema

**Tables Schema:**

**sessions** (Session Storage)
```typescript
{
  sid: varchar (PK),           // Session ID
  sess: jsonb,                 // Session data (user, timestamps)
  expire: timestamp,           // Expiration time
  index: IDX_session_expire    // For cleanup queries
}
```

**users**
```typescript
{
  id: varchar (PK, UUID),      // Auto-generated
  email: varchar (unique),
  firstName: varchar,
  lastName: varchar,
  profileImageUrl: varchar,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**portfolios**
```typescript
{
  id: serial (PK),
  userId: varchar (FK → users.id),
  name: text (default: "Default Portfolio"),
  createdAt: timestamp
}
```

**trades**
```typescript
{
  id: serial (PK),
  portfolioId: integer (FK → portfolios.id, CASCADE),
  symbol: text,                // e.g., "BTC", "ETH"
  quantity: decimal(20, 8),    // High precision for crypto
  buyPrice: decimal(20, 2),    // Entry price (or sell price if side='sell')
  subtotal: decimal(20, 2),    // Quantity * Price
  tax: decimal(20, 2),         // 0.1% transaction tax
  totalCost: decimal(20, 2),   // Subtotal ± Tax
  side: text,                  // 'buy' or 'sell'
  date: timestamp,             // Trade execution time
  createdAt: timestamp
}
```

**quant_signals**
```typescript
{
  id: serial (PK),
  symbol: text,
  score: integer (0-100),
  signal: text,                // 'Bullish', 'Bearish', 'Neutral'
  confidence: integer (0-100),
  factors: jsonb,              // { trend, momentum, volatility, volume, sentiment }
  explanation: text,
  createdAt: timestamp
}
```

**chat_logs**
```typescript
{
  id: serial (PK),
  userId: varchar (FK → users.id),
  message: text,
  response: text,
  createdAt: timestamp
}
```

**regime_logs**
```typescript
{
  id: serial (PK),
  regime: text,                // 'bull', 'bear', 'sideways'
  volatility: text,            // 'high', 'normal', 'low'
  trendStrength: integer (0-100),
  confidence: integer (0-100),
  explanation: text,
  createdAt: timestamp
}
```

**realized_pnl_logs**
```typescript
{
  id: serial (PK),
  portfolioId: integer (FK → portfolios.id, CASCADE),
  symbol: text,
  quantity: decimal(20, 8),
  buyPrice: decimal(20, 2),    // Average entry price
  sellPrice: decimal(20, 2),   // Exit price
  realizedPnl: decimal(20, 2), // (sellPrice - buyPrice) * quantity
  tradeId: integer (FK → trades.id),
  createdAt: timestamp
}
```

**Relationships:**
```
users (1) → (*) portfolios
portfolios (1) → (*) trades
portfolios (1) → (*) realized_pnl_logs
trades (1) → (0..1) realized_pnl_logs
users (1) → (*) chat_logs
```

**RLS Policies:**
- **Currently None**: All access control at application layer
- **Future**: Row-Level Security for multi-tenant isolation

**Stored Procedures:**
- **Currently None**: All logic in TypeScript
- **Future Candidates**: Complex P&L aggregations

### 2.4 Services

**Authentication:**
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL via `connect-pg-simple`
- **Flow**:
  1. User clicks login → `/api/login`
  2. Redirect to Replit OAuth
  3. Callback → `/api/callback`
  4. Create user in DB (if new)
  5. Set session cookie
  6. Redirect to dashboard
- **Middleware**: `isAuthenticated()` checks `req.user`
- **File**: `server/replitAuth.ts`

**Real-Time Updates:**
- **Method**: TanStack Query polling (not WebSockets)
- **Interval**: 1 second for portfolio prices
- **Implementation**: `refetchInterval: 1000` in useQuery

**Caching:**
- **Frontend**: React Query cache (5min stale time for markets)
- **Backend**: None currently (stateless)

**Background Jobs:**
- **Currently None**
- **Future**: Scheduled quant signal updates via cron

---

## 3. Complete File/Folder Architecture

```
quantedge-ai/
│
├── client/                          # Frontend React Application
│   ├── public/
│   │   └── favicon.png
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/          # Dashboard-specific components
│   │   │   │   ├── AIChatWidget.tsx         → AI chatbot sidebar widget
│   │   │   │   ├── MarketRegimeWidget.tsx   → Displays current regime (Bull/Bear/Sideways)
│   │   │   │   ├── PortfolioSnapshot.tsx    → Mini portfolio summary card
│   │   │   │   ├── PriceChart.tsx           → Recharts line chart for price history
│   │   │   │   └── RecentSignals.tsx        → Latest quant signals table
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   └── Sidebar.tsx              → Collapsible sidebar with navigation
│   │   │   │
│   │   │   └── ui/                 # Shadcn/UI components (50+ files)
│   │   │       ├── button.tsx, dialog.tsx, input.tsx, select.tsx
│   │   │       ├── table.tsx, card.tsx, skeleton.tsx
│   │   │       └── ... (all UI primitives)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts                   → Authentication state hook
│   │   │   ├── use-mobile.tsx               → Responsive breakpoint detection
│   │   │   └── use-toast.ts                 → Toast notification hook
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                       → API client with typed fetch wrappers
│   │   │   ├── authUtils.ts                 → Login/logout helpers
│   │   │   ├── queryClient.ts               → TanStack Query configuration
│   │   │   └── utils.ts                     → cn() for Tailwind class merging
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx                → Main landing page (regime + signals)
│   │   │   ├── Markets.tsx                  → Top 50 coins table with live prices
│   │   │   ├── Portfolio.tsx                → Trade management + P&L tracking
│   │   │   ├── Strategies.tsx               → Quant Lab: multi-coin analysis
│   │   │   ├── CoinDetail.tsx               → Individual coin deep dive
│   │   │   └── not-found.tsx                → 404 page
│   │   │
│   │   ├── App.tsx                          → Root component with routing
│   │   ├── main.tsx                         → Vite entry point
│   │   └── index.css                        → Global Tailwind styles
│   │
│   └── index.html                   # HTML template with meta tags
│
├── server/                          # Backend Express Application
│   ├── lib/
│   │   ├── quant/                   # Quantitative Analysis Modules
│   │   │   ├── statistics.ts                → Core math (mean, std, covariance, EMA)
│   │   │   ├── volatility.ts                → HV, Parkinson, Garman-Klass, ATR
│   │   │   ├── momentum.ts                  → Z-score, Sharpe, Sortino, RSI
│   │   │   ├── trend.ts                     → Linear regression, Hurst, MACD
│   │   │   ├── volume.ts                    → Volume z-score, MFI
│   │   │   ├── risk.ts                      → Beta, downside dev, VaR, max drawdown
│   │   │   └── scoring.ts                   → Multi-factor composite score + regime
│   │   │
│   │   ├── marketData.ts            → External API integration layer
│   │   │                              - fetchTopCoins() → CoinGecko
│   │   │                              - fetchCurrentPrice() → Binance → CoinGecko
│   │   │                              - fetchOHLCData() → Binance → CoinGecko
│   │   │                              - klinesToOHLC() → Data transformation
│   │   │
│   │   └── aiChat.ts                → AI chatbot orchestration
│   │                                  - processAIChat() → Main chat handler
│   │                                  - getSentimentFromGrok() → Grok API
│   │                                  - getTradingSignalFromGPT() → GPT API
│   │                                  - getMarketRegimeAnalysis() → Regime + GPT
│   │
│   ├── app.ts                       → Express app configuration + middleware
│   ├── routes.ts                    → All API endpoint definitions
│   ├── storage.ts                   → Database abstraction layer (CRUD interface)
│   ├── db.ts                        → Drizzle DB connection
│   ├── replitAuth.ts                → Replit OAuth setup + middleware
│   ├── index-dev.ts                 → Development server with Vite
│   └── index-prod.ts                → Production server (static files)
│
├── shared/
│   └── schema.ts                    # Drizzle table definitions + Zod schemas
│
├── attached_assets/                 # User-uploaded files + generated images
│
├── package.json                     # NPM dependencies + scripts
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
├── drizzle.config.ts                # Database migration config
├── replit.md                        # Project documentation
└── ARCHITECTURE.md                  # This document
```

---

## 4. Data Flow Diagrams

### 4.1 Portfolio Save Flow

```
User fills Add Trade form
  ↓
Frontend: handleSubmit() validates quantity > 0
  ↓
Fetch current price from /api/price/:symbol
  ↓
Calculate: subtotal = quantity * price
           tax = subtotal * 0.001 (0.1%)
           totalCost = subtotal + tax (buy) or subtotal - tax (sell)
  ↓
POST /api/portfolio/trade
  ↓
Backend: insertTradeSchema.parse(body) → Zod validation
  ↓
If side === 'sell':
  - Query all trades for portfolio
  - Calculate current holdings + avg entry price
  - Check sufficient quantity
  - realizedPnl = (sellPrice - avgEntry) * quantity
  - storage.createTrade(trade)
  - storage.createRealizedPnlLog(pnl)
Else (buy):
  - storage.createTrade(trade)
  ↓
PostgreSQL INSERT into trades table
  ↓
Return trade object
  ↓
Frontend: queryClient.invalidateQueries(['portfolio'])
  ↓
React Query refetches portfolio data
  ↓
UI updates with new trade + recalculated holdings
```

### 4.2 Quant Calculation Flow

```
User navigates to /coin/BTC
  ↓
Frontend: useQuery(['coin', 'BTC'])
  ↓
GET /api/quant/score/BTC?interval=1d
  ↓
Backend: fetchOHLCData('BTC', '1d', 200)
  ↓
Try Binance API → https://api.binance.com/api/v3/klines?symbol=BTCUSDT
  ↓
If Binance fails:
  Fallback to CoinGecko → https://api.coingecko.com/api/v3/coins/bitcoin/ohlc
  ↓
Data transformation:
  klinesToOHLC(klines) → { open[], high[], low[], close[] }
  extractPriceVolume(klines) → { closes[], volumes[], highs[], lows[] }
  ↓
calculateQuantScore(symbol, closes, ohlc, volumes, sentiment=50):
  1. Trend Score (0-100):
     - Linear regression slope
     - Hurst exponent (mean reversion vs trending)
     - MACD normalized
  
  2. Momentum Score (0-100):
     - Z-score (current vs moving average)
     - Sharpe ratio
     - Sortino ratio
     - RSI
  
  3. Volatility Score (0-100):
     - Historical volatility
     - Parkinson volatility (high-low range)
     - Garman-Klass estimator
     - ATR normalization
  
  4. Volume Score (0-100):
     - Volume z-score
     - Money Flow Index (MFI)
     - Price-volume confirmation
  
  5. Risk Score (0-100):
     - Beta vs BTC
     - Downside deviation
     - Maximum drawdown
     - Value at Risk (VaR)
  
  Composite Score = 0.25*trend + 0.25*momentum + 0.20*volatility + 0.15*volume + 0.10*risk + 0.05*sentiment
  
  Signal = 'Bullish' if score >= 65
           'Bearish' if score <= 35
           'Neutral' otherwise
  ↓
storage.createQuantSignal(signal) → Save to quant_signals table
  ↓
Return { score, signal, confidence, factors, explanation }
  ↓
Frontend: Display in coin detail page
```

### 4.3 Live Price Update Flow

```
Portfolio page loads
  ↓
useQuery(['portfolio'], {
  queryFn: fetchPortfolio,
  refetchInterval: 1000   ← Poll every 1 second
})
  ↓
Every 1 second:
  GET /api/portfolio
    ↓
  Backend: storage.getTradesByPortfolioId(id)
    ↓
  Calculate holdings from trades:
    For each trade:
      If buy: holdings[symbol].quantity += quantity
              holdings[symbol].avgEntry = weighted average
      If sell: holdings[symbol].quantity -= quantity
    ↓
  For each holding:
    currentPrice = fetchCurrentPrice(symbol)
      ↓
    Try Binance: https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
      ↓
    If fails, try CoinGecko: https://api.coingecko.com/api/v3/simple/price?ids=bitcoin
      ↓
    unrealizedPnl = (currentPrice - avgEntry) * quantity
    value = quantity * currentPrice
    ↓
  Query realized_pnl_logs:
    totalRealizedPnl = SUM(realizedPnl)
    ↓
  Return {
    holdings: [...],         // With live prices
    totalValue,              // Sum of all holdings
    realizedPnl,             // From sell trades
    unrealizedPnl,           // Current positions
    totalPnl                 // realized + unrealized
  }
  ↓
Frontend: React Query updates cache
  ↓
UI re-renders with new PnL values (green/red colors update)
```

### 4.4 Chat Query Processing

```
User types: "Should I buy Bitcoin?"
  ↓
Frontend: POST /api/chat { message: "Should I buy Bitcoin?" }
  ↓
Backend: extractSymbol(message) → "BTC"
  ↓
Parallel execution:
  
  Thread 1: Fetch Quant Data
    fetchOHLCData('BTC', '1d', 100)
    ↓
    Calculate: closes[], volumes[], ohlc[]
    ↓
    quantScore = calculateQuantScore('BTC', closes, ohlc, volumes, 50)
    → { score: 73, signal: 'Bullish', confidence: 82, factors: {...} }
  
  Thread 2: Get Sentiment from Grok
    POST https://api.x.ai/v1/chat/completions
    {
      model: 'grok-beta',
      messages: [
        { role: 'system', content: 'You are a sentiment analyst...' },
        { role: 'user', content: 'Analyze BTC sentiment. Current price: $95,432...' }
      ]
    }
    →  "Bitcoin sentiment is bullish with strong institutional inflows..."
  
  Threads merge:
  
  Thread 3: Get Trading Signal from GPT
    POST (via Replit AI Integrations)
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a trading analyst...' },
        { role: 'user', content: 
          `Symbol: BTC
           Quant Score: 73/100 (Bullish)
           Sentiment: Bitcoin sentiment is bullish...
           
           Provide BUY/SELL/HOLD signal.`
        }
      ]
    }
    → "BUY - Strong technical indicators align with positive sentiment..."
  
  ↓
Combine responses:
  response = `
  ## BTC AI Analysis
  
  ### 🟢 Trading Signal: BUY
  Strong technical indicators align with positive sentiment...
  
  ---
  
  ### 📊 Quantitative Analysis
  • Quant Score: 73/100 (Bullish)
  • Confidence: 82%
  • Trend: 78/100
  • Momentum: 71/100
  ...
  
  ---
  
  ### 💭 Market Sentiment (Powered by Grok)
  Bitcoin sentiment is bullish with strong institutional inflows...
  
  ---
  
  *Current Price: $95,432 | 24h Change: +2.34%*
  `
  ↓
storage.createChatLog(userId, message, response)
  ↓
Return response to frontend
  ↓
UI displays formatted markdown response in chat widget
```

---

## 5. Chatbot Architecture

### 5.1 Message Reception & Routing

**Entry Point:** `POST /api/chat`

```typescript
// server/routes.ts
app.post("/api/chat", isAuthenticated, async (req, res) => {
  const { message } = req.body;
  
  // Route based on message intent
  if (message.includes('regime') || message.includes('overall market')) {
    response = await getMarketRegimeAnalysis();
  } else {
    response = await processAIChat(message);  // Coin-specific analysis
  }
  
  await storage.createChatLog({ userId, message, response });
  res.json({ response });
});
```

### 5.2 Multi-Agent Pipeline

**Architecture:** Sequential agent execution with context passing

**Agent 1: Symbol Extraction**
```typescript
// server/lib/aiChat.ts
function extractSymbol(message: string): string | null {
  const commonSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', ...];
  const nameMap = { 'BITCOIN': 'BTC', 'ETHEREUM': 'ETH', ... };
  
  // Regex matching for symbols
  for (const symbol of commonSymbols) {
    if (message.toUpperCase().includes(symbol)) return symbol;
  }
  
  // Full name matching
  for (const [name, symbol] of Object.entries(nameMap)) {
    if (message.toUpperCase().includes(name)) return symbol;
  }
  
  return null;
}
```

**Agent 2: Quantitative Analysis Agent**
```typescript
// Runs synchronously - must complete before Grok
async function getQuantData(symbol: string) {
  const klines = await fetchOHLCData(symbol, '1d', 100);
  const ohlc = klinesToOHLC(klines);
  const { closes, volumes } = extractPriceVolume(klines);
  
  const quantScore = calculateQuantScore(symbol, closes, ohlc, volumes, 50);
  
  return {
    score: quantScore.score,
    signal: quantScore.signal,
    confidence: quantScore.confidence,
    factors: quantScore.factors,
    currentPrice: closes[closes.length - 1],
    priceChange: ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
  };
}
```

**Agent 3: Sentiment Analysis Agent (Grok)**
```typescript
async function getSentimentFromGrok(symbol: string, marketData: string): Promise<string> {
  const grokClient = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1'
  });
  
  const response = await grokClient.chat.completions.create({
    model: 'grok-beta',
    messages: [
      {
        role: 'system',
        content: 'You are a cryptocurrency market sentiment analyst. Analyze market mood, social trends, and news sentiment. Be concise (2-3 sentences).'
      },
      {
        role: 'user',
        content: `Analyze sentiment for ${symbol}:\n${marketData}`
      }
    ],
    temperature: 0.7,
    max_tokens: 150
  });
  
  return response.choices[0]?.message?.content || 'Sentiment unavailable.';
}
```

**Agent 4: Trading Signal Agent (GPT-4)**
```typescript
async function getTradingSignalFromGPT(symbol: string, quantData: any, sentiment: string) {
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
  });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert trading analyst. Provide a clear BUY/SELL/HOLD signal with reasoning (2-3 sentences).'
      },
      {
        role: 'user',
        content: `Signal for ${symbol}:
        
        Quant Analysis:
        - Score: ${quantData.score}/100
        - Signal: ${quantData.signal}
        - Trend: ${quantData.factors.trend}/100
        - Momentum: ${quantData.factors.momentum}/100
        - Volatility: ${quantData.factors.volatility}/100
        
        Sentiment Analysis:
        ${sentiment}
        
        Provide BUY/SELL/HOLD and reasoning.`
      }
    ],
    temperature: 0.3,
    max_tokens: 200
  });
  
  const content = response.choices[0]?.message?.content || '';
  
  // Extract signal from response
  let signal = 'HOLD';
  if (content.includes('BUY') && !content.includes('NOT BUY')) signal = 'BUY';
  else if (content.includes('SELL')) signal = 'SELL';
  
  return { signal, reasoning: content };
}
```

### 5.3 Response Formatting & Structured Output

```typescript
async function processAIChat(message: string): Promise<string> {
  const symbol = extractSymbol(message);
  if (!symbol) return "Ask me about specific coins (BTC, ETH, SOL)...";
  
  // Step 1: Get quant data
  const quantScore = await getQuantData(symbol);
  
  // Step 2: Get sentiment (Grok)
  const marketSummary = `Price: $${quantScore.currentPrice}, Change: ${quantScore.priceChange.toFixed(2)}%, Score: ${quantScore.score}/100`;
  const sentiment = await getSentimentFromGrok(symbol, marketSummary);
  
  // Step 3: Get trading signal (GPT)
  const tradingSignal = await getTradingSignalFromGPT(symbol, quantScore, sentiment);
  
  // Step 4: Format structured response
  const signalEmoji = tradingSignal.signal === 'BUY' ? '🟢' : tradingSignal.signal === 'SELL' ? '🔴' : '🟡';
  
  return `## ${symbol} AI Analysis

### ${signalEmoji} Trading Signal: ${tradingSignal.signal}
${tradingSignal.reasoning}

---

### 📊 Quantitative Analysis
• **Quant Score:** ${quantScore.score}/100 (${quantScore.signal})
• **Confidence:** ${quantScore.confidence}%
• **Trend:** ${quantScore.factors.trend}/100
• **Momentum:** ${quantScore.factors.momentum}/100
• **Volatility:** ${quantScore.factors.volatility}/100

*${quantScore.explanation}*

---

### 💭 Market Sentiment (Powered by Grok)
${sentiment}

---

*Current Price: $${quantScore.currentPrice.toFixed(2)} | 24h Change: ${quantScore.priceChange >= 0 ? '+' : ''}${quantScore.priceChange.toFixed(2)}%*`;
}
```

### 5.4 Error Handling & Fallbacks

```typescript
// Graceful degradation
try {
  sentiment = await getSentimentFromGrok(symbol, marketData);
} catch (error) {
  console.error('Grok API error:', error);
  sentiment = 'Sentiment analysis unavailable.';
}

try {
  tradingSignal = await getTradingSignalFromGPT(symbol, quantData, sentiment);
} catch (error) {
  console.error('GPT API error:', error);
  tradingSignal = { signal: 'HOLD', reasoning: 'Unable to generate signal.' };
}
```

---

## 6. Quant Engine Mathematics

### 6.1 Statistics Module (`server/lib/quant/statistics.ts`)

**Mean:**
```typescript
μ = (1/n) * Σ(xi)

function mean(arr: number[]): number {
  return arr.reduce((sum, x) => sum + x, 0) / arr.length;
}
```

**Standard Deviation:**
```typescript
σ = sqrt((1/n) * Σ(xi - μ)²)

function standardDeviation(arr: number[]): number {
  const avg = mean(arr);
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}
```

**Log Returns:**
```typescript
r_t = ln(P_t / P_{t-1})

function logReturns(prices: number[]): number[] {
  return prices.slice(1).map((price, i) => Math.log(price / prices[i]));
}
```

**Exponential Moving Average:**
```typescript
EMA_t = α * P_t + (1 - α) * EMA_{t-1}
where α = 2 / (period + 1)

function exponentialMovingAverage(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  
  return ema;
}
```

**Covariance:**
```typescript
Cov(X, Y) = (1/n) * Σ((X_i - μ_X) * (Y_i - μ_Y))

function covariance(x: number[], y: number[]): number {
  const meanX = mean(x);
  const meanY = mean(y);
  return mean(x.map((xi, i) => (xi - meanX) * (y[i] - meanY)));
}
```

### 6.2 Volatility Module (`server/lib/quant/volatility.ts`)

**Historical Volatility (Annualized):**
```typescript
HV = σ(log returns) * sqrt(252)

function historicalVolatility(closes: number[], period: number = 30): number {
  const returns = logReturns(closes.slice(-period));
  return standardDeviation(returns) * Math.sqrt(252);
}
```

**Parkinson Volatility (High-Low Range):**
```typescript
σ_P = sqrt((1 / (4n * ln(2))) * Σ(ln(H_i / L_i))²)

function parkinsonVolatility(ohlc: OHLC[]): number {
  const ratios = ohlc.map(candle => Math.pow(Math.log(candle.high / candle.low), 2));
  const avgRatio = mean(ratios);
  return Math.sqrt(avgRatio / (4 * Math.log(2))) * Math.sqrt(252);
}
```

**Garman-Klass Volatility:**
```typescript
σ_GK = sqrt((1/n) * Σ(
  0.5 * (ln(H/L))² - (2*ln(2) - 1) * (ln(C/O))²
))

function garmanKlassVolatility(ohlc: OHLC[]): number {
  const sum = ohlc.reduce((acc, candle) => {
    const hl = Math.pow(Math.log(candle.high / candle.low), 2);
    const co = Math.pow(Math.log(candle.close / candle.open), 2);
    return acc + (0.5 * hl - (2 * Math.log(2) - 1) * co);
  }, 0);
  
  return Math.sqrt(sum / ohlc.length) * Math.sqrt(252);
}
```

**Average True Range (ATR):**
```typescript
TR_i = max(H_i - L_i, |H_i - C_{i-1}|, |L_i - C_{i-1}|)
ATR_t = (ATR_{t-1} * (n-1) + TR_t) / n

function averageTrueRange(ohlc: OHLC[], period: number = 14): number {
  const trueRanges = ohlc.slice(1).map((candle, i) => {
    const prevClose = ohlc[i].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );
  });
  
  return mean(trueRanges.slice(-period));
}
```

### 6.3 Momentum Module (`server/lib/quant/momentum.ts`)

**Z-Score:**
```typescript
Z = (X - μ) / σ

function zScore(value: number, arr: number[]): number {
  return (value - mean(arr)) / standardDeviation(arr);
}
```

**Sharpe Ratio (Annualized):**
```typescript
Sharpe = (μ_returns - r_f) / σ_returns * sqrt(252)
where r_f = 0 (risk-free rate)

function sharpeRatio(closes: number[], period: number = 252): number {
  const returns = logReturns(closes.slice(-period));
  const avgReturn = mean(returns);
  const stdReturn = standardDeviation(returns);
  
  return (avgReturn / stdReturn) * Math.sqrt(252);
}
```

**Sortino Ratio (Annualized):**
```typescript
Sortino = (μ_returns - r_f) / σ_downside * sqrt(252)
where σ_downside = sqrt(mean(min(0, r_i)²))

function sortinoRatio(closes: number[], period: number = 252): number {
  const returns = logReturns(closes.slice(-period));
  const avgReturn = mean(returns);
  
  const negativeReturns = returns.filter(r => r < 0);
  const downsideDev = Math.sqrt(mean(negativeReturns.map(r => r * r)));
  
  return (avgReturn / downsideDev) * Math.sqrt(252);
}
```

**RSI (Relative Strength Index):**
```typescript
RSI = 100 - (100 / (1 + RS))
where RS = Average Gain / Average Loss

function rsi(closes: number[], period: number = 14): number {
  const changes = closes.slice(1).map((price, i) => price - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const avgGain = mean(gains.slice(-period));
  const avgLoss = mean(losses.slice(-period));
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
```

### 6.4 Trend Module (`server/lib/quant/trend.ts`)

**Linear Regression Slope:**
```typescript
β = (n*Σ(xy) - Σ(x)*Σ(y)) / (n*Σ(x²) - (Σ(x))²)

function linearRegressionSlope(y: number[]): number {
  const x = Array.from({length: y.length}, (_, i) => i);
  const n = x.length;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}
```

**Hurst Exponent (Mean Reversion Test):**
```typescript
H = log(R/S) / log(n)
where R = range, S = std dev

H < 0.5: Mean reverting
H = 0.5: Random walk
H > 0.5: Trending

function hurstExponent(closes: number[]): number {
  const logReturns = closes.slice(1).map((p, i) => Math.log(p / closes[i]));
  const meanReturn = mean(logReturns);
  
  const deviations = logReturns.map(r => r - meanReturn);
  const cumSum = deviations.reduce((acc, d) => [...acc, (acc[acc.length - 1] || 0) + d], []);
  
  const range = Math.max(...cumSum) - Math.min(...cumSum);
  const stdDev = standardDeviation(logReturns);
  
  const rs = range / stdDev;
  return Math.log(rs) / Math.log(closes.length);
}
```

**MACD (Moving Average Convergence Divergence):**
```typescript
MACD = EMA_12 - EMA_26
Signal = EMA_9(MACD)
Histogram = MACD - Signal

function macd(closes: number[]): { macd: number, signal: number, histogram: number } {
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  
  const macdLine = ema12.map((e12, i) => e12 - ema26[i]);
  const signalLine = exponentialMovingAverage(macdLine, 9);
  
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1]
  };
}
```

### 6.5 Volume Module (`server/lib/quant/volume.ts`)

**Volume Z-Score:**
```typescript
Z_volume = (V_current - μ_volume) / σ_volume

function volumeZScore(volumes: number[], period: number = 20): number {
  const recentVolumes = volumes.slice(-period);
  return zScore(volumes[volumes.length - 1], recentVolumes);
}
```

**Money Flow Index (MFI):**
```typescript
Typical Price = (H + L + C) / 3
Money Flow = Typical Price * Volume
Money Ratio = Positive Flow / Negative Flow
MFI = 100 - (100 / (1 + Money Ratio))

function moneyFlowIndex(ohlc: OHLC[], volumes: number[], period: number = 14): number {
  const typicalPrices = ohlc.map(c => (c.high + c.low + c.close) / 3);
  const moneyFlows = typicalPrices.map((tp, i) => tp * volumes[i]);
  
  let positiveFlow = 0, negativeFlow = 0;
  
  for (let i = 1; i < period; i++) {
    const diff = typicalPrices[i] - typicalPrices[i - 1];
    if (diff > 0) positiveFlow += moneyFlows[i];
    else negativeFlow += moneyFlows[i];
  }
  
  const moneyRatio = positiveFlow / negativeFlow;
  return 100 - (100 / (1 + moneyRatio));
}
```

### 6.6 Risk Module (`server/lib/quant/risk.ts`)

**Beta (vs BTC):**
```typescript
β = Cov(Asset, BTC) / Var(BTC)

function beta(assetReturns: number[], btcReturns: number[]): number {
  const cov = covariance(assetReturns, btcReturns);
  const btcVariance = Math.pow(standardDeviation(btcReturns), 2);
  return cov / btcVariance;
}
```

**Downside Deviation:**
```typescript
σ_downside = sqrt((1/n) * Σ(min(0, r_i - target)²))

function downsideDeviation(returns: number[], target: number = 0): number {
  const downsideReturns = returns.map(r => Math.min(0, r - target));
  return Math.sqrt(mean(downsideReturns.map(r => r * r)));
}
```

**Maximum Drawdown:**
```typescript
DD_t = (Trough - Peak) / Peak
MDD = max(DD_t)

function maxDrawdown(closes: number[]): number {
  let peak = closes[0];
  let maxDD = 0;
  
  for (const price of closes) {
    if (price > peak) peak = price;
    const dd = (price - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  
  return Math.abs(maxDD);
}
```

**Value at Risk (95% confidence):**
```typescript
VaR_95 = μ - 1.645 * σ

function valueAtRisk(returns: number[], confidence: number = 0.95): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * returns.length);
  return Math.abs(sorted[index]);
}
```

### 6.7 Composite Scoring (`server/lib/quant/scoring.ts`)

**Multi-Factor Score Formula:**
```typescript
Score = w1*Trend + w2*Momentum + w3*Volatility + w4*Volume + w5*Risk + w6*Sentiment

Weights:
w1 = 0.25 (Trend)
w2 = 0.25 (Momentum)
w3 = 0.20 (Volatility)
w4 = 0.15 (Volume)
w5 = 0.10 (Risk)
w6 = 0.05 (Sentiment)

function calculateQuantScore(
  symbol: string,
  closes: number[],
  ohlc: OHLC[],
  volumes: number[],
  sentimentScore: number = 50
): QuantScore {
  // 1. Trend Score
  const slope = linearRegressionSlope(closes.slice(-50));
  const hurst = hurstExponent(closes.slice(-100));
  const { histogram } = macd(closes);
  const trendScore = normalize([slope, hurst, histogram], [0.4, 0.3, 0.3]);
  
  // 2. Momentum Score
  const currentPrice = closes[closes.length - 1];
  const z = zScore(currentPrice, closes.slice(-50));
  const sharpe = sharpeRatio(closes);
  const sortino = sortinoRatio(closes);
  const rsiValue = rsi(closes);
  const momentumScore = normalize([z, sharpe, sortino, rsiValue], [0.25, 0.25, 0.25, 0.25]);
  
  // 3. Volatility Score (inverse - lower vol = higher score)
  const hv = historicalVolatility(closes);
  const parkinson = parkinsonVolatility(ohlc);
  const gk = garmanKlassVolatility(ohlc);
  const volatilityScore = 100 - normalize([hv, parkinson, gk], [0.4, 0.3, 0.3]);
  
  // 4. Volume Score
  const volZ = volumeZScore(volumes);
  const mfi = moneyFlowIndex(ohlc, volumes);
  const volumeScore = normalize([volZ, mfi], [0.5, 0.5]);
  
  // 5. Risk Score (inverse - lower risk = higher score)
  const btcReturns = logReturns(closes); // Placeholder for BTC returns
  const assetBeta = beta(logReturns(closes), btcReturns);
  const maxDD = maxDrawdown(closes);
  const var95 = valueAtRisk(logReturns(closes));
  const riskScore = 100 - normalize([assetBeta, maxDD, var95], [0.4, 0.3, 0.3]);
  
  // 6. Composite Score
  const compositeScore = 
    0.25 * trendScore +
    0.25 * momentumScore +
    0.20 * volatilityScore +
    0.15 * volumeScore +
    0.10 * riskScore +
    0.05 * sentimentScore;
  
  // 7. Signal Generation
  let signal: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (compositeScore >= 65) signal = 'Bullish';
  else if (compositeScore <= 35) signal = 'Bearish';
  
  // 8. Confidence Calculation
  const confidence = Math.min(100, Math.abs(compositeScore - 50) * 2);
  
  return {
    score: Math.round(compositeScore),
    signal,
    confidence,
    factors: {
      trend: Math.round(trendScore),
      momentum: Math.round(momentumScore),
      volatility: Math.round(volatilityScore),
      volume: Math.round(volumeScore),
      risk: Math.round(riskScore),
      sentiment: sentimentScore
    },
    explanation: generateExplanation(signal, compositeScore, confidence)
  };
}
```

### 6.8 Market Regime Detection (`server/lib/quant/scoring.ts`)

**Regime Classification Logic:**
```typescript
function calculateMarketRegime(
  closes: number[],
  ohlc: OHLC[],
  ema200: number[]
): RegimeResult {
  const currentPrice = closes[closes.length - 1];
  const ema200Current = ema200[ema200.length - 1];
  
  // 1. Trend Determination
  const priceVsEma = (currentPrice - ema200Current) / ema200Current;
  const slope = linearRegressionSlope(closes.slice(-50));
  
  let regime: 'Bull' | 'Bear' | 'Sideways';
  if (priceVsEma > 0.05 && slope > 0) regime = 'Bull';
  else if (priceVsEma < -0.05 && slope < 0) regime = 'Bear';
  else regime = 'Sideways';
  
  // 2. Volatility Classification
  const hv = historicalVolatility(closes);
  let volatility: 'High' | 'Normal' | 'Low';
  if (hv > 0.60) volatility = 'High';
  else if (hv < 0.30) volatility = 'Low';
  else volatility = 'Normal';
  
  // 3. Trend Strength
  const trendStrength = Math.min(100, Math.abs(priceVsEma) * 200 + Math.abs(slope) * 1000);
  
  // 4. Confidence
  const confidence = Math.min(100, trendStrength + (hv < 0.40 ? 20 : 0));
  
  return {
    regime,
    volatility,
    trendStrength: Math.round(trendStrength),
    confidence: Math.round(confidence),
    explanation: `Market is in a ${regime} regime with ${volatility} volatility.`
  };
}
```

---

## 7. Page-by-Page Functional Breakdown

### 7.1 Dashboard (`/`)

**Component:** `client/src/pages/Dashboard.tsx`

**Data Loading:**
```typescript
// Market regime (BTC 200-day data)
const { data: regime } = useQuery({
  queryKey: ['regime'],
  queryFn: async () => {
    const res = await fetch('/api/regime');
    return res.json();
  },
  refetchInterval: 300000  // 5 minutes
});

// Recent quant signals (first 5)
const { data: signals } = useQuery({
  queryKey: ['signals'],
  queryFn: async () => {
    const res = await fetch('/api/quant/signals?limit=5');
    return res.json();
  },
  refetchInterval: 300000
});

// Portfolio snapshot
const { data: portfolio } = useQuery({
  queryKey: ['portfolio'],
  queryFn: fetchPortfolio,
  refetchInterval: 60000  // 1 minute (lighter load than full portfolio page)
});
```

**Components Used:**
- `<MarketRegimeWidget>`: Displays current regime (Bull/Bear/Sideways) with color coding
- `<RecentSignals>`: Table of latest 5 quant signals (symbol, score, signal)
- `<PortfolioSnapshot>`: Mini card showing total value + today's P&L
- `<PriceChart>`: Line chart of BTC price (last 30 days)
- `<AIChatWidget>`: Floating chat button

**State Management:**
- No local state (all server state via React Query)
- Regime cached for 5 minutes
- Signals cached for 5 minutes

**Backend Connections:**
- `GET /api/regime` → BTC market regime calculation
- `GET /api/quant/signals?limit=5` → Latest signals from DB
- `GET /api/portfolio` → User portfolio summary

### 7.2 Markets (`/markets`)

**Component:** `client/src/pages/Markets.tsx`

**Data Loading:**
```typescript
const { data: markets, isLoading } = useQuery({
  queryKey: ['markets'],
  queryFn: async () => {
    const res = await fetch('/api/markets?limit=50');
    return res.json();
  },
  refetchInterval: 60000  // 1 minute
});
```

**Calculations:**
- 24h change % (from API)
- Market cap formatting (millions/billions)
- Volume formatting

**UI Updates:**
- Table auto-refreshes every 60s
- Green/red price change indicators
- Skeleton loaders during fetch
- Click row → navigate to `/coin/:symbol`

**Components:**
- `<Sidebar>`: Navigation
- `<Table>`: Shadcn table component
- `<Skeleton>`: Loading placeholders

**Backend Connection:**
- `GET /api/markets?limit=50` → CoinGecko API → Top 50 coins

### 7.3 Portfolio (`/portfolio`)

**Component:** `client/src/pages/Portfolio.tsx`

**Data Loading:**
```typescript
const { data: portfolio, isLoading } = useQuery({
  queryKey: ['portfolio'],
  queryFn: fetchPortfolio,
  refetchInterval: 1000  // 1 second for live prices
});
```

**State Management:**
```typescript
const [isAddOpen, setIsAddOpen] = useState(false);      // Add trade modal
const [isSellOpen, setIsSellOpen] = useState(false);    // Sell trade modal
const [selectedHolding, setSelectedHolding] = useState<any>(null);
const [formData, setFormData] = useState({
  symbol: '',
  quantity: ''
});
const [sellFormData, setSellFormData] = useState({ quantity: '' });
const [livePrice, setLivePrice] = useState<number | null>(null);
const [sellLivePrice, setSellLivePrice] = useState<number | null>(null);
```

**Calculations:**
```typescript
// Holdings calculation (from trades)
for (const trade of trades) {
  if (trade.side === 'buy') {
    holdings[symbol].quantity += quantity;
    holdings[symbol].avgEntry = (prevTotal + quantity * price) / holdings[symbol].quantity;
  } else {
    holdings[symbol].quantity -= quantity;
  }
}

// Unrealized PnL
unrealizedPnl = (currentPrice - avgEntry) * quantity;

// Realized PnL (from database)
totalRealizedPnl = SUM(realized_pnl_logs.realizedPnl);

// Total PnL
totalPnl = realizedPnl + unrealizedPnl;
```

**UI Flow:**
```
1. User clicks "Add Trade"
   ↓
2. Modal opens with symbol input
   ↓
3. User types symbol + blurs input
   ↓
4. handleSymbolBlur() → fetch `/api/price/:symbol`
   ↓
5. Display live price: "$95,432"
   ↓
6. User enters quantity: "0.5"
   ↓
7. Calculate: Subtotal = 0.5 * $95,432 = $47,716
             Tax = $47,716 * 0.001 = $47.72
             Total = $47,763.72
   ↓
8. User clicks "Add Trade"
   ↓
9. POST /api/portfolio/trade { portfolioId, symbol, quantity, buyPrice, ... }
   ↓
10. queryClient.invalidateQueries(['portfolio'])
   ↓
11. Portfolio refetches → UI updates with new trade
```

**Sell Flow:**
```
1. User clicks "Sell Trade" button
   ↓
2. Sell modal opens with dropdown
   ↓
3. User selects holding (e.g., "BTC (0.5)")
   ↓
4. openSellModal(holding) → fetch current price
   ↓
5. Display available quantity + avg entry price
   ↓
6. User enters sell quantity
   ↓
7. Calculate: Subtotal = quantity * currentPrice
             Tax = -0.1% (deducted)
             Realized PnL = (currentPrice - avgEntry) * quantity
   ↓
8. User clicks "Confirm Sell"
   ↓
9. POST /api/portfolio/trade { side: 'sell', ... }
   ↓
10. Backend:
    - Check sufficient quantity
    - Calculate realized PnL
    - Create trade
    - Create realized_pnl_log
   ↓
11. Portfolio refetches → Holdings + PnL update
```

**Components:**
- `<Dialog>`: Add/Sell modals
- `<Select>`: Coin dropdown for sell
- `<Input>`: Quantity input
- `<Button>`: Add/Sell/Delete buttons
- `<Table>`: Holdings and trade history

**Backend Connections:**
- `GET /api/portfolio` (every 1s)
- `GET /api/price/:symbol` (on symbol blur)
- `POST /api/portfolio/trade` (add/sell)
- `DELETE /api/portfolio/trade/:id` (delete)

### 7.4 Quant Lab (`/strategies`)

**Component:** `client/src/pages/Strategies.tsx`

**Data Loading:**
```typescript
// Fetch 10 coins in parallel
const coins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];

const { data: scores, isLoading } = useQueries({
  queries: coins.map(symbol => ({
    queryKey: ['quant-score', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/quant/score/${symbol}?interval=1d`);
      return res.json();
    },
    refetchInterval: 300000  // 5 minutes (expensive calculation)
  }))
});
```

**Calculations:**
- Multi-factor scoring (see section 6.7)
- 10 coins analyzed in parallel
- Results cached for 5 minutes

**UI Display:**
- Grid of 10 coin cards
- Each card shows:
  - Symbol
  - Score (0-100) with color gradient
  - Signal (Bullish/Bearish/Neutral)
  - Confidence %
  - Factor breakdown (radar chart or bars)
  - Explanation text

**State:**
- No local state (all from React Query)

**Backend Connection:**
- `GET /api/quant/score/BTC` (x10 for all coins)

### 7.5 Coin Detail (`/coin/:symbol`)

**Component:** `client/src/pages/CoinDetail.tsx`

**Data Loading:**
```typescript
const { symbol } = useParams();

// Coin metadata
const { data: coin } = useQuery({
  queryKey: ['coin', symbol],
  queryFn: async () => {
    const res = await fetch(`/api/coin/${symbol}`);
    return res.json();
  }
});

// OHLC data for chart
const { data: klines } = useQuery({
  queryKey: ['klines', symbol, interval],
  queryFn: async () => {
    const res = await fetch(`/api/klines/${symbol}?interval=${interval}&limit=100`);
    return res.json();
  }
});

// Quant score
const { data: score } = useQuery({
  queryKey: ['quant-score', symbol],
  queryFn: async () => {
    const res = await fetch(`/api/quant/score/${symbol}`);
    return res.json();
  }
});
```

**State:**
```typescript
const [interval, setInterval] = useState<'1h' | '4h' | '1d' | '1w'>('1d');
```

**UI Sections:**
1. **Header**: Coin name, symbol, current price, 24h change
2. **Price Chart**: Recharts candlestick/line chart with interval selector
3. **Quant Analysis**: Score, signal, confidence, factor breakdown
4. **Metadata**: Market cap, volume, circulating supply, ATH

**Backend Connections:**
- `GET /api/coin/:symbol`
- `GET /api/klines/:symbol?interval=1d&limit=100`
- `GET /api/quant/score/:symbol`

---

## 8. Real-Time Update System

### 8.1 Architecture

**Not WebSocket-Based** (Despite the name suggesting it)

The system uses **HTTP polling** via TanStack Query's `refetchInterval`:

```
Client (React Query)
  ↓
  Every 1 second:
    GET /api/portfolio
      ↓
    Backend fetches live prices from Binance/CoinGecko
      ↓
    Calculates unrealized PnL
      ↓
    Returns updated portfolio
      ↓
    React Query updates cache
      ↓
    UI re-renders with new values
```

### 8.2 Price Feed Integration

**Dual-Source Strategy:**

1. **Primary:** Binance API
   - Endpoint: `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`
   - Pros: Fast, reliable, high-quality data
   - Cons: Rate limits, occasional downtime

2. **Fallback:** CoinGecko API
   - Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
   - Pros: More reliable availability
   - Cons: Slower, less frequent updates

**Implementation:**
```typescript
// server/lib/marketData.ts
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  // Try Binance first
  try {
    const pair = `${symbol.toUpperCase()}USDT`;
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
    if (res.ok) {
      const data = await res.json();
      return parseFloat(data.price);
    }
  } catch (error) {
    // Silently fall through to CoinGecko
  }
  
  // Fallback to CoinGecko
  try {
    const coinId = symbolToCoinGeckoId(symbol);
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    if (res.ok) {
      const data = await res.json();
      return data[coinId]?.usd || null;
    }
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
  }
  
  return null;
}
```

### 8.3 Portfolio PnL Refresh Logic

**Backend Calculation:**
```typescript
// server/routes.ts - GET /api/portfolio
const holdings: Record<string, { quantity: number; avgEntry: number }> = {};

// Step 1: Aggregate trades into holdings
for (const trade of trades) {
  if (trade.side === 'buy') {
    const prevTotal = holdings[symbol].quantity * holdings[symbol].avgEntry;
    holdings[symbol].quantity += quantity;
    holdings[symbol].avgEntry = (prevTotal + quantity * price) / holdings[symbol].quantity;
  } else {
    holdings[symbol].quantity -= quantity;
  }
}

// Step 2: Fetch live prices for each holding
for (const [symbol, data] of Object.entries(holdings)) {
  if (data.quantity > 0) {
    const currentPrice = await fetchCurrentPrice(symbol) || data.avgEntry;  // Fallback to avg entry
    const unrealizedPnl = (currentPrice - data.avgEntry) * data.quantity;
    const value = data.quantity * currentPrice;
    
    holdingsWithValue.push({
      symbol,
      quantity: data.quantity,
      avgEntry: data.avgEntry,
      currentPrice,
      unrealizedPnl,
      value,
      pnlPercent: ((currentPrice - data.avgEntry) / data.avgEntry) * 100
    });
  }
}

// Step 3: Sum realized PnL from database
const realizedPnlLogs = await storage.getRealizedPnlLogsByPortfolioId(portfolioId);
const totalRealizedPnl = realizedPnlLogs.reduce((sum, log) => sum + parseFloat(log.realizedPnl), 0);

// Step 4: Return aggregated data
return {
  holdings: holdingsWithValue,
  totalValue: sum of all holdings values,
  realizedPnl: totalRealizedPnl,
  unrealizedPnl: sum of all holdings unrealizedPnl,
  totalPnl: realizedPnl + unrealizedPnl
};
```

**Frontend Display:**
```typescript
// client/src/pages/Portfolio.tsx
const { data: portfolio } = useQuery({
  queryKey: ['portfolio'],
  queryFn: fetchPortfolio,
  refetchInterval: 1000  // 1 second
});

const realizedPnl = portfolio?.realizedPnl || 0;
const unrealizedPnl = portfolio?.unrealizedPnl || 0;
const totalPnl = portfolio?.totalPnl || 0;

return (
  <>
    <div className={totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
      {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
    </div>
  </>
);
```

### 8.4 Update Frequencies

| Data Type | Frequency | Reason |
|-----------|-----------|--------|
| Portfolio Prices & PnL | 1 second | Critical for trading decisions |
| Market List (Top 50) | 60 seconds | Balances freshness vs API limits |
| Quant Signals | 5 minutes | Computationally expensive |
| Market Regime | 5 minutes | Slow-moving indicator |
| Coin Detail | On-demand | User-initiated navigation |

### 8.5 Performance Optimizations

**React Query Caching:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,           // Always refetch on mount
      cacheTime: 5 * 60 * 1000,  // Keep in cache for 5 minutes
      refetchOnWindowFocus: true,
      retry: 1
    }
  }
});
```

**Debouncing (not currently implemented):**
- Could add debouncing to reduce API calls when user switches tabs rapidly

**Conditional Fetching:**
```typescript
// Only fetch if user is authenticated
const { data } = useQuery({
  queryKey: ['portfolio'],
  queryFn: fetchPortfolio,
  enabled: !!user  // Don't fetch if not logged in
});
```

---

## 9. Security Model

### 9.1 Authentication Model

**Provider:** Replit Auth (OpenID Connect)

**Flow:**
```
1. User visits site → No session → Redirect to login page
   ↓
2. User clicks "Login" → GET /api/login
   ↓
3. Backend: authClient.authorize() → Redirect to Replit OAuth
   ↓
4. User grants permission on Replit
   ↓
5. Replit redirects to GET /api/callback?code=xyz
   ↓
6. Backend:
   - authClient.exchangeCode(code) → Get tokens + user info
   - Check if user exists in DB
   - If not: INSERT INTO users (id, email, firstName, lastName, profileImageUrl)
   - Store user in session: req.session.user = userInfo
   ↓
7. Redirect to /
   ↓
8. All subsequent requests include session cookie
```

**Implementation:**
```typescript
// server/replitAuth.ts
export function setupAuth(app: Express) {
  const authClient = new ReplitAuthClient();
  
  app.get('/api/login', (req, res) => {
    const authUrl = authClient.getAuthorizationUrl();
    res.redirect(authUrl);
  });
  
  app.get('/api/callback', async (req, res) => {
    const { code } = req.query;
    const userInfo = await authClient.exchangeCode(code);
    
    // Upsert user in database
    await storage.upsertUser({
      id: userInfo.sub,
      email: userInfo.email,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      profileImageUrl: userInfo.picture
    });
    
    req.session.user = userInfo;
    res.redirect('/');
  });
  
  app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
  });
}
```

### 9.2 Token Handling

**Session Storage:**
- **Engine:** PostgreSQL
- **Library:** `express-session` + `connect-pg-simple`
- **Cookie:** HTTP-only, Secure (in production), SameSite=Lax

**Configuration:**
```typescript
// server/app.ts
const sessionStore = new PostgresStore({
  pool: dbPool,
  tableName: 'sessions',
  createTableIfMissing: true
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));
```

**Session Data:**
```json
{
  "user": {
    "sub": "49889974",
    "email": "user@example.com",
    "given_name": "John",
    "family_name": "Doe",
    "picture": "https://..."
  },
  "cookie": {
    "originalMaxAge": 604800000,
    "expires": "2025-12-03T...",
    "httpOnly": true,
    "path": "/"
  }
}
```

### 9.3 Authorization Middleware

**isAuthenticated() Function:**
```typescript
// server/replitAuth.ts
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.session?.user) {
    // Attach user to request
    req.user = {
      claims: {
        sub: req.session.user.sub,
        email: req.session.user.email
      }
    };
    return next();
  }
  
  return res.status(401).json({ message: 'Unauthorized' });
}
```

**Usage:**
```typescript
// Protected routes
app.get('/api/portfolio', isAuthenticated, async (req, res) => {
  const userId = req.user.claims.sub;  // Safe to access
  // ...
});

app.post('/api/portfolio/trade', isAuthenticated, async (req, res) => {
  const userId = req.user.claims.sub;
  // ...
});
```

### 9.4 Data Validation Strategy

**Runtime Validation with Zod:**
```typescript
// shared/schema.ts
export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true
}).extend({
  date: z.coerce.date()  // Accept Date or ISO string
});

// server/routes.ts
app.post('/api/portfolio/trade', isAuthenticated, async (req, res) => {
  try {
    const validated = insertTradeSchema.parse(req.body);  // Throws if invalid
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
  }
});
```

**Validation Rules:**
- **Trade quantity:** Must be positive decimal (up to 8 decimals)
- **Trade price:** Must be positive decimal (up to 2 decimals)
- **Trade side:** Must be 'buy' or 'sell'
- **Date:** Must be valid Date or ISO string
- **Symbol:** 1-10 uppercase letters (validated by regex in frontend)

### 9.5 Database-Level Access Control

**Current Implementation:**
- **Application-level:** All access control in TypeScript
- **Ownership filtering:**
  ```typescript
  const portfolios = await storage.getPortfoliosByUserId(userId);
  // Only returns portfolios owned by userId
  ```

**No RLS Policies Yet** (Future Enhancement):
```sql
-- Example RLS policy (not implemented)
CREATE POLICY user_portfolios ON portfolios
  FOR ALL
  USING (user_id = current_user_id());
```

### 9.6 Input Sanitization

**XSS Protection:**
- **React default:** All user input auto-escaped
- **Database queries:** Parameterized queries via Drizzle ORM (no raw SQL)
- **Example:**
  ```typescript
  // Safe - Drizzle uses prepared statements
  await db.insert(trades).values({ symbol: userInput });
  
  // Unsafe (not used)
  // await db.execute(`INSERT INTO trades VALUES ('${userInput}')`);
  ```

**SQL Injection Prevention:**
- **100% Drizzle ORM:** No raw SQL queries
- **Prepared statements:** All user input parameterized

**API Key Security:**
- **Environment variables:** Never committed to Git
- **Secrets:**
  - `XAI_API_KEY` (Grok)
  - `AI_INTEGRATIONS_OPENAI_API_KEY` (GPT)
  - `DATABASE_URL` (PostgreSQL)
- **Access:** Only backend has access, never sent to frontend

### 9.7 CORS & CSP

**CORS:**
- Currently open (development)
- Production: Should restrict to `*.replit.dev`

**Content Security Policy:**
- Not yet implemented
- Future: Add CSP headers to prevent XSS

### 9.8 Rate Limiting

**Currently None** (Future Enhancement)

Recommended implementation:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 60  // 60 requests per minute
});

app.use('/api/', limiter);
```

---

## 10. Known Limitations / Improvements

### 10.1 Missing Features

**Critical:**
1. **WebSocket Support:** Currently polling at 1s - inefficient for large user base
2. **Real-Time Alerts:** No price alerts or signal notifications
3. **Backtesting Engine:** Can't test strategies on historical data
4. **Multi-Portfolio Support:** UI only shows first portfolio
5. **Transaction History Export:** No CSV/PDF export

**Nice-to-Have:**
6. **Dark/Light Mode Toggle:** Hardcoded to dark theme
7. **Customizable Dashboard:** Fixed widget layout
8. **Advanced Charting:** Only basic line/candlestick charts
9. **Portfolio Sharing:** No social/sharing features
10. **Mobile App:** Web-only, no native apps

### 10.2 Performance Optimizations Needed

**Backend:**
1. **Caching Layer:** Add Redis for expensive quant calculations
   - Cache quant scores for 5 minutes
   - Cache market data for 1 minute
   - Cache coin metadata for 1 hour

2. **Database Indexing:**
   ```sql
   CREATE INDEX idx_trades_portfolio_id ON trades(portfolio_id);
   CREATE INDEX idx_trades_symbol ON trades(symbol);
   CREATE INDEX idx_quant_signals_symbol ON quant_signals(symbol);
   ```

3. **Connection Pooling:** Increase pool size for high traffic
   ```typescript
   const pool = new Pool({
     connectionString: DATABASE_URL,
     max: 20  // Currently default 10
   });
   ```

4. **Batch Price Fetching:** Fetch all portfolio prices in 1 API call instead of N calls
   ```typescript
   // Instead of:
   for (const symbol of symbols) {
     await fetchCurrentPrice(symbol);  // N API calls
   }
   
   // Use:
   const prices = await fetchMultiplePrices(symbols);  // 1 API call
   ```

**Frontend:**
1. **Virtual Scrolling:** Large market tables (1000+ coins) cause lag
2. **Code Splitting:** Bundle size is 2.5MB - should lazy-load routes
3. **Image Optimization:** Coin logos not optimized (use WebP)
4. **Memoization:** Heavy calculations not memoized (React.memo, useMemo)

### 10.3 Security Enhancements

1. **Rate Limiting:** Prevent API abuse
2. **RLS Policies:** Database-level multi-tenancy
3. **CSP Headers:** Prevent XSS attacks
4. **API Key Rotation:** Automated key rotation for AI APIs
5. **Input Validation:** More strict regex patterns for symbols/amounts
6. **Audit Logging:** Log all trade actions for compliance

### 10.4 Scalability Concerns

**Current Limits:**
- **Users:** ~100 concurrent (PostgreSQL connection limit)
- **Portfolios:** Fetching prices for 100+ holdings takes >5s
- **Quant Calculations:** 200-day OHLC data for 10 coins = 20s
- **Database Size:** No archival strategy for old trades

**Solutions:**
1. **Horizontal Scaling:** Deploy multiple backend instances with load balancer
2. **Queue System:** Bull/BullMQ for async quant calculations
3. **Microservices:** Split quant engine into separate service
4. **CDN:** Serve static assets via Cloudflare/Vercel
5. **Database Sharding:** Partition trades table by portfolio_id

### 10.5 Code Quality Improvements

**Technical Debt:**
1. **Error Boundaries:** No React error boundaries (crashes show white screen)
2. **TypeScript Strictness:** `any` types used in 15+ places
3. **Test Coverage:** 0% (no unit tests, no integration tests)
4. **Logging:** Console.log only - need structured logging (Winston/Pino)
5. **API Versioning:** No `/api/v1/` - breaking changes will break clients

**Documentation:**
6. **API Docs:** No Swagger/OpenAPI spec
7. **Component Storybook:** No component documentation
8. **Inline Comments:** Minimal code comments
9. **Architecture Diagrams:** This document is the only one

### 10.6 DevOps & Monitoring

**Missing:**
1. **CI/CD Pipeline:** No automated testing/deployment
2. **Error Tracking:** No Sentry/Rollbar integration
3. **Performance Monitoring:** No APM (New Relic, Datadog)
4. **Uptime Monitoring:** No alerts if site goes down
5. **Database Backups:** No automated backup strategy

**Recommended Setup:**
```yaml
# .github/workflows/ci.yml
name: CI/CD
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
      - run: npm run build
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: replit deploy production
```

### 10.7 Suggested Roadmap

**Phase 1 (Month 1-2): Stability**
- Add error boundaries
- Implement rate limiting
- Add database indexes
- Set up error tracking (Sentry)
- Write critical tests (portfolio calculations)

**Phase 2 (Month 3-4): Performance**
- Implement Redis caching
- Add code splitting
- Optimize bundle size
- Batch price fetching
- Database query optimization

**Phase 3 (Month 5-6): Features**
- WebSocket real-time updates
- Price alerts & notifications
- Backtesting engine
- Multi-portfolio support
- CSV export

**Phase 4 (Month 7-8): Scale**
- Microservices architecture
- Queue system for quant jobs
- Horizontal scaling setup
- CDN integration
- Database sharding

---

## Conclusion

QuantEdge-AI is a production-grade quantitative cryptocurrency analytics platform built with modern web technologies. The system combines institutional-level technical analysis with AI-powered insights, providing traders with comprehensive market intelligence.

**Key Strengths:**
- Modular quantitative engine with 7 mathematical modules
- Hybrid AI system (Grok + GPT + Quant)
- Real-time P&L tracking with 1-second updates
- Type-safe end-to-end architecture
- Dual-source price feed fallback

**Areas for Improvement:**
- Scale to support 1000+ concurrent users
- Add comprehensive test coverage
- Implement WebSocket for true real-time updates
- Enhance security with RLS and rate limiting
- Optimize performance with caching layer

**Technology Maturity:**
- Frontend: Production-ready
- Backend: MVP-ready, needs optimization
- Database: Stable schema, needs indexing
- AI Integration: Functional, needs error handling
- DevOps: Minimal, needs CI/CD pipeline

This architecture document serves as the technical foundation for future development and onboarding of new team members.

---

**Document Version:** 1.0  
**Last Updated:** November 26, 2025  
**Next Review:** December 26, 2025
