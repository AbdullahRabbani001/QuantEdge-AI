// Risk indicators and portfolio metrics
import { mean, standardDeviation, logReturns, covariance, percentile } from './statistics';

export interface RiskMetrics {
  beta: number; // Beta vs benchmark
  downsideDeviation: number;
  maxDrawdown: number; // Percentage
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  riskScore: number; // 0-100, higher = riskier
}

/**
 * Calculate Beta vs Benchmark
 * Beta = Cov(asset, benchmark) / Var(benchmark)
 */
export function calculateBeta(assetPrices: number[], benchmarkPrices: number[]): number {
  if (assetPrices.length !== benchmarkPrices.length || assetPrices.length < 30) {
    return 1; // Default to 1 if insufficient data
  }
  
  const assetReturns = logReturns(assetPrices);
  const benchmarkReturns = logReturns(benchmarkPrices);
  
  const cov = covariance(assetReturns, benchmarkReturns);
  const benchmarkVar = Math.pow(standardDeviation(benchmarkReturns), 2);
  
  if (benchmarkVar === 0) return 1;
  
  return cov / benchmarkVar;
}

/**
 * Calculate Downside Standard Deviation
 * Only considers negative returns
 */
export function calculateDownsideDeviation(prices: number[], threshold: number = 0): number {
  if (prices.length < 2) return 0;
  
  const returns = logReturns(prices);
  const negativeReturns = returns.filter(r => r < threshold);
  
  if (negativeReturns.length === 0) return 0;
  
  return standardDeviation(negativeReturns) * Math.sqrt(365) * 100; // Annualized as percentage
}

/**
 * Calculate Maximum Drawdown
 * Maximum peak-to-trough decline
 */
export function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  let maxDrawdown = 0;
  let peak = prices[0];
  
  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    
    const drawdown = ((peak - price) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

/**
 * Calculate Value at Risk (Historical Method)
 * VaR95 = 5th percentile of returns
 * VaR99 = 1st percentile of returns
 */
export function calculateVaR(prices: number[], confidence: 95 | 99 = 95): number {
  if (prices.length < 30) return 0;
  
  const returns = logReturns(prices);
  const percentileValue = confidence === 95 ? 5 : 1;
  
  return Math.abs(percentile(returns, percentileValue) * 100); // As percentage
}

/**
 * Calculate Risk Score (0-100)
 * Higher = riskier asset
 */
export function calculateRiskScore(metrics: RiskMetrics): number {
  // Normalize each component to 0-100
  
  // Beta component (0-30): beta of 2 = max score
  const betaScore = Math.min(30, Math.abs(metrics.beta - 1) * 15);
  
  // Downside deviation component (0-25): 50% annual = max
  const downsideScore = Math.min(25, (metrics.downsideDeviation / 50) * 25);
  
  // Max drawdown component (0-25): 50% drawdown = max
  const drawdownScore = Math.min(25, (metrics.maxDrawdown / 50) * 25);
  
  // VaR component (0-20): 10% VaR = max
  const varScore = Math.min(20, (metrics.var95 / 10) * 20);
  
  const totalScore = betaScore + downsideScore + drawdownScore + varScore;
  
  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

/**
 * Calculate all risk metrics
 */
export function calculateRiskMetrics(
  assetPrices: number[], 
  benchmarkPrices?: number[]
): RiskMetrics {
  const beta = benchmarkPrices ? calculateBeta(assetPrices, benchmarkPrices) : 1;
  const downsideDeviation = calculateDownsideDeviation(assetPrices);
  const maxDrawdown = calculateMaxDrawdown(assetPrices);
  const var95 = calculateVaR(assetPrices, 95);
  const var99 = calculateVaR(assetPrices, 99);
  
  const metrics = {
    beta,
    downsideDeviation,
    maxDrawdown,
    var95,
    var99,
    riskScore: 0, // Calculated below
  };
  
  metrics.riskScore = calculateRiskScore(metrics);
  
  return metrics;
}
