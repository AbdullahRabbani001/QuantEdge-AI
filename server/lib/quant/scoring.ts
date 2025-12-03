// Multi-factor quant scoring system
import { calculateMomentumMetrics, type MomentumMetrics } from './momentum';
import { calculateVolatilityMetrics, type VolatilityMetrics, type OHLC } from './volatility';
import { calculateTrendMetrics, type TrendMetrics } from './trend';
import { calculateVolumeMetrics, type VolumeMetrics } from './volume';
import { calculateRiskMetrics, type RiskMetrics } from './risk';

export interface FactorScores {
  trend: number; // 0-100
  momentum: number; // 0-100
  volatility: number; // 0-100
  volume: number; // 0-100
  sentiment: number; // 0-100
}

export interface QuantScore {
  symbol: string;
  score: number; // 0-100 composite score
  signal: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number; // 0-100
  factors: FactorScores;
  explanation: string;
}

/**
 * Normalize trend metrics to 0-100 score
 */
function normalizeTrendScore(metrics: TrendMetrics): number {
  // Already provides trendScore 0-100
  return metrics.trendScore;
}

/**
 * Normalize momentum metrics to 0-100 score
 */
function normalizeMomentumScore(metrics: MomentumMetrics): number {
  // Z-Score component (-3 to +3 maps to 0-100)
  const zComponent = Math.min(100, Math.max(0, 50 + metrics.zScore * 16.67));
  
  // Sharpe component (0 to 3 maps to 0-100)
  const sharpeComponent = Math.min(100, Math.max(0, metrics.sharpeRatio * 33.33));
  
  // RSI component (0-100)
  const rsiComponent = metrics.rsi;
  
  // Weighted average
  const score = (zComponent * 0.3 + sharpeComponent * 0.4 + rsiComponent * 0.3);
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Normalize volatility metrics to 0-100 score
 * Lower volatility = higher score (for stability)
 */
function normalizeVolatilityScore(metrics: VolatilityMetrics): number {
  // Historical vol: 0-100% maps to 100-0 (inverted)
  const hvScore = Math.max(0, 100 - metrics.historicalVol);
  
  // Regime bonus
  let regimeBonus = 0;
  if (metrics.regime === 'Low') regimeBonus = 20;
  if (metrics.regime === 'Normal') regimeBonus = 10;
  if (metrics.regime === 'High') regimeBonus = -10;
  
  const score = hvScore + regimeBonus;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate composite quant score
 */
export function calculateQuantScore(
  symbol: string,
  prices: number[],
  ohlc: OHLC[],
  volumes: number[],
  sentimentScore: number = 50, // Default neutral
  benchmarkPrices?: number[]
): QuantScore {
  // Calculate all metrics
  const trendMetrics = calculateTrendMetrics(prices);
  const momentumMetrics = calculateMomentumMetrics(prices);
  const volatilityMetrics = calculateVolatilityMetrics(prices, ohlc);
  
  const highs = ohlc.map(bar => bar.high);
  const lows = ohlc.map(bar => bar.low);
  const closes = ohlc.map(bar => bar.close);
  
  const volumeMetrics = calculateVolumeMetrics(prices, volumes, highs, lows, closes);
  
  // Normalize to 0-100 scores
  const factors: FactorScores = {
    trend: normalizeTrendScore(trendMetrics),
    momentum: normalizeMomentumScore(momentumMetrics),
    volatility: normalizeVolatilityScore(volatilityMetrics),
    volume: volumeMetrics.volumeScore,
    sentiment: sentimentScore,
  };
  
  // Weighted composite score
  const compositeScore = 
    factors.trend * 0.30 +
    factors.momentum * 0.20 +
    factors.volatility * 0.20 +
    factors.volume * 0.15 +
    factors.sentiment * 0.15;
  
  // Determine signal
  let signal: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  if (compositeScore >= 65) signal = 'Bullish';
  else if (compositeScore <= 35) signal = 'Bearish';
  
  // Calculate confidence based on factor agreement
  const factorValues = Object.values(factors);
  const factorMean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
  const factorStd = Math.sqrt(
    factorValues.reduce((sum, val) => sum + Math.pow(val - factorMean, 2), 0) / factorValues.length
  );
  
  // Lower std deviation = higher confidence
  const confidence = Math.round(Math.max(50, Math.min(100, 100 - factorStd)));
  
  // Generate explanation
  const explanation = generateExplanation(factors, trendMetrics, momentumMetrics, volumeMetrics);
  
  return {
    symbol,
    score: Math.round(compositeScore),
    signal,
    confidence,
    factors,
    explanation,
  };
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
  factors: FactorScores,
  trend: TrendMetrics,
  momentum: MomentumMetrics,
  volume: VolumeMetrics
): string {
  const parts: string[] = [];
  
  // Trend
  if (factors.trend > 70) {
    parts.push(`Strong ${trend.direction.toLowerCase()}trend with positive slope`);
  } else if (factors.trend > 50) {
    parts.push(`Moderate ${trend.direction.toLowerCase()}trend`);
  } else {
    parts.push('Weak or sideways trend');
  }
  
  // Momentum
  if (momentum.sharpeRatio > 1.5) {
    parts.push('excellent risk-adjusted returns');
  } else if (momentum.sharpeRatio > 0.5) {
    parts.push('positive Sharpe ratio');
  }
  
  if (Math.abs(momentum.zScore) > 2) {
    parts.push(momentum.zScore > 0 ? 'significantly overbought' : 'oversold conditions');
  }
  
  // Volume
  if (volume.priceVolumeConfirmation.includes('Strong')) {
    parts.push(`${volume.priceVolumeConfirmation.toLowerCase()} volume confirmation`);
  }
  
  return parts.join(', ') + '.';
}

/**
 * Determine market regime
 */
export interface MarketRegime {
  regime: 'Bull' | 'Bear' | 'Sideways';
  volatility: 'High' | 'Normal' | 'Low';
  trendStrength: number;
  confidence: number;
  explanation: string;
}

export function calculateMarketRegime(
  prices: number[],
  ohlc: OHLC[],
  ema200?: number[]
): MarketRegime {
  const trendMetrics = calculateTrendMetrics(prices);
  const volatilityMetrics = calculateVolatilityMetrics(prices, ohlc);
  
  const currentPrice = prices[prices.length - 1];
  const ema200Value = ema200 && ema200.length > 0 ? ema200[ema200.length - 1] : currentPrice;
  
  // Determine regime
  let regime: 'Bull' | 'Bear' | 'Sideways' = 'Sideways';
  
  const aboveEMA = currentPrice > ema200Value;
  const strongTrend = trendMetrics.trendScore > 60;
  const hurstTrending = trendMetrics.hurstExponent > 0.55;
  
  if (aboveEMA && trendMetrics.direction === 'Up' && strongTrend) {
    regime = 'Bull';
  } else if (!aboveEMA && trendMetrics.direction === 'Down' && trendMetrics.trendScore < 40) {
    regime = 'Bear';
  }
  
  // Confidence based on clarity of signals
  let confidence = 50;
  if (strongTrend && hurstTrending) confidence = 85;
  else if (strongTrend || hurstTrending) confidence = 70;
  
  // Explanation
  const parts: string[] = [];
  if (aboveEMA) {
    parts.push('Trading above 200 EMA');
  } else {
    parts.push('Trading below 200 EMA');
  }
  
  parts.push(`${trendMetrics.direction.toLowerCase()}ward momentum`);
  parts.push(`${volatilityMetrics.regime.toLowerCase()} volatility environment`);
  
  return {
    regime,
    volatility: volatilityMetrics.regime,
    trendStrength: trendMetrics.trendScore,
    confidence,
    explanation: parts.join(', ') + '.',
  };
}
