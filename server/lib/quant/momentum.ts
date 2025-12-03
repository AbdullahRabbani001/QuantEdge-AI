// Momentum and mean reversion indicators
import { mean, standardDeviation, logReturns, simpleMovingAverage } from './statistics';

export interface MomentumMetrics {
  zScore: number;
  sharpeRatio: number;
  sortinoRatio: number;
  rsi: number;
  rsiZ: number;
  roc: number; // Rate of Change
}

/**
 * Calculate Z-Score: (price - SMA) / StdDev
 * Indicates how many standard deviations away from the mean
 */
/**
 * Calculate Z-Score: (price - SMA) / StdDev
 * Uses the mean/stdDev of the PREVIOUS window to avoid look-ahead bias
 */
export function calculateZScore(prices: number[], window: number = 20): number {
  if (prices.length < window + 1) return 0;

  // Use the window BEFORE the current price
  const previousPrices = prices.slice(-window - 1, -1);
  const sma = mean(previousPrices);
  const stdDev = standardDeviation(previousPrices);

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

  // Calculate downside deviation correctly (using 0 as target)
  // We use the full set of returns to calculate the deviation of negative returns
  const downsideVol = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(Math.min(0, r), 2), 0) / returns.length
  );

  if (downsideVol === 0) return 0;

  return (meanReturn / downsideVol) * Math.sqrt(365);
}

/**
 * Calculate RSI (Relative Strength Index)
 * Uses Wilder's Smoothing (EMA) instead of SMA
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Calculate initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  // Smooth the rest
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate Rate of Change (ROC)
 * Percentage change over a period
 */
export function calculateROC(prices: number[], period: number = 10): number {
  if (prices.length < period + 1) return 0;
  
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  
  if (pastPrice === 0) return 0;
  
  return ((currentPrice - pastPrice) / pastPrice) * 100;
}

/**
 * Calculate RSI Z-Score
 * Normalized RSI to detect extreme overbought/oversold
 */
export function calculateRSIZ(prices: number[], rsiPeriod: number = 14, window: number = 30): number {
  if (prices.length < window + rsiPeriod + 1) return 0;

  const rsiValues: number[] = [];

  // Calculate RSI for each point in the window
  // We need enough history for EACH RSI calculation
  // This is computationally expensive but necessary for correctness
  for (let i = 0; i <= window; i++) {
    // Slice needs to include enough data for RSI
    // For the i-th point in the window (where i=0 is 'window' days ago),
    // we need 'period' days before it.
    const endIndex = prices.length - window + i;
    // We need at least 'period' + 1 points
    const startIndex = Math.max(0, endIndex - (rsiPeriod * 2)); // Optimization: don't need full history
    const subset = prices.slice(startIndex, endIndex);

    if (subset.length > rsiPeriod) {
      rsiValues.push(calculateRSI(subset, rsiPeriod));
    }
  }

  if (rsiValues.length < 2) return 0;

  const currentRSI = rsiValues[rsiValues.length - 1];
  const previousRSIs = rsiValues.slice(0, -1);

  const meanRSI = mean(previousRSIs);
  const stdRSI = standardDeviation(previousRSIs);

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
    roc: calculateROC(prices, 10),
  };
}
