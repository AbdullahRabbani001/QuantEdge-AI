// Unified Quantitative Analysis Engine
// Integrates ALL formulas from statistics, trend, momentum, volatility, volume, and risk modules

import { 
  mean, 
  standardDeviation, 
  logReturns, 
  simpleMovingAverage, 
  exponentialMovingAverage,
  downsideDeviation as calcDownsideDeviation,
  percentile
} from './statistics';
import { 
  calculateTrendMetrics, 
  calculateRegressionSlope, 
  calculateHurstExponent, 
  calculateMACD,
  determineTrendDirection
} from './trend';
import { 
  calculateMomentumMetrics, 
  calculateZScore, 
  calculateSharpeRatio, 
  calculateSortinoRatio, 
  calculateRSI,
  calculateRSIZ,
  calculateROC
} from './momentum';
import { 
  calculateVolatilityMetrics, 
  calculateHistoricalVolatility, 
  calculateParkinsonVolatility,
  calculateGarmanKlassVolatility,
  calculateATR,
  determineVolatilityRegime,
  type OHLC
} from './volatility';
import { 
  calculateVolumeMetrics, 
  calculateVolumeZScore, 
  calculateMFI,
  determinePriceVolumeConfirmation
} from './volume';
import { 
  calculateRiskMetrics, 
  calculateBeta, 
  calculateMaxDrawdown, 
  calculateVaR
} from './risk';

export interface QuantEngineInput {
  symbol: string;
  prices: number[]; // Close prices
  ohlc: OHLC[]; // OHLC data
  volumes: number[];
  marketCap?: number;
  benchmarkPrices?: number[]; // For beta calculation
  sentimentScore?: number; // 0-100, defaults to 50
  interval?: '1h' | '1d'; // Data interval
}

export interface QuantEngineOutput {
  symbol: string;
  scores: {
    trend: number; // 0-100
    momentum: number; // 0-100
    volatility: number; // 0-100
    volume: number; // 0-100
    risk: number; // 0-100
    sentiment: number; // 0-100
    compositeScore: number; // 0-100
  };
  signal: 'BUY' | 'SELL' | 'HOLD';
  marketRegime: 'bull' | 'bear' | 'sideways';
  confidence: number; // 0-100
  forecast?: {
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    probability: number; // 0-100
    trendContinuation: number; // 0-100
    trendReversal: number; // 0-100
    support: number;
    resistance: number;
    priceTarget?: number;
  };
  metrics: {
    // Trend metrics
    trend: {
      slope: number;
      hurstExponent: number;
      macdHistogram: number;
      trendDirection: 'Up' | 'Down' | 'Sideways';
    };
    // Momentum metrics
    momentum: {
      zScore: number;
      sharpeRatio: number;
      sortinoRatio: number;
      rsi: number;
      rsiZ: number;
      roc: number;
    };
    // Volatility metrics
    volatility: {
      historicalVol: number;
      parkinsonVol: number;
      garmanKlassVol: number;
      atr: number;
      regime: 'High' | 'Normal' | 'Low';
    };
    // Volume metrics
    volume: {
      volumeZScore: number;
      mfi: number;
      priceVolumeConfirmation: string;
    };
    // Risk metrics
    risk: {
      beta: number;
      maxDrawdown: number;
      downsideDeviation: number;
      var95: number;
      var99: number;
    };
  };
}

/**
 * Normalize a value to 0-100 range
 */
function normalizeTo100(value: number, min: number, max: number): number {
  if (max === min) return 50;
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Normalize trend score to 0-100
 */
function normalizeTrendScore(slope: number, hurst: number, macdHist: number, direction: string): number {
  // Slope component: -2% to +2% maps to 0-100
  const slopeScore = normalizeTo100(slope, -2, 2);
  
  // Hurst component: 0-1 maps to 0-100
  const hurstScore = hurst * 100;
  
  // MACD histogram component: normalize by standard deviation
  // Positive MACD = bullish, negative = bearish
  const macdScore = 50 + (macdHist > 0 ? Math.min(50, macdHist * 10) : Math.max(-50, macdHist * 10));
  
  // Direction bonus
  let directionBonus = 0;
  if (direction === 'Up') directionBonus = 10;
  else if (direction === 'Down') directionBonus = -10;
  
  // Weighted combination
  const score = (slopeScore * 0.4 + hurstScore * 0.3 + macdScore * 0.3) + directionBonus;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Normalize momentum score to 0-100
 */
function normalizeMomentumScore(
  zScore: number, 
  sharpe: number, 
  sortino: number, 
  rsi: number, 
  rsiZ: number,
  roc: number
): number {
  // Z-Score component: -3 to +3 maps to 0-100
  const zScoreComponent = normalizeTo100(zScore, -3, 3);
  
  // Sharpe component: -1 to 3 maps to 0-100
  const sharpeComponent = normalizeTo100(sharpe, -1, 3);
  
  // Sortino component: -1 to 3 maps to 0-100
  const sortinoComponent = normalizeTo100(sortino, -1, 3);
  
  // RSI component: already 0-100
  const rsiComponent = rsi;
  
  // RSI-Z component: -2 to +2 maps to 0-100
  const rsiZComponent = normalizeTo100(rsiZ, -2, 2);
  
  // ROC component: -20% to +20% maps to 0-100
  const rocComponent = normalizeTo100(roc, -20, 20);
  
  // Weighted combination (including ROC)
  const score = (
    zScoreComponent * 0.20 +
    sharpeComponent * 0.20 +
    sortinoComponent * 0.15 +
    rsiComponent * 0.15 +
    rsiZComponent * 0.10 +
    rocComponent * 0.20
  );
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Normalize volatility score to 0-100
 * Optimal volatility range (5-30%) gets highest score
 * Too low (<5%) = stablecoin penalty, too high (>50%) = high risk penalty
 */
function normalizeVolatilityScore(
  historicalVol: number, 
  parkinsonVol: number, 
  garmanKlassVol: number,
  regime: string
): number {
  // Average of all volatility measures
  const avgVol = (historicalVol + parkinsonVol + garmanKlassVol) / 3;
  
  // Optimal volatility range for trading: 5-30% (gets highest score)
  // Too low (<5%) = stablecoin, penalize for lack of movement
  // Too high (>50%) = excessive risk, penalize
  let volScore: number;
  
  if (avgVol < 5) {
    // Very low volatility (stablecoin territory) - penalize heavily
    // 0% vol = 40 score, 5% vol = 70 score
    volScore = 40 + (avgVol / 5) * 30;
  } else if (avgVol <= 30) {
    // Optimal range: 5-30% volatility
    // 5% = 70, 30% = 100 (inverted, so lower is better but not too low)
    volScore = 70 + ((30 - avgVol) / 25) * 30;
  } else if (avgVol <= 50) {
    // Moderate-high volatility: 30-50%
    // 30% = 100, 50% = 60
    volScore = 100 - ((avgVol - 30) / 20) * 40;
  } else {
    // Very high volatility (>50%) - penalize
    // 50% = 60, 100% = 0
    volScore = Math.max(0, 60 - ((avgVol - 50) / 50) * 60);
  }
  
  // Regime adjustment (smaller impact)
  let regimeBonus = 0;
  if (regime === 'Low' && avgVol >= 5) regimeBonus = 5; // Only bonus if not stablecoin
  else if (regime === 'Normal') regimeBonus = 0;
  else if (regime === 'High') regimeBonus = -10;
  
  const score = volScore + regimeBonus;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Check if a symbol is a stablecoin
 * Comprehensive detection: by symbol name, price proximity to $1.00, and patterns
 */
function isStablecoin(symbol: string, currentPrice?: number): boolean {
  const symbolUpper = symbol.toUpperCase().trim();
  
  
  // Comprehensive list of stablecoin symbols and patterns
  const stablecoinPatterns = [
    'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD', 'GUSD', 
    'FRAX', 'LUSD', 'SUSD', 'MIM', 'USDX', 'USDN', 'EURS', 'USDS', 
    'USDK', 'HUSD', 'PAX', 'CUSD', 'USDJ', 'USDE', 'USD1', 'USDT0'
  ];
  

  // Check if symbol matches stablecoin patterns (exact, starts with, or contains)
  for (const pattern of stablecoinPatterns) {
    if (symbolUpper === pattern) {
      return true; // Exact match
    }
    // Check if symbol starts with pattern (e.g., USDT0 starts with USDT)
    if (symbolUpper.startsWith(pattern) && pattern.length >= 3) {
      return true;
    }
    // Check if pattern is contained in symbol (e.g., USDT in USDT0)
    if (symbolUpper.includes(pattern) && pattern.length >= 3) {
      return true;
    }
  }
  
  // Special check for USDT variants (USDT0, USDT1, etc.)
  if (symbolUpper.startsWith('USDT') || symbolUpper === 'USDT') {
    return true;
  }
  
  // Check for USD-prefixed patterns (but exclude non-stablecoins)
  if (symbolUpper.startsWith('USD') || symbolUpper.includes('USD')) {
    // Exclude known non-stablecoins
    const nonStablecoins = ['USDM', 'USDTM', 'USDXBT', 'USDXRP'];
    const isNonStable = nonStablecoins.some(ns => symbolUpper.includes(ns));
    if (!isNonStable) {
      // If it's USD-prefixed and price is close to $1, likely stablecoin
      if (currentPrice !== undefined && currentPrice > 0) {
        const priceDiff = Math.abs(currentPrice - 1.0);
        if (priceDiff < 0.20) { // Within 20 cents of $1.00
          return true;
        }
      }
    }
  }
  
  // PRIMARY CHECK: If price is very close to $1.00, it's DEFINITELY a stablecoin
  // This is the most reliable indicator - stablecoins maintain ~$1.00 price
  if (currentPrice !== undefined && currentPrice > 0) {
    const priceDiff = Math.abs(currentPrice - 1.0);
    // If price is within 15 cents of $1.00, it's almost certainly a stablecoin
    if (priceDiff <= 0.15 && currentPrice >= 0.85 && currentPrice <= 1.15) {
      console.log(`[isStablecoin] Detected stablecoin by price: ${symbol} at $${currentPrice.toFixed(2)}`);
      return true;
    }
    // If price is exactly $1.00 or very close (within 5 cents), definitely stablecoin
    if (priceDiff <= 0.05) {
      console.log(`[isStablecoin] Detected stablecoin by exact price: ${symbol} at $${currentPrice.toFixed(2)}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate composite score using new weights
 * 0.25 * trend + 0.25 * momentum + 0.15 * volatility + 0.15 * volume + 0.10 * risk + 0.10 * sentiment
 * 
 * Adjusted weights to emphasize trend and momentum (trading signals)
 * Reduced volatility and risk weights to prevent stablecoins from scoring too high
 */
function calculateCompositeScore(
  trend: number,
  momentum: number,
  volatility: number,
  volume: number,
  risk: number,
  sentiment: number,
  symbol?: string,
  currentPrice?: number
): number {
  // Invert risk score: lower risk = higher score, but cap the benefit
  // Very low risk (stablecoins) shouldn't dominate the score
  const rawRiskScore = 100 - risk;
  // Cap risk benefit: max 70 points (prevents stablecoins from getting 100)
  const riskScore = Math.min(70, rawRiskScore);
  
  // Detect stablecoin by symbol or price
  const isStable = symbol ? isStablecoin(symbol, currentPrice) : false;
  
  // Calculate raw score with adjusted weights
  // Increased trend and momentum weights for better trading signals
  const rawScore = 
    trend * 0.25 +           // Increased from 0.20
    momentum * 0.25 +        // Increased from 0.20
    volatility * 0.15 +      // Decreased from 0.20
    volume * 0.15 +          // Same
    riskScore * 0.10 +       // Decreased from 0.15
    sentiment * 0.10;        // Same
  
  // Apply stablecoin penalty - force neutral score
  let finalScore = rawScore;
  if (isStable) {
    // Stablecoins should ALWAYS be neutral (exactly 50) - they're not trading opportunities
    // Force neutral score regardless of all other factors
    // This prevents stablecoins from polluting the quant scoring system
    finalScore = 50; // Exactly neutral - not bullish, not bearish
    console.log(`[calculateCompositeScore] Stablecoin detected: ${symbol}, forcing score to 50 (was ${rawScore.toFixed(2)})`);
  }
  
  // Round and clamp to 0-100
  const compositeScore = Math.max(0, Math.min(100, Math.round(finalScore)));
  
  return compositeScore;
}

/**
 * Forecast price direction using multiple algorithms
 * Returns probability of upward movement
 */
function forecastPriceDirection(
  prices: number[],
  trendScore: number,
  momentumScore: number,
  trendDirection: string,
  rsi: number,
  macdHist: number,
  volumeConfirmation: string,
  hurst: number
): { probability: number; direction: 'UP' | 'DOWN' | 'SIDEWAYS' } {
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;

  // 1. Trend Analysis (40% weight) - More sensitive
  if (trendDirection === 'Up' && trendScore > 50) {
    // Gradual scoring based on trend strength
    bullishSignals += Math.min(4, (trendScore - 50) / 12.5 * 4);
    totalSignals += 4;
  } else if (trendDirection === 'Down' && trendScore < 50) {
    // Gradual scoring based on trend strength
    bearishSignals += Math.min(4, (50 - trendScore) / 12.5 * 4);
    totalSignals += 4;
  } else {
    totalSignals += 4;
  }

  // 2. Momentum Analysis (25% weight) - More sensitive thresholds
  if (momentumScore > 55) {
    bullishSignals += (momentumScore - 50) / 50 * 2.5; // Gradual increase
  } else if (momentumScore < 45) {
    bearishSignals += (50 - momentumScore) / 50 * 2.5; // Gradual increase
  }
  
  // RSI momentum confirmation
  if (rsi > 50 && rsi < 75) {
    bullishSignals += 0.5; // Additional bullish confirmation
  } else if (rsi < 50 && rsi > 25) {
    bearishSignals += 0.5; // Additional bearish confirmation
  }
  totalSignals += 3; // Increased total to account for RSI bonus

  // 3. MACD Histogram (15% weight)
  if (macdHist > 0) {
    bullishSignals += 1.5;
  } else {
    bearishSignals += 1.5;
  }
  totalSignals += 1.5;

  // 4. Volume Confirmation (10% weight)
  if (volumeConfirmation.includes('Up')) {
    bullishSignals += 1;
  } else if (volumeConfirmation.includes('Down')) {
    bearishSignals += 1;
  }
  totalSignals += 1;

  // 5. Hurst Exponent - Trend Persistence (10% weight)
  if (hurst > 0.55) {
    // Trending market - follow the trend
    if (trendDirection === 'Up') bullishSignals += 1;
    else if (trendDirection === 'Down') bearishSignals += 1;
  } else if (hurst < 0.45) {
    // Mean-reverting - expect reversal
    if (trendDirection === 'Up') bearishSignals += 1;
    else if (trendDirection === 'Down') bullishSignals += 1;
  }
  totalSignals += 1;

  // Calculate probability with more sensitivity
  const bullishProbability = (bullishSignals / totalSignals) * 100;
  const bearishProbability = (bearishSignals / totalSignals) * 100;
  const neutralProbability = 100 - bullishProbability - bearishProbability;

  // Determine direction with lower threshold for more signals
  let direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  const directionThreshold = 45; // Lower threshold (was 55)
  
  if (bullishProbability > directionThreshold && bullishProbability > bearishProbability) {
    direction = 'UP';
  } else if (bearishProbability > directionThreshold && bearishProbability > bullishProbability) {
    direction = 'DOWN';
  } else {
    direction = 'SIDEWAYS';
  }

  // Boost probability if signals are strong
  let finalProbability = Math.max(bullishProbability, bearishProbability);
  if (finalProbability < 50 && direction !== 'SIDEWAYS') {
    // If we have a direction but low probability, boost it based on signal strength
    const signalStrength = Math.abs(bullishSignals - bearishSignals) / totalSignals;
    finalProbability = 50 + (signalStrength * 30); // Boost to 50-80 range
  }

  return {
    probability: Math.round(Math.min(100, Math.max(0, finalProbability))),
    direction
  };
}

/**
 * Detect trend continuation vs reversal - More sensitive and accurate
 */
function detectTrendContinuation(
  prices: number[],
  trendDirection: string,
  momentumScore: number,
  rsi: number,
  volumeConfirmation: string
): { continuation: number; reversal: number } {
  let continuationScore = 0;
  let reversalScore = 0;

  // Trend continuation signals - More sensitive thresholds
  if (trendDirection === 'Up') {
    // Upward trend continuation
    if (momentumScore > 55) {
      continuationScore += 30 + (momentumScore - 55) * 0.5; // 55-75 range
    }
    if (rsi > 45 && rsi < 70) {
      continuationScore += 20; // Healthy RSI for uptrend
    }
    if (volumeConfirmation.includes('Up')) {
      continuationScore += 25; // Volume confirms
    } else if (volumeConfirmation.includes('Down')) {
      reversalScore += 15; // Volume divergence
    }
  } else if (trendDirection === 'Down') {
    // Downward trend continuation
    if (momentumScore < 45) {
      continuationScore += 30 + (45 - momentumScore) * 0.5; // 45-25 range
    }
    if (rsi < 55 && rsi > 30) {
      continuationScore += 20; // Healthy RSI for downtrend
    }
    if (volumeConfirmation.includes('Down')) {
      continuationScore += 25; // Volume confirms
    } else if (volumeConfirmation.includes('Up')) {
      reversalScore += 15; // Volume divergence
    }
  }

  // Reversal signals (overbought/oversold) - More sensitive
  if (rsi > 70) {
    reversalScore += 40 + (rsi - 70) * 0.5; // Strong overbought
  } else if (rsi < 30) {
    reversalScore += 40 + (30 - rsi) * 0.5; // Strong oversold
  }

  // Price momentum divergence detection
  if (prices.length >= 20) {
    const recentPrices = prices.slice(-20);
    const priceChange = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    
    if (trendDirection === 'Up' && priceChange < -0.03) {
      // Price declining in uptrend = potential reversal
      reversalScore += 20 + Math.abs(priceChange) * 200;
    } else if (trendDirection === 'Down' && priceChange > 0.03) {
      // Price rising in downtrend = potential reversal
      reversalScore += 20 + Math.abs(priceChange) * 200;
    }
  }

  // Momentum divergence
  if (trendDirection === 'Up' && momentumScore < 50) {
    reversalScore += 15; // Weak momentum in uptrend
  } else if (trendDirection === 'Down' && momentumScore > 50) {
    reversalScore += 15; // Strong momentum in downtrend (potential reversal)
  }

  return {
    continuation: Math.min(100, Math.round(continuationScore)),
    reversal: Math.min(100, Math.round(reversalScore))
  };
}

/**
 * Calculate support and resistance levels for forecasting
 */
function calculateSupportResistance(
  prices: number[],
  ohlc: OHLC[]
): { support: number; resistance: number; currentPrice: number } {
  const currentPrice = prices[prices.length - 1];
  
  // Use recent highs and lows
  const recentHighs = ohlc.slice(-50).map(bar => bar.high);
  const recentLows = ohlc.slice(-50).map(bar => bar.low);
  
  // Resistance = recent high
  const resistance = Math.max(...recentHighs);
  
  // Support = recent low
  const support = Math.min(...recentLows);
  
  return { support, resistance, currentPrice };
}

/**
 * Determine trading signal based on composite score thresholds
 * Simple and direct: Composite Score is the primary signal indicator
 * 
 * IF Composite Score ≥ 65:  Signal = "BUY" (Bullish)
 * IF Composite Score ≤ 35:  Signal = "SELL" (Bearish)
 * IF 35 < Score < 65:       Signal = "HOLD" (Neutral)
 * 
 * Special case: Stablecoins always return HOLD (Neutral)
 */
function determineSignal(
  compositeScore: number,
  sentiment: number,
  momentum: number,
  risk: number,
  forecast: { probability: number; direction: 'UP' | 'DOWN' | 'SIDEWAYS' },
  trendContinuation: { continuation: number; reversal: number },
  prices: number[],
  rsi: number,
  symbol?: string
): 'BUY' | 'SELL' | 'HOLD' {
  // Check if it's a stablecoin first - always return HOLD (Neutral)
  if (symbol) {
    const currentPrice = prices.length > 0 ? prices[prices.length - 1] : undefined;
    if (isStablecoin(symbol, currentPrice)) {
      console.log(`[determineSignal] Stablecoin detected: ${symbol}, forcing HOLD signal (score was ${compositeScore})`);
      return 'HOLD'; // Stablecoins are always neutral, never bullish or bearish
    }
  }
  
  // Direct composite score-based signal determination
  // Ensure we're working with a valid number and round it
  const score = Math.round(Number(compositeScore));
  
  if (isNaN(score) || score < 0 || score > 100) {
    console.warn(`[determineSignal] Invalid composite score: ${compositeScore}, defaulting to HOLD`);
    return 'HOLD';
  }
  
  // Apply thresholds strictly - these are the exact rules
  // Score >= 65 = BUY (Bullish)
  if (score >= 65) {
    return 'BUY';
  }
  
  // Score <= 35 = SELL (Bearish)
  if (score <= 35) {
    return 'SELL';
  }
  
  // 35 < Score < 65 = HOLD (Neutral)
  return 'HOLD';
}

/**
 * Determine market regime from multiple factors
 */
function determineMarketRegime(
  trendDirection: string,
  trendScore: number,
  volatilityRegime: string,
  momentumScore: number,
  riskScore: number,
  prices: number[]
): 'bull' | 'bear' | 'sideways' {
  // Calculate EMA200 position
  const ema200 = exponentialMovingAverage(prices, 200);
  const currentPrice = prices[prices.length - 1];
  const ema200Value = ema200.length > 0 ? ema200[ema200.length - 1] : currentPrice;
  const aboveEMA = currentPrice > ema200Value;
  
  // Bull conditions
  if (
    aboveEMA &&
    trendDirection === 'Up' &&
    trendScore > 60 &&
    momentumScore > 55 &&
    riskScore < 50
  ) {
    return 'bull';
  }
  
  // Bear conditions
  if (
    !aboveEMA &&
    trendDirection === 'Down' &&
    trendScore < 40 &&
    momentumScore < 45 &&
    riskScore > 60
  ) {
    return 'bear';
  }
  
  // Default to sideways
  return 'sideways';
}

/**
 * Calculate confidence based on factor agreement
 */
function calculateConfidence(scores: {
  trend: number;
  momentum: number;
  volatility: number;
  volume: number;
  risk: number;
  sentiment: number;
}): number {
  const factorValues = Object.values(scores);
  const mean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
  const stdDev = standardDeviation(factorValues);
  
  // Lower std deviation = higher confidence (factors agree)
  // Higher std deviation = lower confidence (factors disagree)
  const confidence = Math.max(50, Math.min(100, 100 - (stdDev * 2)));
  
  return Math.round(confidence);
}

/**
 * Main quant engine function
 * Processes all inputs and returns unified output
 */
export async function runQuantEngine(input: QuantEngineInput): Promise<QuantEngineOutput> {
  const {
    symbol,
    prices,
    ohlc,
    volumes,
    benchmarkPrices,
    sentimentScore = 50,
    interval = '1d'
  } = input;

  // Validate inputs
  if (prices.length < 30) {
    throw new Error(`Insufficient data: need at least 30 data points, got ${prices.length}`);
  }

  if (ohlc.length !== prices.length) {
    throw new Error(`OHLC length (${ohlc.length}) must match prices length (${prices.length})`);
  }

  if (volumes.length !== prices.length) {
    throw new Error(`Volumes length (${volumes.length}) must match prices length (${prices.length})`);
  }

  // Extract arrays for calculations
  const highs = ohlc.map(bar => bar.high);
  const lows = ohlc.map(bar => bar.low);
  const closes = ohlc.map(bar => bar.close);
  const opens = ohlc.map(bar => bar.open);

  // ============================================
  // TREND CALCULATIONS
  // ============================================
  const trendMetrics = calculateTrendMetrics(prices);
  const slope = calculateRegressionSlope(prices, 20);
  const hurst = calculateHurstExponent(prices, 20);
  const { histogram: macdHist } = calculateMACD(prices);
  const trendDirection = determineTrendDirection(prices);
  const trendScore = normalizeTrendScore(slope, hurst, macdHist, trendDirection);

  // ============================================
  // MOMENTUM CALCULATIONS
  // ============================================
  const momentumMetrics = calculateMomentumMetrics(prices);
  const momentumScore = normalizeMomentumScore(
    momentumMetrics.zScore,
    momentumMetrics.sharpeRatio,
    momentumMetrics.sortinoRatio,
    momentumMetrics.rsi,
    momentumMetrics.rsiZ,
    momentumMetrics.roc
  );

  // ============================================
  // VOLATILITY CALCULATIONS
  // ============================================
  const volatilityMetrics = calculateVolatilityMetrics(prices, ohlc);
  const volatilityScore = normalizeVolatilityScore(
    volatilityMetrics.historicalVol,
    volatilityMetrics.parkinsonVol,
    volatilityMetrics.garmanKlassVol,
    volatilityMetrics.regime
  );

  // ============================================
  // VOLUME CALCULATIONS
  // ============================================
  const volumeMetrics = calculateVolumeMetrics(prices, volumes, highs, lows, closes);
  const volumeScore = volumeMetrics.volumeScore; // Already 0-100

  // ============================================
  // RISK CALCULATIONS
  // ============================================
  const riskMetrics = calculateRiskMetrics(prices, benchmarkPrices);
  const riskScore = riskMetrics.riskScore; // Already 0-100

  // ============================================
  // COMPOSITE SCORE
  // ============================================
  const priceForStablecoinCheck = prices[prices.length - 1];
  const compositeScore = calculateCompositeScore(
    trendScore,
    momentumScore,
    volatilityScore,
    volumeScore,
    riskScore,
    sentimentScore,
    symbol,
    priceForStablecoinCheck
  );

  // ============================================
  // FORECASTING ANALYSIS
  // ============================================
  const forecast = forecastPriceDirection(
    prices,
    trendScore,
    momentumScore,
    trendDirection,
    momentumMetrics.rsi,
    macdHist,
    volumeMetrics.priceVolumeConfirmation,
    hurst
  );

  const trendContinuation = detectTrendContinuation(
    prices,
    trendDirection,
    momentumScore,
    momentumMetrics.rsi,
    volumeMetrics.priceVolumeConfirmation
  );

  const supportResistance = calculateSupportResistance(prices, ohlc);

  // Calculate price target based on forecast
  let priceTarget: number | undefined;
  if (forecast.direction === 'UP' && forecast.probability > 60) {
    // Target: resistance level or 5% above current
    priceTarget = Math.max(supportResistance.resistance, priceForStablecoinCheck * 1.05);
  } else if (forecast.direction === 'DOWN' && forecast.probability > 60) {
    // Target: support level or 5% below current
    priceTarget = Math.min(supportResistance.support, priceForStablecoinCheck * 0.95);
  }

  // ============================================
  // TRADING SIGNAL (Enhanced with forecasting)
  // ============================================
  const signal = determineSignal(
    compositeScore,
    sentimentScore,
    momentumScore,
    riskScore,
    forecast,
    trendContinuation,
    prices,
    momentumMetrics.rsi,
    symbol // Pass symbol for stablecoin detection
  );
  
  // Debug logging for signal determination
  if (compositeScore <= 35 && signal !== 'SELL') {
    console.warn(`[runQuantEngine] ${symbol}: Composite score ${compositeScore} should be SELL but got ${signal}`);
  } else if (compositeScore >= 65 && signal !== 'BUY') {
    console.warn(`[runQuantEngine] ${symbol}: Composite score ${compositeScore} should be BUY but got ${signal}`);
  }

  // ============================================
  // MARKET REGIME
  // ============================================
  const marketRegime = determineMarketRegime(
    trendDirection,
    trendScore,
    volatilityMetrics.regime,
    momentumScore,
    riskScore,
    prices
  );

  // ============================================
  // CONFIDENCE (Enhanced with forecast probability)
  // ============================================
  const baseConfidence = calculateConfidence({
    trend: trendScore,
    momentum: momentumScore,
    volatility: volatilityScore,
    volume: volumeScore,
    risk: riskScore,
    sentiment: sentimentScore
  });
  
  // Boost confidence if forecast probability is high
  const forecastBoost = forecast.probability > 70 ? 10 : forecast.probability > 60 ? 5 : 0;
  const confidence = Math.min(100, baseConfidence + forecastBoost);

  // ============================================
  // RETURN UNIFIED OUTPUT
  // ============================================
  return {
    symbol,
    scores: {
      trend: trendScore,
      momentum: momentumScore,
      volatility: volatilityScore,
      volume: volumeScore,
      risk: riskScore,
      sentiment: sentimentScore,
      compositeScore
    },
    signal,
    marketRegime,
    confidence,
    forecast: {
      direction: forecast.direction,
      probability: Math.round(forecast.probability),
      trendContinuation: Math.round(trendContinuation.continuation),
      trendReversal: Math.round(trendContinuation.reversal),
      support: supportResistance.support,
      resistance: supportResistance.resistance,
      priceTarget
    },
    metrics: {
      trend: {
        slope,
        hurstExponent: hurst,
        macdHistogram: macdHist,
        trendDirection
      },
      momentum: {
        zScore: momentumMetrics.zScore,
        sharpeRatio: momentumMetrics.sharpeRatio,
        sortinoRatio: momentumMetrics.sortinoRatio,
        rsi: momentumMetrics.rsi,
        rsiZ: momentumMetrics.rsiZ,
        roc: momentumMetrics.roc
      },
      volatility: {
        historicalVol: volatilityMetrics.historicalVol,
        parkinsonVol: volatilityMetrics.parkinsonVol,
        garmanKlassVol: volatilityMetrics.garmanKlassVol,
        atr: volatilityMetrics.atr,
        regime: volatilityMetrics.regime
      },
      volume: {
        volumeZScore: volumeMetrics.volumeZScore,
        mfi: volumeMetrics.mfi,
        priceVolumeConfirmation: volumeMetrics.priceVolumeConfirmation
      },
      risk: {
        beta: riskMetrics.beta,
        maxDrawdown: riskMetrics.maxDrawdown,
        downsideDeviation: riskMetrics.downsideDeviation,
        var95: riskMetrics.var95,
        var99: riskMetrics.var99
      }
    }
  };
}

