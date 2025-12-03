# Unified Quantitative Engine Documentation

## Overview

The QuantArchitect system now uses a **unified quantitative analysis engine** that integrates ALL available formulas from the codebase to compute comprehensive trading signals, market regimes, and risk assessments.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Dashboard │  │ Markets  │  │Quant Lab │  │Coin Page │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │              │           │
│       └─────────────┴──────────────┴──────────────┘           │
│                          │                                    │
│                    API Client                                 │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    BACKEND (Express)                         │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────┐          │
│  │         Unified Quant Engine                   │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │          │
│  │  │  Trend   │  │ Momentum │  │Volatility│    │          │
│  │  └──────────┘  └──────────┘  └──────────┘    │          │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │          │
│  │  │ Volume   │  │   Risk   │  │Sentiment │    │          │
│  │  └──────────┘  └──────────┘  └──────────┘    │          │
│  └───────────────────────────────────────────────┘          │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              API Routes                         │          │
│  │  /api/quant/top50                               │          │
│  │  /api/quant/:symbol                             │          │
│  │  /api/quant/signal/:symbol                      │          │
│  │  /api/regime                                    │          │
│  │  /api/chatbot                                   │          │
│  └─────────────────────────────────────────────────┘          │
│                          │                                    │
│  ┌───────────────────────┴───────────────────────┐          │
│  │         Data Sources                           │          │
│  │  Binance API (OHLCV)                           │          │
│  │  CoinGecko API (Market Data)                   │          │
│  │  Grok API (Sentiment)                           │          │
│  │  OpenAI API (Formatting)                        │          │
│  └─────────────────────────────────────────────────┘          │
└───────────────────────────────────────────────────────────────┘
```

## Formula Usage

### 1. Trend Analysis (`server/lib/quant/trend.ts`)

**All formulas used:**
- ✅ **Linear Regression Slope** - Measures trend direction and strength
- ✅ **Hurst Exponent** - Detects trending vs mean-reverting markets
- ✅ **MACD Histogram** - Moving average convergence/divergence
- ✅ **MA Crossovers** - Implicit in MACD calculation
- ✅ **Trend Direction** - Determines Up/Down/Sideways

**Normalization:** Combined into 0-100 score using weighted average:
- Slope: 40%
- Hurst: 30%
- MACD: 30%

### 2. Momentum Analysis (`server/lib/quant/momentum.ts`)

**All formulas used:**
- ✅ **Z-Score** - Price deviation from mean
- ✅ **Sharpe Ratio** - Risk-adjusted returns
- ✅ **Sortino Ratio** - Downside risk-adjusted returns
- ✅ **RSI** - Relative Strength Index
- ✅ **RSI-Z** - Normalized RSI
- ✅ **ROC** - Rate of Change

**Normalization:** Combined into 0-100 score:
- Z-Score: 20%
- Sharpe: 20%
- Sortino: 15%
- RSI: 15%
- RSI-Z: 10%
- ROC: 20%

### 3. Volatility Analysis (`server/lib/quant/volatility.ts`)

**All formulas used:**
- ✅ **Historical Volatility** - Standard deviation of log returns
- ✅ **ATR** - Average True Range
- ✅ **Parkinson Volatility** - High-low range estimator
- ✅ **Garman-Klass Volatility** - OHLC estimator
- ✅ **Volatility Regime** - Low/Normal/High classification

**Normalization:** Inverted (lower volatility = higher score):
- Average of all volatility measures
- Regime bonus/penalty applied

### 4. Volume Analysis (`server/lib/quant/volume.ts`)

**All formulas used:**
- ✅ **Volume Z-Score** - Abnormal volume detection
- ✅ **MFI** - Money Flow Index
- ✅ **OBV** - On-Balance Volume (implicit in volume trend)
- ✅ **Price-Volume Confirmation** - Strong/Weak Up/Down/Neutral

**Normalization:** Already returns 0-100 score

### 5. Risk Analysis (`server/lib/quant/risk.ts`)

**All formulas used:**
- ✅ **Beta** - Correlation with benchmark
- ✅ **Max Drawdown** - Peak-to-trough decline
- ✅ **Downside Deviation** - Negative return volatility
- ✅ **VaR (95%)** - Value at Risk 95th percentile
- ✅ **VaR (99%)** - Value at Risk 99th percentile

**Normalization:** Combined into 0-100 risk score (higher = riskier)

### 6. Sentiment Analysis

**Sources:**
- ✅ **Grok API** (primary) - Real-time sentiment analysis
- ✅ **OpenAI API** (fallback) - Sentiment extraction
- Returns 0-100 score (0 = bearish, 50 = neutral, 100 = bullish)

## Composite Score Calculation

**New Formula (replaces old 30/20/20/15/15 model):**

```
compositeScore = 
  0.20 * trend +
  0.20 * momentum +
  0.20 * volatility +
  0.15 * volume +
  0.15 * (100 - risk) +  // Risk inverted (lower risk = higher score)
  0.10 * sentiment
```

All inputs normalized to 0-100 range.

## Trading Signal Logic

**Multi-factor signal determination:**

```typescript
if (compositeScore >= 70 AND sentiment > 55 AND momentum > 60):
    signal = "BUY"
else if (compositeScore <= 35 AND risk > 65):
    signal = "SELL"
else:
    signal = "HOLD"
```

This is a **multi-factor signal**, not just numeric thresholds.

## Market Regime Classification

**Combined models:**
- **Volatility Regime**: Low / Normal / High
- **Trend Regime**: Up / Down / Sideways
- **Liquidity Regime**: Volume confirmation
- **Momentum Regime**: Acceleration/deceleration
- **Risk Regime**: Drawdown, VaR, beta

**Final classification:**
- **Bull**: Above EMA200, Up trend, Strong momentum, Low risk
- **Bear**: Below EMA200, Down trend, Weak momentum, High risk
- **Sideways**: Default/neutral conditions

## API Endpoints

### `GET /api/quant/top50`
Returns quant analysis for top 50 coins.

**Query Parameters:**
- `limit` (default: 50) - Number of coins
- `interval` (default: '1d') - Data interval ('1h' | '1d')

**Response:**
```json
[
  {
    "symbol": "BTC",
    "scores": {
      "trend": 75,
      "momentum": 68,
      "volatility": 65,
      "volume": 72,
      "risk": 45,
      "sentiment": 60,
      "compositeScore": 68
    },
    "signal": "BUY",
    "marketRegime": "bull",
    "confidence": 82,
    "metrics": { ... }
  }
]
```

### `GET /api/quant/:symbol`
Get detailed quant analysis for a single symbol.

**Query Parameters:**
- `interval` (default: '1d') - Data interval

**Response:** Full `QuantEngineOutput` object

### `GET /api/quant/signal/:symbol`
Get lightweight trading signal.

**Response:**
```json
{
  "symbol": "BTC",
  "signal": "BUY",
  "compositeScore": 68,
  "confidence": 82,
  "marketRegime": "bull"
}
```

### `GET /api/regime`
Calculate overall market regime (uses BTC as benchmark).

**Response:**
```json
{
  "regime": "bull",
  "volatility": "Normal",
  "trendStrength": 75,
  "confidence": 82,
  "explanation": "..."
}
```

### `POST /api/chatbot`
AI chatbot with full pipeline.

**Request:**
```json
{
  "message": "Should I buy Bitcoin?"
}
```

**Pipeline:**
1. Symbol extraction (supports top 50 coins)
2. Quant engine analysis
3. Grok sentiment (with OpenAI fallback)
4. GPT signal enhancement
5. Formatted response

## Caching Layer

**In-memory cache** (`server/lib/cache.ts`):
- TTL: 1 minute for quant calculations
- TTL: 5 minutes for regime analysis
- Automatic cleanup of expired entries

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key (for GPT formatting)
- `XAI_API_KEY` or `GROK_API_KEY` - Grok API key (for sentiment)

**Optional:**
- `BINANCE_API_KEY` - Binance API key (for authenticated requests)
- `NEWS_API_KEY` - News API key (for future news sentiment)

## Data Flow

1. **Frontend Request** → API endpoint
2. **Cache Check** → Return cached if valid
3. **Market Data Fetch** → Binance/CoinGecko
4. **Quant Engine** → Run all formulas
5. **Cache Store** → Save result
6. **Database Log** → Store signal
7. **Response** → Return to frontend

## Performance Optimizations

- ✅ In-memory caching (1-5 min TTL)
- ✅ Parallel processing for top 50 coins
- ✅ Efficient formula calculations
- ✅ Database logging (non-blocking)

## Testing

Run the quant engine test:
```bash
npm run test:quant
```

## Future Enhancements

- [ ] WebSocket support for live updates
- [ ] Redis caching for distributed systems
- [ ] Machine learning model integration
- [ ] Portfolio optimization algorithms
- [ ] Backtesting framework

