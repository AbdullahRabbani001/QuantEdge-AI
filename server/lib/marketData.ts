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

/**
 * Fetch top coins from CoinGecko
 */
export async function fetchTopCoins(limit: number = 50): Promise<CoinData[]> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching top coins:', error);
    return [];
  }
}

/**
 * Fetch single coin data from CoinGecko
 */
export async function fetchCoinData(coinId: string): Promise<any> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching coin data for ${coinId}:`, error);
    return null;
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
 */
export async function fetchCoinGeckoHistory(
  coinId: string,
  days: number = 100
): Promise<BinanceKline[]> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`
    );
    
    if (!response.ok) {
      // Silently fail for unsupported coin IDs
      return [];
    }
    
    const data = await response.json();
    
    // Convert CoinGecko format to our kline format
    // CoinGecko returns [timestamp, price] arrays
    const prices = data.prices || [];
    const volumes = data.total_volumes || [];
    
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
    // Silently fail on network errors
    return [];
  }
}

/**
 * Fetch OHLC data - tries Binance first, falls back to CoinGecko
 */
export async function fetchOHLCData(
  symbol: string,
  interval: '1h' | '4h' | '1d' | '1w' = '1d',
  limit: number = 100
): Promise<BinanceKline[]> {
  // Try Binance first
  const binanceData = await fetchBinanceKlines(symbol, interval, limit);
  
  if (binanceData.length > 0) {
    return binanceData;
  }
  
  // Fallback to CoinGecko
  const coinId = symbolToCoinGeckoId(symbol);
  return await fetchCoinGeckoHistory(coinId, limit);
}

/**
 * Fetch current price from Binance with CoinGecko fallback
 */
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  // Try Binance first
  try {
    const pair = symbol.toUpperCase().endsWith('USDT') 
      ? symbol.toUpperCase() 
      : `${symbol.toUpperCase()}USDT`;
    
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
    const coinId = symbolToCoinGeckoId(symbol);
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
    console.error(`Error fetching current price for ${symbol}:`, error);
  }
  
  return null;
}
