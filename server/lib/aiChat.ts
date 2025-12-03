import OpenAI from 'openai';
import { fetchOHLCData, klinesToOHLC, extractPriceVolume } from './marketData';
import { calculateQuantScore, calculateMarketRegime } from './quant/scoring';
import { exponentialMovingAverage } from './quant/statistics';

// Initialize OpenAI client for GPT
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Grok client
const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

/**
 * Extract cryptocurrency symbol from user message
 */
function extractSymbol(message: string): string | null {
  const upperMessage = message.toUpperCase();
  const commonSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
  
  for (const symbol of commonSymbols) {
    if (upperMessage.includes(symbol)) {
      return symbol;
    }
  }
  
  // Check for full names
  const nameMap: Record<string, string> = {
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH',
    'SOLANA': 'SOL',
    'BINANCE': 'BNB',
    'RIPPLE': 'XRP',
    'CARDANO': 'ADA',
    'DOGECOIN': 'DOGE',
  };
  
  for (const [name, symbol] of Object.entries(nameMap)) {
    if (upperMessage.includes(name)) {
      return symbol;
    }
  }
  
  return null;
}

/**
 * Get sentiment analysis from Grok
 */
async function getSentimentFromGrok(symbol: string, marketData: string): Promise<string> {
  try {
    const response = await grokClient.chat.completions.create({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analyst. Analyze the provided market data and provide a brief sentiment analysis (2-3 sentences) covering market mood, social trends, and news sentiment. Be concise and factual.'
        },
        {
          role: 'user',
          content: `Analyze the sentiment for ${symbol} based on this market data:\n${marketData}`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    return response.choices[0]?.message?.content || 'Unable to analyze sentiment at this time.';
  } catch (error) {
    console.error('Grok API error:', error);
    return 'Sentiment analysis unavailable.';
  }
}

/**
 * Get trading signal from GPT
 */
async function getTradingSignalFromGPT(
  symbol: string,
  quantData: any,
  sentiment: string
): Promise<{ signal: string; reasoning: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert cryptocurrency trading analyst. Based on quantitative data and sentiment analysis, provide a clear BUY, SELL, or HOLD signal with brief reasoning (2-3 sentences). Consider technical indicators, market sentiment, and risk factors.'
        },
        {
          role: 'user',
          content: `Provide a trading signal for ${symbol}.\n\nQuantitative Analysis:\n- Score: ${quantData.score}/100\n- Signal: ${quantData.signal}\n- Trend: ${quantData.factors.trend}/100\n- Momentum: ${quantData.factors.momentum}/100\n- Volatility: ${quantData.factors.volatility}/100\n- Confidence: ${quantData.confidence}%\n\nSentiment Analysis:\n${sentiment}\n\nProvide your signal (BUY/SELL/HOLD) and reasoning.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    const content = response.choices[0]?.message?.content || '';
    
    // Extract signal
    let signal = 'HOLD';
    if (content.toUpperCase().includes('BUY') && !content.toUpperCase().includes('NOT BUY')) {
      signal = 'BUY';
    } else if (content.toUpperCase().includes('SELL')) {
      signal = 'SELL';
    }
    
    return {
      signal,
      reasoning: content
    };
  } catch (error) {
    console.error('GPT API error:', error);
    return {
      signal: 'HOLD',
      reasoning: 'Unable to generate trading signal at this time.'
    };
  }
}

/**
 * Main chat handler with AI integration
 */
export async function processAIChat(message: string): Promise<string> {
  const symbol = extractSymbol(message);
  
  // If no symbol found, provide general market overview
  if (!symbol) {
    return "I can provide AI-powered crypto analysis! Ask me about specific coins like BTC, ETH, SOL, or ask about the overall market regime.\n\nExample: \"Should I buy Bitcoin?\" or \"What's the market sentiment for Ethereum?\"";
  }
  
  try {
    // 1. Fetch quantitative data
    const klines = await fetchOHLCData(symbol, '1d', 100);
    
    if (klines.length === 0) {
      return `Unable to fetch market data for ${symbol}. Please try another coin.`;
    }
    
    const ohlc = klinesToOHLC(klines);
    const { closes, volumes } = extractPriceVolume(klines);
    const quantScore = calculateQuantScore(symbol, closes, ohlc, volumes, 50);
    
    // Prepare market data summary for sentiment analysis
    const currentPrice = closes[closes.length - 1];
    const priceChange = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
    const marketDataSummary = `Current Price: $${currentPrice.toFixed(2)}\n24h Change: ${priceChange.toFixed(2)}%\nQuant Score: ${quantScore.score}/100\nSignal: ${quantScore.signal}`;
    
    // 2. Get sentiment from Grok (parallel with quant)
    const sentiment = await getSentimentFromGrok(symbol, marketDataSummary);
    
    // 3. Get trading signal from GPT
    const tradingSignal = await getTradingSignalFromGPT(symbol, quantScore, sentiment);
    
    // 4. Format comprehensive response
    const signalEmoji = tradingSignal.signal === 'BUY' ? '🟢' : tradingSignal.signal === 'SELL' ? '🔴' : '🟡';
    
    const response = `## ${symbol} AI Analysis\n\n` +
      `### ${signalEmoji} Trading Signal: ${tradingSignal.signal}\n` +
      `${tradingSignal.reasoning}\n\n` +
      `---\n\n` +
      `### 📊 Quantitative Analysis\n` +
      `• **Quant Score:** ${quantScore.score}/100 (${quantScore.signal})\n` +
      `• **Confidence:** ${quantScore.confidence}%\n` +
      `• **Trend:** ${quantScore.factors.trend}/100\n` +
      `• **Momentum:** ${quantScore.factors.momentum}/100\n` +
      `• **Volatility:** ${quantScore.factors.volatility}/100\n\n` +
      `*${quantScore.explanation}*\n\n` +
      `---\n\n` +
      `### 💭 Market Sentiment (Powered by Grok)\n` +
      `${sentiment}\n\n` +
      `---\n\n` +
      `*Current Price: $${currentPrice.toFixed(2)} | 24h Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%*`;
    
    return response;
    
  } catch (error) {
    console.error('Error in AI chat processing:', error);
    return `I encountered an error analyzing ${symbol}. Please try again.`;
  }
}

/**
 * Get market regime analysis
 */
export async function getMarketRegimeAnalysis(): Promise<string> {
  try {
    const klines = await fetchOHLCData('BTC', '1d', 200);
    
    if (klines.length === 0) {
      return 'Unable to fetch market data for regime analysis.';
    }
    
    const ohlc = klinesToOHLC(klines);
    const { closes } = extractPriceVolume(klines);
    const ema200 = exponentialMovingAverage(closes, 200);
    const regime = calculateMarketRegime(closes, ohlc, ema200);
    
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
          content: `Current market regime: ${regime.regime}\nVolatility: ${regime.volatility}\nTrend Strength: ${regime.trendStrength}/100\nConfidence: ${regime.confidence}%\n\nProvide trading insights for this market condition.`
        }
      ],
      temperature: 0.5,
      max_tokens: 150,
    });
    
    const aiInsight = response.choices[0]?.message?.content || '';
    
    return `## Market Regime Analysis\n\n` +
      `**Regime:** ${regime.regime}\n` +
      `**Volatility:** ${regime.volatility}\n` +
      `**Trend Strength:** ${regime.trendStrength}/100\n` +
      `**Confidence:** ${regime.confidence}%\n\n` +
      `${regime.explanation}\n\n` +
      `---\n\n` +
      `### AI Insight\n${aiInsight}`;
    
  } catch (error) {
    console.error('Error in regime analysis:', error);
    return 'Unable to analyze market regime at this time.';
  }
}
