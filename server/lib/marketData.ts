// Market data fetching utilities
import { type OHLC } from './quant/volatility';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const BINANCE_API = 'https://api.binance.com/api/v3';

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
}

// Simple in-memory cache
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Fetch top coins from CoinGecko
 */
export async function fetchTopCoins(limit: number = 50): Promise<CoinData[]> {
  const cacheKey = `topCoins_${limit}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('CoinGecko rate limit hit, returning cached data if available');
        return cache[cacheKey]?.data || [];
      }
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    cache[cacheKey] = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error('Error fetching top coins:', error);
    return cache[cacheKey]?.data || [];
  }
}

/**
 * Fetch single coin data from CoinGecko
 */
export async function fetchCoinData(coinId: string): Promise<any> {
  const cacheKey = `coin_${coinId}`;
  const now = Date.now();

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`CoinGecko rate limit hit for ${coinId}, returning cached data if available`);
        return cache[cacheKey]?.data || null;
      }
      if (response.status === 404) {
        console.warn(`CoinGecko: Coin ID "${coinId}" not found`);
        return null;
      }
      console.error(`CoinGecko API error for ${coinId}: ${response.status} ${response.statusText}`);
      return cache[cacheKey]?.data || null;
    }

    const data = await response.json();
    cache[cacheKey] = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error(`Error fetching coin data for ${coinId}:`, error);
    return cache[cacheKey]?.data || null;
  }
}

/**
 * Map common symbols to CoinGecko IDs
 */
const SYMBOL_TO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'USDC': 'usd-coin',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'TRX': 'tron',
  'AVAX': 'avalanche-2',
  'SHIB': 'shiba-inu',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LTC': 'litecoin',
};

export function symbolToCoinGeckoId(symbol: string): string {
  return SYMBOL_TO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
}

/**
 * List of stablecoins that don't trade on Binance (or trade against themselves)
 * These should skip Binance and go directly to CoinGecko
 */
const STABLECOINS = new Set([
  'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD', 'GUSD',
  'USDK', 'HUSD', 'PAX', 'CUSD', 'USDJ', 'USDE', 'USD1', 'USDT0'
]);

/**
 * Check if a symbol is a stablecoin
 */
export function isStablecoin(symbol: string): boolean {
  const symbolUpper = symbol.toUpperCase();
  // Check exact match
  if (STABLECOINS.has(symbolUpper)) {
    return true;
  }
  // Check if symbol starts with pattern (e.g., USDT0 starts with USDT)
  for (const stablecoin of STABLECOINS) {
    if (symbolUpper.startsWith(stablecoin) || symbolUpper === stablecoin) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch OHLC (klines) data from Binance
 */
export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export async function fetchBinanceKlines(
  symbol: string,
  interval: '1h' | '4h' | '1d' | '1w' = '1d',
  limit: number = 100
): Promise<BinanceKline[]> {
  try {
    // Ensure symbol is in USDT pair format
    const pair = symbol.toUpperCase().endsWith('USDT')
      ? symbol.toUpperCase()
      : `${symbol.toUpperCase()}USDT`;

    const response = await fetch(
      `${BINANCE_API}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`
    );

    if (!response.ok) {
      // Silently fail for unsupported pairs (Bad Request, Not Found)
      return [];
    }

    const data = await response.json();

    return data.map((kline: any[]) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
    }));
  } catch (error) {
    // Silently fail on network errors
    return [];
  }
}

/**
 * Convert Binance klines to OHLC format for quant calculations
 */
export function klinesToOHLC(klines: BinanceKline[]): OHLC[] {
  return klines.map(k => ({
    open: parseFloat(k.open),
    high: parseFloat(k.high),
    low: parseFloat(k.low),
    close: parseFloat(k.close),
  }));
}

/**
 * Extract price and volume arrays from klines
 */
export function extractPriceVolume(klines: BinanceKline[]): {
  closes: number[];
  volumes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
} {
  return {
    closes: klines.map(k => parseFloat(k.close)),
    volumes: klines.map(k => parseFloat(k.volume)),
    highs: klines.map(k => parseFloat(k.high)),
    lows: klines.map(k => parseFloat(k.low)),
    opens: klines.map(k => parseFloat(k.open)),
  };
}

/**
 * Fetch historical price data from CoinGecko (alternative to Binance)
 * Note: CoinGecko only supports daily intervals, so all intervals are converted to daily
 */
export async function fetchCoinGeckoHistory(
  coinId: string,
  days: number = 100
): Promise<BinanceKline[]> {
  try {
    // CoinGecko market_chart API has limits: max 365 days for daily, max 90 days for hourly
    // We'll use daily for simplicity and cap at 365 days
    const cappedDays = Math.min(days, 365);
    
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${cappedDays}&interval=daily`
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`CoinGecko: Coin ID "${coinId}" not found`);
      } else {
        console.warn(`CoinGecko API error for ${coinId}: ${response.status} ${response.statusText}`);
      }
      return [];
    }

    const data = await response.json();

    // Convert CoinGecko format to our kline format
    // CoinGecko returns [timestamp, price] arrays
    const prices = data.prices || [];
    const volumes = data.total_volumes || [];

    if (prices.length === 0) {
      console.warn(`CoinGecko: No price data for ${coinId}`);
      return [];
    }

    return prices.map((pricePoint: [number, number], index: number) => {
      const price = pricePoint[1];
      const volume = volumes[index] ? volumes[index][1] : 0;

      return {
        openTime: pricePoint[0],
        open: price.toString(),
        high: price.toString(),
        low: price.toString(),
        close: price.toString(),
        volume: volume.toString(),
        closeTime: pricePoint[0],
      };
    });
  } catch (error) {
    console.error(`Error fetching CoinGecko history for ${coinId}:`, error);
    return [];
  }
}

/**
 * Fetch OHLC data - tries Binance first, falls back to CoinGecko
 * For stablecoins, skips Binance and goes directly to CoinGecko
 */
export async function fetchOHLCData(
  symbol: string,
  interval: '1h' | '4h' | '1d' | '1w' = '1d',
  limit: number = 100
): Promise<BinanceKline[]> {
  const symbolUpper = symbol.toUpperCase();
  
  // Skip Binance for stablecoins (they don't trade against themselves)
  if (isStablecoin(symbolUpper)) {
    const coinId = symbolToCoinGeckoId(symbolUpper);
    // Convert limit to days (approximate: 1 day = 1 data point for daily interval)
    // For hourly intervals, we still use daily from CoinGecko (it only supports daily)
    const days = Math.min(Math.ceil(limit / 1), 365); // Cap at 365 days
    const data = await fetchCoinGeckoHistory(coinId, days);
    
    if (data.length === 0) {
      console.warn(`No OHLC data found for stablecoin ${symbolUpper} (CoinGecko ID: ${coinId})`);
    }
    
    return data;
  }

  // Try Binance first for non-stablecoins
  const binanceData = await fetchBinanceKlines(symbol, interval, limit);

  if (binanceData.length > 0) {
    return binanceData;
  }

  // Fallback to CoinGecko
  const coinId = symbolToCoinGeckoId(symbolUpper);
  // Convert limit to days (approximate conversion)
  const days = Math.min(Math.ceil(limit / 1), 365);
  const data = await fetchCoinGeckoHistory(coinId, days);
  
  if (data.length === 0) {
    console.warn(`No OHLC data found for ${symbolUpper} (CoinGecko ID: ${coinId})`);
  }
  
  return data;
}

/**
 * Fetch current price from Binance with CoinGecko fallback
 * For stablecoins, skips Binance and goes directly to CoinGecko
 */
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  const symbolUpper = symbol.toUpperCase();
  
  // Skip Binance for stablecoins (they don't trade against themselves)
  if (isStablecoin(symbolUpper)) {
    try {
      const coinId = symbolToCoinGeckoId(symbolUpper);
      const response = await fetch(
        `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd`
      );

      if (response.ok) {
        const data = await response.json();
        if (data[coinId]?.usd) {
          return data[coinId].usd;
        }
      } else {
        console.warn(`CoinGecko price fetch failed for ${symbolUpper} (ID: ${coinId}): ${response.status}`);
      }
    } catch (error) {
      console.error(`Error fetching current price for stablecoin ${symbolUpper}:`, error);
    }
    return null;
  }

  // Try Binance first for non-stablecoins
  try {
    const pair = symbolUpper.endsWith('USDT')
      ? symbolUpper
      : `${symbolUpper}USDT`;

    const response = await fetch(`${BINANCE_API}/ticker/price?symbol=${pair}`);

    if (response.ok) {
      const data = await response.json();
      return parseFloat(data.price);
    }
  } catch (error) {
    // Silently fall through to CoinGecko
  }

  // Fallback to CoinGecko
  try {
    const coinId = symbolToCoinGeckoId(symbolUpper);
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (response.ok) {
      const data = await response.json();
      if (data[coinId]?.usd) {
        return data[coinId].usd;
      }
    }
  } catch (error) {
    console.error(`Error fetching current price for ${symbolUpper}:`, error);
  }

  return null;
}
