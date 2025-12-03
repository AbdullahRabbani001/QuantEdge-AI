// Momentum and mean reversion indicators
import { mean, standardDeviation, logReturns, simpleMovingAverage } from './statistics';

export interface MomentumMetrics {
  zScore: number;
  sharpeRatio: number;
  sortinoRatio: number;
  rsi: number;
  rsiZ: number;
}

/**
 * Calculate Z-Score: (price - SMA) / StdDev
 * Indicates how many standard deviations away from the mean
 */
export function calculateZScore(prices: number[], window: number = 20): number {
  if (prices.length < window) return 0;
  
  const recentPrices = prices.slice(-window);
  const sma = mean(recentPrices);
  const stdDev = standardDeviation(recentPrices);
  
  if (stdDev === 0) return 0;
  
  const currentPrice = prices[prices.length - 1];
  return (currentPrice - sma) / stdDev;
}

/**
 * Calculate Rolling Sharpe Ratio
 * Sharpe = (Mean Return / Volatility) * sqrt(365)
 */
export function calculateSharpeRatio(prices: number[], window: number = 30): number {
  if (prices.length < window + 1) return 0;
  
  const recentPrices = prices.slice(-window - 1);
  const returns = logReturns(recentPrices);
  
  const meanReturn = mean(returns);
  const volatility = standardDeviation(returns);
  
  if (volatility === 0) return 0;
  
  return (meanReturn / volatility) * Math.sqrt(365);
}

/**
 * Calculate Rolling Sortino Ratio
 * Uses downside deviation instead of total volatility
 */
export function calculateSortinoRatio(prices: number[], window: number = 30): number {
  if (prices.length < window + 1) return 0;
  
  const recentPrices = prices.slice(-window - 1);
  const returns = logReturns(recentPrices);
  
  const meanReturn = mean(returns);
  const negativeReturns = returns.filter(r => r < 0);
  
  if (negativeReturns.length === 0) return meanReturn > 0 ? 100 : 0;
  
  const downsideVol = standardDeviation(negativeReturns);
  
  if (downsideVol === 0) return 0;
  
  return (meanReturn / downsideVol) * Math.sqrt(365);
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));
  
  const avgGain = gains.length > 0 ? mean(gains) : 0;
  const avgLoss = losses.length > 0 ? mean(losses) : 0.0001; // Prevent division by zero
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate RSI Z-Score
 * Normalized RSI to detect extreme overbought/oversold
 */
export function calculateRSIZ(prices: number[], rsiPeriod: number = 14, window: number = 30): number {
  if (prices.length < window + rsiPeriod) return 0;
  
  const rsiValues: number[] = [];
  
  // Calculate RSI for each point in the window
  for (let i = 0; i <= window; i++) {
    const subset = prices.slice(0, prices.length - window + i);
    rsiValues.push(calculateRSI(subset, rsiPeriod));
  }
  
  const currentRSI = rsiValues[rsiValues.length - 1];
  const meanRSI = mean(rsiValues);
  const stdRSI = standardDeviation(rsiValues);
  
  if (stdRSI === 0) return 0;
  
  return (currentRSI - meanRSI) / stdRSI;
}

/**
 * Calculate all momentum metrics
 */
export function calculateMomentumMetrics(prices: number[]): MomentumMetrics {
  return {
    zScore: calculateZScore(prices, 20),
    sharpeRatio: calculateSharpeRatio(prices, 30),
    sortinoRatio: calculateSortinoRatio(prices, 30),
    rsi: calculateRSI(prices, 14),
    rsiZ: calculateRSIZ(prices, 14, 30),
  };
}
