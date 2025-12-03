// Statistical utility functions for quant analysis

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

export function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const meanX = mean(x);
  const meanY = mean(y);
  let cov = 0;
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - meanX) * (y[i] - meanY);
  }
  return cov / x.length;
}

export function simpleMovingAverage(values: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      sma.push(mean(slice));
    }
  }
  return sma;
}

export function exponentialMovingAverage(values: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Initialize with SMA
  if (values.length < period) return values; // Not enough data

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  const initialSMA = sum / period;

  // Fill first period-1 with nulls or partial EMAs (standard is usually to start output at index period-1)
  // But to keep array length same, we can fill with NaNs or just start calculating
  // For this implementation, we'll replicate the previous behavior of returning an array of same length
  // But we'll use SMA for the first valid point

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      ema.push(values[i]); // Fallback for initial values
    } else if (i === period - 1) {
      ema.push(initialSMA);
    } else {
      ema.push((values[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
  }
  return ema;
}

export function downsideDeviation(values: number[], target: number = 0): number {
  if (values.length === 0) return 0;

  const squaredDownsideDiffs = values.map(val => {
    const diff = Math.min(0, val - target);
    return diff * diff;
  });

  return Math.sqrt(mean(squaredDownsideDiffs));
}
