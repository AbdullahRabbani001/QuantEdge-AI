// Trend strength and direction analysis
import { mean, standardDeviation, exponentialMovingAverage } from './statistics';

export interface TrendMetrics {
  slope: number;
  hurstExponent: number;
  macdHistogram: number;
  trendScore: number;
  direction: 'Up' | 'Down' | 'Sideways';
}

/**
 * Calculate Linear Regression Slope
 * Positive slope = uptrend, negative = downtrend
 */
export function calculateRegressionSlope(prices: number[], window: number = 20): number {
  if (prices.length < window) return 0;
  
  const recentPrices = prices.slice(-window);
  const n = recentPrices.length;
  
  // Calculate slope using least squares
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentPrices[i];
    sumXY += i * recentPrices[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Normalize by price
  const avgPrice = mean(recentPrices);
  return (slope / avgPrice) * 100; // As percentage
}

/**
 * Calculate Hurst Exponent (simplified R/S analysis)
 * H > 0.5: trending market
 * H < 0.5: mean-reverting market
 * H ≈ 0.5: random walk
 */
export function calculateHurstExponent(prices: number[], maxLag: number = 20): number {
  if (prices.length < maxLag * 2) return 0.5;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  
  const lags: number[] = [];
  const rsList: number[] = [];
  
  for (let lag = 2; lag <= Math.min(maxLag, Math.floor(returns.length / 2)); lag++) {
    let sumRS = 0;
    let count = 0;
    
    for (let start = 0; start + lag <= returns.length; start += lag) {
      const subset = returns.slice(start, start + lag);
      const m = mean(subset);
      
      // Calculate cumulative deviations
      const cumDev: number[] = [];
      let cumSum = 0;
      for (const r of subset) {
        cumSum += r - m;
        cumDev.push(cumSum);
      }
      
      const range = Math.max(...cumDev) - Math.min(...cumDev);
      const std = standardDeviation(subset);
      
      if (std > 0) {
        sumRS += range / std;
        count++;
      }
    }
    
    if (count > 0) {
      lags.push(Math.log(lag));
      rsList.push(Math.log(sumRS / count));
    }
  }
  
  // Calculate Hurst via linear regression of log(R/S) vs log(lag)
  if (lags.length < 2) return 0.5;
  
  const n = lags.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += lags[i];
    sumY += rsList[i];
    sumXY += lags[i] * rsList[i];
    sumX2 += lags[i] * lags[i];
  }
  
  const hurst = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return Math.max(0, Math.min(1, hurst)); // Clamp to [0, 1]
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[], 
  fastPeriod: number = 12, 
  slowPeriod: number = 26, 
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  if (prices.length < slowPeriod + signalPeriod) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  const fastEMA = exponentialMovingAverage(prices, fastPeriod);
  const slowEMA = exponentialMovingAverage(prices, slowPeriod);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  
  const signalLine = exponentialMovingAverage(macdLine, signalPeriod);
  
  const currentIdx = prices.length - 1;
  const macd = macdLine[currentIdx];
  const signal = signalLine[currentIdx];
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

/**
 * Calculate Standardized MACD Histogram
 * Normalized by standard deviation for trend score
 */
export function calculateStandardizedMACDHist(prices: number[], window: number = 50): number {
  if (prices.length < window + 26) return 0;
  
  const histograms: number[] = [];
  
  for (let i = 26; i < prices.length; i++) {
    const subset = prices.slice(0, i + 1);
    const { histogram } = calculateMACD(subset);
    histograms.push(histogram);
  }
  
  const recentHist = histograms.slice(-window);
  const currentHist = histograms[histograms.length - 1];
  const stdHist = standardDeviation(recentHist);
  
  if (stdHist === 0) return 0;
  
  return currentHist / stdHist;
}

/**
 * Calculate comprehensive trend score (0-100)
 */
export function calculateTrendScore(prices: number[]): number {
  const slope = calculateRegressionSlope(prices, 20);
  const hurst = calculateHurstExponent(prices, 20);
  const macdZ = calculateStandardizedMACDHist(prices, 50);
  
  // Combine indicators
  // Positive slope + H > 0.5 + positive MACD = strong trend
  const slopeScore = Math.min(100, Math.max(0, 50 + slope * 5)); // Map slope to 0-100
  const hurstScore = hurst * 100; // 0-100
  const macdScore = Math.min(100, Math.max(0, 50 + macdZ * 15)); // Map z-score to 0-100
  
  // Weighted average
  const score = (slopeScore * 0.4 + hurstScore * 0.3 + macdScore * 0.3);
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Determine trend direction
 */
export function determineTrendDirection(prices: number[]): 'Up' | 'Down' | 'Sideways' {
  const slope = calculateRegressionSlope(prices, 20);
  
  if (slope > 0.5) return 'Up';
  if (slope < -0.5) return 'Down';
  return 'Sideways';
}

/**
 * Calculate all trend metrics
 */
export function calculateTrendMetrics(prices: number[]): TrendMetrics {
  const slope = calculateRegressionSlope(prices, 20);
  const hurstExponent = calculateHurstExponent(prices, 20);
  const { histogram } = calculateMACD(prices);
  const trendScore = calculateTrendScore(prices);
  const direction = determineTrendDirection(prices);
  
  return {
    slope,
    hurstExponent,
    macdHistogram: histogram,
    trendScore,
    direction,
  };
}
