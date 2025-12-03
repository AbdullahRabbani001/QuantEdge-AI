import OpenAI from 'openai';
import { fetchOHLCData, klinesToOHLC, extractPriceVolume, fetchTopCoins } from './marketData';
import { runQuantEngine, type QuantEngineOutput } from './quant/engine';
import { quantCache } from './cache';

// Initialize OpenAI client for GPT
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Grok client
const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

// Cache for top 50 coins symbol mapping
let top50CoinsCache: Array<{ symbol: string; name: string }> | null = null;
let top50CoinsCacheTime = 0;
const TOP50_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get top 50 coins for symbol extraction
 */
async function getTop50Coins(): Promise<Array<{ symbol: string; name: string }>> {
  const now = Date.now();
  if (top50CoinsCache && now - top50CoinsCacheTime < TOP50_CACHE_TTL) {
    return top50CoinsCache;
  }

  try {
    const coins = await fetchTopCoins(50);
    top50CoinsCache = coins.map((coin: any) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name.toUpperCase()
    }));
    top50CoinsCacheTime = now;
    return top50CoinsCache;
  } catch (error) {
    console.error('Error fetching top 50 coins:', error);
    // Return fallback list
    return [
      { symbol: 'BTC', name: 'BITCOIN' },
      { symbol: 'ETH', name: 'ETHEREUM' },
      { symbol: 'SOL', name: 'SOLANA' },
      { symbol: 'BNB', name: 'BINANCE' },
      { symbol: 'XRP', name: 'RIPPLE' },
      { symbol: 'ADA', name: 'CARDANO' },
      { symbol: 'DOGE', name: 'DOGECOIN' },
      { symbol: 'MATIC', name: 'POLYGON' },
      { symbol: 'DOT', name: 'POLKADOT' },
      { symbol: 'AVAX', name: 'AVALANCHE' }
    ];
  }
}

/**
 * Extract cryptocurrency symbol from user message
 * Supports top 50 coins
 */
async function extractSymbol(message: string): Promise<string | null> {
  const upperMessage = message.toUpperCase();
  
  // Get top 50 coins
  const coins = await getTop50Coins();
  
  // Check symbols first (more specific)
  for (const coin of coins) {
    // Match exact symbol or symbol with word boundaries
    const symbolRegex = new RegExp(`\\b${coin.symbol}\\b`, 'i');
    if (symbolRegex.test(message)) {
      return coin.symbol;
    }
  }
  
  // Check full names
  for (const coin of coins) {
    if (upperMessage.includes(coin.name)) {
      return coin.symbol;
    }
  }
  
  return null;
}

/**
 * Get sentiment analysis from Grok with fallback to OpenAI
 * Returns both sentiment text and numeric score (0-100)
 */
async function getSentimentAnalysis(symbol: string, marketData: string): Promise<{ text: string; score: number }> {
  let sentimentText = '';
  let sentimentScore = 50; // Default neutral

  // Try Grok first
  try {
    const grokResponse = await grokClient.chat.completions.create({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analyst. Analyze the provided market data and provide a brief sentiment analysis (2-3 sentences) covering market mood, social trends, and news sentiment. Also provide a sentiment score from 0-100 where 0 is very bearish, 50 is neutral, and 100 is very bullish. Format your response as: "SENTIMENT: [your analysis text] SCORE: [number 0-100]"'
        },
        {
          role: 'user',
          content: `Analyze the sentiment for ${symbol} based on this market data:\n${marketData}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    sentimentText = grokResponse.choices[0]?.message?.content || '';
    
    // Extract score from response
    const scoreMatch = sentimentText.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      sentimentScore = parseInt(scoreMatch[1], 10);
      sentimentScore = Math.max(0, Math.min(100, sentimentScore));
    }
    
    // Clean up text (remove SCORE part)
    sentimentText = sentimentText.replace(/SCORE:\s*\d+/i, '').replace(/SENTIMENT:/i, '').trim();
    
    if (sentimentText) {
      return { text: sentimentText, score: sentimentScore };
    }
  } catch (error) {
    console.error('Grok API error, falling back to OpenAI:', error);
  }

  // Fallback to OpenAI
  try {
    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analyst. Analyze the provided market data and provide a brief sentiment analysis (2-3 sentences) covering market mood, social trends, and news sentiment. Also provide a sentiment score from 0-100 where 0 is very bearish, 50 is neutral, and 100 is very bullish. Format your response as: "SENTIMENT: [your analysis text] SCORE: [number 0-100]"'
        },
        {
          role: 'user',
          content: `Analyze the sentiment for ${symbol} based on this market data:\n${marketData}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    sentimentText = openaiResponse.choices[0]?.message?.content || '';
    
    // Extract score
    const scoreMatch = sentimentText.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      sentimentScore = parseInt(scoreMatch[1], 10);
      sentimentScore = Math.max(0, Math.min(100, sentimentScore));
    }
    
    // Clean up text
    sentimentText = sentimentText.replace(/SCORE:\s*\d+/i, '').replace(/SENTIMENT:/i, '').trim();
    
    return { text: sentimentText || 'Sentiment analysis unavailable.', score: sentimentScore };
  } catch (error) {
    console.error('OpenAI sentiment API error:', error);
    return { text: 'Sentiment analysis unavailable.', score: 50 };
  }
}

/**
 * Get trading signal from GPT with enhanced quant data
 */
async function getTradingSignalFromGPT(
  symbol: string,
  quantData: any,
  sentimentText: string,
  sentimentScore: number
): Promise<{ signal: string; reasoning: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert cryptocurrency trading analyst. Based on comprehensive quantitative data and sentiment analysis, provide a clear BUY, SELL, or HOLD signal with brief reasoning (2-3 sentences). Consider all technical indicators, market sentiment, risk factors, and regime classification.'
        },
        {
          role: 'user',
          content: `Provide a trading signal for ${symbol}.\n\nQuantitative Analysis:\n- Composite Score: ${quantData.scores.compositeScore}/100\n- Signal: ${quantData.signal}\n- Market Regime: ${quantData.marketRegime}\n- Trend: ${quantData.scores.trend}/100\n- Momentum: ${quantData.scores.momentum}/100\n- Volatility: ${quantData.scores.volatility}/100\n- Volume: ${quantData.scores.volume}/100\n- Risk: ${quantData.scores.risk}/100\n- Confidence: ${quantData.confidence}%\n\nSentiment Analysis:\n${sentimentText}\nSentiment Score: ${sentimentScore}/100\n\nProvide your signal (BUY/SELL/HOLD) and reasoning.`
        }
      ],
      temperature: 0.3,
      max_tokens: 250,
    });
    
    const content = response.choices[0]?.message?.content || '';
    
    // Extract signal (prefer quant engine signal, but allow GPT override)
    let signal = quantData.signal; // Use quant engine signal as base
    if (content.toUpperCase().includes('BUY') && !content.toUpperCase().includes('NOT BUY')) {
      signal = 'BUY';
    } else if (content.toUpperCase().includes('SELL')) {
      signal = 'SELL';
    } else if (content.toUpperCase().includes('HOLD')) {
      signal = 'HOLD';
    }
    
    return {
      signal,
      reasoning: content
    };
  } catch (error) {
    console.error('GPT API error:', error);
    return {
      signal: quantData.signal, // Fallback to quant engine signal
      reasoning: 'Unable to generate enhanced trading signal. Using quantitative analysis signal.'
    };
  }
}

/**
 * Main chat handler with AI integration
 * Full pipeline: symbol extractor → quant engine → Grok sentiment → OpenAI formatting
 */
export async function processAIChat(message: string): Promise<string> {
  // 1. Extract symbol (supports top 50 coins)
  const symbol = await extractSymbol(message);
  
  // If no symbol found, provide general market overview
  if (!symbol) {
    return "I can provide AI-powered crypto analysis! Ask me about specific coins from the top 50 cryptocurrencies.\n\nExample: \"Should I buy Bitcoin?\" or \"What's the market sentiment for Ethereum?\" or \"Analyze SOL\"";
  }
  
  try {
    // 2. Fetch quantitative data using unified engine
    const cacheKey = `quant_${symbol}_1d`;
    let quantResult: QuantEngineOutput | null = quantCache.get<QuantEngineOutput>(cacheKey);
    
    if (!quantResult) {
      const klines = await fetchOHLCData(symbol, '1d', 200);
      
      if (klines.length === 0) {
        return `Unable to fetch market data for ${symbol}. Please try another coin.`;
      }
      
      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);
      
      // Run unified quant engine
      quantResult = await runQuantEngine({
        symbol,
        prices: closes,
        ohlc,
        volumes,
        interval: '1d',
        sentimentScore: 50 // Will be updated with sentiment API
      });
      
      // Cache for 1 minute
      quantCache.set(cacheKey, quantResult, 60 * 1000);
    }
    
    // 3. Prepare market data summary for sentiment analysis
    const currentPrice = quantResult.metrics.trend.slope > 0 
      ? quantResult.metrics.trend.slope 
      : 0; // We'll get price from market data
    
    // Fetch current price separately
    const { fetchCurrentPrice } = await import('./marketData');
    const price = await fetchCurrentPrice(symbol) || 0;
    
    const priceChange = quantResult.metrics.momentum.roc || 0;
    const marketDataSummary = `Symbol: ${symbol}\nCurrent Price: $${price.toFixed(2)}\nPrice Change: ${priceChange.toFixed(2)}%\nComposite Score: ${quantResult.scores.compositeScore}/100\nSignal: ${quantResult.signal}\nMarket Regime: ${quantResult.marketRegime}\nTrend: ${quantResult.scores.trend}/100\nMomentum: ${quantResult.scores.momentum}/100\nRisk: ${quantResult.scores.risk}/100`;
    
    // 4. Get sentiment analysis (Grok with OpenAI fallback)
    const sentiment = await getSentimentAnalysis(symbol, marketDataSummary);
    
    // 5. Re-run quant engine with actual sentiment score
    if (sentiment.score !== 50) {
      const klines = await fetchOHLCData(symbol, '1d', 200);
      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);
      
      quantResult = await runQuantEngine({
        symbol,
        prices: closes,
        ohlc,
        volumes,
        interval: '1d',
        sentimentScore: sentiment.score
      });
      
      quantCache.set(cacheKey, quantResult, 60 * 1000);
    }
    
    // 6. Get enhanced trading signal from GPT
    const tradingSignal = await getTradingSignalFromGPT(
      symbol, 
      quantResult, 
      sentiment.text,
      sentiment.score
    );
    
    // 7. Format comprehensive response
    const signalEmoji = tradingSignal.signal === 'BUY' ? '🟢' : tradingSignal.signal === 'SELL' ? '🔴' : '🟡';
    
    const response = `## ${symbol} AI Analysis\n\n` +
      `### ${signalEmoji} Trading Signal: ${tradingSignal.signal}\n` +
      `${tradingSignal.reasoning}\n\n` +
      `---\n\n` +
      `### 📊 Quantitative Analysis\n` +
      `• **Composite Score:** ${quantResult.scores.compositeScore}/100\n` +
      `• **Market Regime:** ${quantResult.marketRegime.toUpperCase()}\n` +
      `• **Confidence:** ${quantResult.confidence}%\n` +
      `• **Trend:** ${quantResult.scores.trend}/100\n` +
      `• **Momentum:** ${quantResult.scores.momentum}/100\n` +
      `• **Volatility:** ${quantResult.scores.volatility}/100\n` +
      `• **Volume:** ${quantResult.scores.volume}/100\n` +
      `• **Risk:** ${quantResult.scores.risk}/100\n\n` +
      `---\n\n` +
      `### 💭 Market Sentiment\n` +
      `**Score:** ${sentiment.score}/100\n` +
      `${sentiment.text}\n\n` +
      `---\n\n` +
      `*Current Price: $${price.toFixed(2)} | Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%*`;
    
    return response;
    
  } catch (error) {
    console.error('Error in AI chat processing:', error);
    return `I encountered an error analyzing ${symbol}. Please try again.`;
  }
}

/**
 * Get market regime analysis using unified quant engine
 */
export async function getMarketRegimeAnalysis(): Promise<string> {
  try {
    const cacheKey = 'regime_btc_1d';
    let quantResult: QuantEngineOutput | null = quantCache.get<QuantEngineOutput>(cacheKey);
    
    if (!quantResult) {
      const klines = await fetchOHLCData('BTC', '1d', 300);
      
      if (klines.length === 0) {
        return 'Unable to fetch market data for regime analysis.';
      }
      
      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);
      
      quantResult = await runQuantEngine({
        symbol: 'BTC',
        prices: closes,
        ohlc,
        volumes,
        interval: '1d',
        sentimentScore: 50
      });
      
      quantCache.set(cacheKey, quantResult, 5 * 60 * 1000);
    }
    
    // Get AI insight on the regime
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market analyst. Provide brief actionable insights (2-3 sentences) based on the current market regime.'
        },
        {
          role: 'user',
          content: `Current market regime: ${quantResult.marketRegime}\nVolatility: ${quantResult.metrics.volatility.regime}\nTrend Strength: ${quantResult.scores.trend}/100\nMomentum: ${quantResult.scores.momentum}/100\nRisk: ${quantResult.scores.risk}/100\nConfidence: ${quantResult.confidence}%\n\nProvide trading insights for this market condition.`
        }
      ],
      temperature: 0.5,
      max_tokens: 200,
    });
    
    const aiInsight = response.choices[0]?.message?.content || '';
    
    return `## Market Regime Analysis\n\n` +
      `**Regime:** ${quantResult.marketRegime.toUpperCase()}\n` +
      `**Volatility:** ${quantResult.metrics.volatility.regime}\n` +
      `**Trend Strength:** ${quantResult.scores.trend}/100\n` +
      `**Momentum:** ${quantResult.scores.momentum}/100\n` +
      `**Risk:** ${quantResult.scores.risk}/100\n` +
      `**Confidence:** ${quantResult.confidence}%\n\n` +
      `---\n\n` +
      `### AI Insight\n${aiInsight}`;
    
  } catch (error) {
    console.error('Error in regime analysis:', error);
    return 'Unable to analyze market regime at this time.';
  }
}
