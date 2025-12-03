// Volatility modeling and regime detection
import { mean, standardDeviation, logReturns } from './statistics';

export interface VolatilityMetrics {
  historicalVol: number;
  parkinsonVol: number;
  garmanKlassVol: number;
  regime: 'High' | 'Normal' | 'Low';
  atr: number;
}

export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Calculate Historical Volatility (Close-to-Close)
 * HV = StdDev(log returns) * sqrt(365)
 */
export function calculateHistoricalVolatility(prices: number[], window: number = 30): number {
  if (prices.length < window + 1) return 0;
  
  const recentPrices = prices.slice(-window - 1);
  const returns = logReturns(recentPrices);
  const vol = standardDeviation(returns);
  
  return vol * Math.sqrt(365) * 100; // Annualized as percentage
}

/**
 * Calculate Parkinson Volatility
 * Uses high-low range (more efficient than close-to-close)
 */
export function calculateParkinsonVolatility(ohlc: OHLC[], window: number = 30): number {
  if (ohlc.length < window) return 0;
  
  const recentBars = ohlc.slice(-window);
  let sum = 0;
  
  for (const bar of recentBars) {
    if (bar.high > 0 && bar.low > 0) {
      const ratio = bar.high / bar.low;
      sum += Math.pow(Math.log(ratio), 2);
    }
  }
  
  const variance = sum / (4 * window * Math.log(2));
  return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized as percentage
}

/**
 * Calculate Garman-Klass Volatility
 * Uses OHLC data (most efficient estimator)
 */
export function calculateGarmanKlassVolatility(ohlc: OHLC[], window: number = 30): number {
  if (ohlc.length < window) return 0;
  
  const recentBars = ohlc.slice(-window);
  let sum = 0;
  
  for (const bar of recentBars) {
    if (bar.high > 0 && bar.low > 0 && bar.open > 0 && bar.close > 0) {
      const hlTerm = 0.5 * Math.pow(Math.log(bar.high / bar.low), 2);
      const ocTerm = (2 * Math.log(2) - 1) * Math.pow(Math.log(bar.close / bar.open), 2);
      sum += hlTerm - ocTerm;
    }
  }
  
  const variance = sum / window;
  return Math.sqrt(variance) * Math.sqrt(365) * 100; // Annualized as percentage
}

/**
 * Calculate Average True Range (ATR)
 */
export function calculateATR(ohlc: OHLC[], period: number = 14): number {
  if (ohlc.length < period + 1) return 0;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < ohlc.length; i++) {
    const high = ohlc[i].high;
    const low = ohlc[i].low;
    const prevClose = ohlc[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  return mean(trueRanges.slice(-period));
}

/**
 * Determine Volatility Regime
 */
export function determineVolatilityRegime(
  currentVol: number, 
  prices: number[], 
  longWindow: number = 365
): 'High' | 'Normal' | 'Low' {
  if (prices.length < longWindow + 1) return 'Normal';
  
  const longTermVol = calculateHistoricalVolatility(prices, longWindow);
  const ratio = currentVol / longTermVol;
  
  if (ratio > 1.5) return 'High';
  if (ratio < 0.7) return 'Low';
  return 'Normal';
}

/**
 * Calculate all volatility metrics
 */
export function calculateVolatilityMetrics(
  prices: number[], 
  ohlc: OHLC[]
): VolatilityMetrics {
  const historicalVol = calculateHistoricalVolatility(prices, 30);
  const parkinsonVol = calculateParkinsonVolatility(ohlc, 30);
  const garmanKlassVol = calculateGarmanKlassVolatility(ohlc, 30);
  const atr = calculateATR(ohlc, 14);
  const regime = determineVolatilityRegime(historicalVol, prices, 365);
  
  return {
    historicalVol,
    parkinsonVol,
    garmanKlassVol,
    regime,
    atr,
  };
}
