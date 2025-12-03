// Volume microstructure analysis
import { mean, standardDeviation } from './statistics';

export interface VolumeMetrics {
  volumeZScore: number;
  mfi: number; // Money Flow Index
  priceVolumeConfirmation: 'Strong Up' | 'Weak Up' | 'Strong Down' | 'Weak Down' | 'Neutral';
  volumeScore: number; // 0-100
}

/**
 * Calculate Volume Z-Score
 * Measures how abnormal current volume is
 */
export function calculateVolumeZScore(volumes: number[], window: number = 20): number {
  if (volumes.length < window) return 0;
  
  const recentVolumes = volumes.slice(-window);
  const avgVolume = mean(recentVolumes);
  const stdVolume = standardDeviation(recentVolumes);
  
  if (stdVolume === 0) return 0;
  
  const currentVolume = volumes[volumes.length - 1];
  return (currentVolume - avgVolume) / stdVolume;
}

/**
 * Calculate Money Flow Index (MFI)
 * Volume-weighted RSI
 */
export function calculateMFI(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  volumes: number[], 
  period: number = 14
): number {
  if (closes.length < period + 1) return 50;
  
  const typicalPrices: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  
  const moneyFlows: number[] = [];
  for (let i = 0; i < typicalPrices.length; i++) {
    moneyFlows.push(typicalPrices[i] * volumes[i]);
  }
  
  const recentFlows = moneyFlows.slice(-period - 1);
  const recentPrices = typicalPrices.slice(-period - 1);
  
  let positiveFlow = 0;
  let negativeFlow = 0;
  
  for (let i = 1; i < recentFlows.length; i++) {
    if (recentPrices[i] > recentPrices[i - 1]) {
      positiveFlow += recentFlows[i];
    } else if (recentPrices[i] < recentPrices[i - 1]) {
      negativeFlow += recentFlows[i];
    }
  }
  
  if (negativeFlow === 0) return 100;
  
  const moneyRatio = positiveFlow / negativeFlow;
  return 100 - (100 / (1 + moneyRatio));
}

/**
 * Determine Price-Volume Confirmation
 */
export function determinePriceVolumeConfirmation(
  prices: number[], 
  volumes: number[]
): 'Strong Up' | 'Weak Up' | 'Strong Down' | 'Weak Down' | 'Neutral' {
  if (prices.length < 2 || volumes.length < 2) return 'Neutral';
  
  const priceChange = prices[prices.length - 1] - prices[prices.length - 2];
  const volumeZ = calculateVolumeZScore(volumes, 20);
  
  const priceUp = priceChange > 0;
  const volumeHigh = volumeZ > 0.5;
  
  if (priceUp && volumeHigh) return 'Strong Up';
  if (priceUp && !volumeHigh) return 'Weak Up';
  if (!priceUp && volumeHigh) return 'Strong Down';
  if (!priceUp && !volumeHigh) return 'Weak Down';
  
  return 'Neutral';
}

/**
 * Calculate Volume Score (0-100)
 * Higher score = stronger volume confirmation
 */
export function calculateVolumeScore(
  prices: number[], 
  volumes: number[],
  highs: number[],
  lows: number[],
  closes: number[]
): number {
  const volumeZ = calculateVolumeZScore(volumes, 20);
  const mfi = calculateMFI(highs, lows, closes, volumes, 14);
  const confirmation = determinePriceVolumeConfirmation(prices, volumes);
  
  // Volume Z-Score component (0-50)
  const zComponent = Math.min(50, Math.max(0, 25 + volumeZ * 10));
  
  // MFI component (0-50)
  const mfiComponent = mfi / 2;
  
  // Confirmation bonus/penalty
  let confirmBonus = 0;
  if (confirmation === 'Strong Up' || confirmation === 'Strong Down') {
    confirmBonus = 10;
  } else if (confirmation === 'Weak Up' || confirmation === 'Weak Down') {
    confirmBonus = -5;
  }
  
  const score = zComponent + mfiComponent + confirmBonus;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate all volume metrics
 */
export function calculateVolumeMetrics(
  prices: number[],
  volumes: number[],
  highs: number[],
  lows: number[],
  closes: number[]
): VolumeMetrics {
  return {
    volumeZScore: calculateVolumeZScore(volumes, 20),
    mfi: calculateMFI(highs, lows, closes, volumes, 14),
    priceVolumeConfirmation: determinePriceVolumeConfirmation(prices, volumes),
    volumeScore: calculateVolumeScore(prices, volumes, highs, lows, closes),
  };
}
