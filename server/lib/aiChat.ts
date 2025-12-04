import OpenAI from 'openai';
import { fetchOHLCData, klinesToOHLC, extractPriceVolume, fetchTopCoins, fetchCurrentPrice } from './marketData';
import { runQuantEngine, type QuantEngineOutput } from './quant/engine';
import { quantCache } from './cache';

// Lazy initialization of OpenAI client for GPT
let openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openai) {
    // Check for both OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_API_KEY (Replit compatibility)
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY environment variable is not set. Please add it to your .env file in the project root.');
    }
    
    // Use base URL if provided (for Replit integrations)
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
    
    openai = new OpenAI({
      apiKey: apiKey,
      ...(baseURL && { baseURL }),
    });
  }
  return openai;
}

// Lazy initialization of Grok client (only if API key exists)
let grokClient: OpenAI | null = null;
function getGrokClient(): OpenAI | null {
  if (!grokClient && process.env.XAI_API_KEY) {
    grokClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });
  }
  return grokClient;
}

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
 * Detect user intent using GPT
 * Returns: { intent: string, symbol: string | null, isMarketWide: boolean, scenario?: string }
 */
async function detectIntent(userMessage: string): Promise<{
  intent: 'price' | 'future' | 'bullish' | 'bearish' | 'market' | 'risk' | 'portfolio' | 'general';
  symbol: string | null;
  isMarketWide: boolean;
  scenario?: string;
}> {
  try {
    // First, try to extract symbol
    const symbol = await extractSymbol(userMessage);
    
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for a cryptocurrency trading assistant. Analyze the user's question and classify it into one of these categories:
- price: Questions about current price, price movements, price levels
- future: Questions about future price scenarios (e.g., "if BTC drops to 86k should I buy?")
- bullish: Questions asking about bullish signals, buying opportunities
- bearish: Questions asking about bearish signals, selling opportunities
- market: Questions about overall market conditions, market-wide analysis
- risk: Questions about risk assessment, risk factors
- portfolio: Questions about portfolio management, diversification
- general: General questions not fitting above categories

Also detect if the question is market-wide (no specific coin) or coin-specific.

If the question contains a future scenario (e.g., "if X drops to Y"), extract the scenario.

Respond in JSON format: {"intent": "category", "isMarketWide": boolean, "scenario": "scenario text if applicable"}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    return {
      intent: parsed.intent || 'general',
      symbol: symbol,
      isMarketWide: parsed.isMarketWide || (!symbol && true),
      scenario: parsed.scenario
    };
  } catch (error) {
    console.error('Error detecting intent:', error);
    // Fallback: extract symbol and guess intent
    const symbol = await extractSymbol(userMessage);
    return {
      intent: 'general',
      symbol: symbol,
      isMarketWide: !symbol
    };
  }
}

/**
 * Derive whale flow score from volume and price metrics
 * Returns 0-100 score (higher = more whale activity)
 */
function deriveWhaleFlow(quantData: QuantEngineOutput): number {
  const volumeZ = quantData.metrics.volume.volumeZScore;
  const volumeScore = quantData.scores.volume;
  const momentum = quantData.scores.momentum;
  
  // Large volume spikes (z-score > 2) indicate whale activity
  const whaleActivity = Math.min(100, Math.max(0, 50 + volumeZ * 10));
  
  // Combine with volume score and momentum
  const whaleFlow = (whaleActivity * 0.5 + volumeScore * 0.3 + momentum * 0.2);
  
  return Math.round(Math.max(0, Math.min(100, whaleFlow)));
}

/**
 * Derive liquidity score from volume and volatility metrics
 * Returns 0-100 score (higher = better liquidity)
 */
function deriveLiquidityScore(quantData: QuantEngineOutput): number {
  const volumeScore = quantData.scores.volume;
  const volatilityScore = quantData.scores.volatility;
  const volumeZ = quantData.metrics.volume.volumeZScore;
  
  // High volume + moderate volatility = good liquidity
  // Very low volatility might indicate low liquidity (stablecoins)
  const liquidityBase = (volumeScore * 0.6 + volatilityScore * 0.4);
  
  // Adjust based on volume z-score (recent activity)
  const liquidityAdjusted = liquidityBase + (volumeZ > 0 ? Math.min(10, volumeZ * 2) : Math.max(-10, volumeZ * 2));
  
  return Math.round(Math.max(0, Math.min(100, liquidityAdjusted)));
}

/**
 * Get sentiment analysis from Grok (if available) or return neutral
 * Returns both sentiment text and numeric score (0-100)
 */
async function getSentimentAnalysis(symbol: string, marketSnapshot: string): Promise<{ text: string; score: number }> {
  // Only use Grok if API key exists
  const grok = getGrokClient();
  if (!grok || !process.env.XAI_API_KEY) {
    return {
      text: 'Sentiment data unavailable. Grok API key not configured.',
      score: 50 // Neutral
    };
  }

  try {
    const grokResponse = await grok.chat.completions.create({
      model: 'grok-beta',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market sentiment analyst. Analyze the provided market data and provide a brief sentiment analysis (2-3 sentences) covering market mood, social trends, and news sentiment. Also provide a sentiment score from 0-100 where 0 is very bearish, 50 is neutral, and 100 is very bullish. Format your response as: "SENTIMENT: [your analysis text] SCORE: [number 0-100]"'
        },
        {
          role: 'user',
          content: `Analyze the sentiment for ${symbol} based on this market data:\n${marketSnapshot}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    const sentimentText = grokResponse.choices[0]?.message?.content || '';
    
    // Extract score from response
    const scoreMatch = sentimentText.match(/SCORE:\s*(\d+)/i);
    let sentimentScore = 50; // Default neutral
    if (scoreMatch) {
      sentimentScore = parseInt(scoreMatch[1], 10);
      sentimentScore = Math.max(0, Math.min(100, sentimentScore));
    }
    
    // Clean up text (remove SCORE part)
    const cleanedText = sentimentText.replace(/SCORE:\s*\d+/i, '').replace(/SENTIMENT:/i, '').trim();
    
    return {
      text: cleanedText || 'Sentiment analysis unavailable.',
      score: sentimentScore
    };
  } catch (error) {
    console.error('Grok API error:', error);
    return {
      text: 'Sentiment analysis unavailable. API error occurred.',
      score: 50 // Neutral fallback
    };
  }
}

/**
 * Compute weighted final signal
 * Formula: 0.80 * mathModelSignalValue + 0.10 * sentimentScore + 0.10 * gptInterpretationScore
 */
function computeWeightedSignal(
  quantSignal: 'BUY' | 'SELL' | 'HOLD',
  sentimentScore: number,
  gptInterpretationScore: number
): 'BUY' | 'SELL' | 'HOLD' {
  // Convert quant signal to numeric (BUY=1, HOLD=0.5, SELL=0)
  const mathModelSignalValue = quantSignal === 'BUY' ? 1 : quantSignal === 'SELL' ? 0 : 0.5;
  
  // Normalize sentiment to [0-1]
  const sentimentNormalized = sentimentScore / 100;
  
  // Normalize GPT interpretation to [0-1]
  const gptNormalized = gptInterpretationScore / 100;
  
  // Weighted combination
  const finalSignalValue = 
    0.80 * mathModelSignalValue +
    0.10 * sentimentNormalized +
    0.10 * gptNormalized;
  
  // Apply thresholds
  if (finalSignalValue > 0.67) return 'BUY';
  if (finalSignalValue < 0.38) return 'SELL';
  return 'HOLD';
}

/**
 * Get GPT interpretation score (directional confidence from GPT reasoning)
 * Returns 0-100 score
 */
async function getGPTInterpretationScore(
  symbol: string,
  quantData: QuantEngineOutput,
  sentimentText: string,
  sentimentScore: number,
  userQuestion: string,
  scenario?: string
): Promise<{ score: number; reasoning: string }> {
  try {
    const client = getOpenAIClient();
    const prompt = scenario 
      ? `User question: "${userQuestion}"
      
Scenario: ${scenario}

Quantitative Analysis for ${symbol}:
- Composite Score: ${quantData.scores.compositeScore}/100
- Signal: ${quantData.signal}
- Market Regime: ${quantData.marketRegime}
- Trend: ${quantData.scores.trend}/100
- Momentum: ${quantData.scores.momentum}/100
- Volatility: ${quantData.scores.volatility}/100
- Volume: ${quantData.scores.volume}/100
- Risk: ${quantData.scores.risk}/100
- Confidence: ${quantData.confidence}%
- Forecast Direction: ${quantData.forecast?.direction}
- Forecast Probability: ${quantData.forecast?.probability}%
- Trend Continuation: ${quantData.forecast?.trendContinuation}%
- Trend Reversal: ${quantData.forecast?.trendReversal}%
- Support: $${quantData.forecast?.support?.toFixed(2)}
- Resistance: $${quantData.forecast?.resistance?.toFixed(2)}
- RSI: ${quantData.metrics.momentum.rsi.toFixed(1)}
- MACD Histogram: ${quantData.metrics.trend.macdHistogram.toFixed(4)}

Sentiment Analysis:
${sentimentText}
Sentiment Score: ${sentimentScore}/100

Analyze this scenario and provide:
1. A directional confidence score (0-100) where 0 is very bearish, 50 is neutral, 100 is very bullish
2. Brief reasoning (2-3 sentences) explaining your confidence level

Consider the scenario context, support/resistance levels, risk-to-reward ratio, and current market conditions.

Respond in JSON: {"score": number, "reasoning": "text"}`
      : `User question: "${userQuestion}"

Quantitative Analysis for ${symbol}:
- Composite Score: ${quantData.scores.compositeScore}/100
- Signal: ${quantData.signal}
- Market Regime: ${quantData.marketRegime}
- Trend: ${quantData.scores.trend}/100
- Momentum: ${quantData.scores.momentum}/100
- Volatility: ${quantData.scores.volatility}/100
- Volume: ${quantData.scores.volume}/100
- Risk: ${quantData.scores.risk}/100
- Confidence: ${quantData.confidence}%
- Forecast Direction: ${quantData.forecast?.direction}
- Forecast Probability: ${quantData.forecast?.probability}%
- Trend Continuation: ${quantData.forecast?.trendContinuation}%
- Trend Reversal: ${quantData.forecast?.trendReversal}%
- Support: $${quantData.forecast?.support?.toFixed(2)}
- Resistance: $${quantData.forecast?.resistance?.toFixed(2)}
- RSI: ${quantData.metrics.momentum.rsi.toFixed(1)}
- MACD Histogram: ${quantData.metrics.trend.macdHistogram.toFixed(4)}

Sentiment Analysis:
${sentimentText}
Sentiment Score: ${sentimentScore}/100

Based on the quantitative data and sentiment, provide:
1. A directional confidence score (0-100) where 0 is very bearish, 50 is neutral, 100 is very bullish
2. Brief reasoning (2-3 sentences) explaining your confidence level

Respond in JSON: {"score": number, "reasoning": "text"}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert cryptocurrency trading analyst. Analyze quantitative data and provide directional confidence scores with clear reasoning.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      reasoning: parsed.reasoning || 'Analysis based on quantitative metrics.'
    };
  } catch (error) {
    console.error('GPT interpretation error:', error);
    return {
      score: 50, // Neutral fallback
      reasoning: 'Unable to generate interpretation. Using quantitative signal.'
    };
  }
}

/**
 * Format comprehensive AI response
 */
function formatResponse(
  symbol: string | 'MARKET',
  quantData: QuantEngineOutput,
  sentiment: { text: string; score: number },
  finalSignal: 'BUY' | 'SELL' | 'HOLD',
  gptReasoning: string,
  whaleFlow: number,
  liquidityScore: number,
  currentPrice: number,
  priceChange: number
): string {
  const signalEmoji = finalSignal === 'BUY' ? '🟢' : finalSignal === 'SELL' ? '🔴' : '🟡';
  
  // Detect overheated/oversold states
  const rsi = quantData.metrics.momentum.rsi;
  const overheated = rsi > 70;
  const oversold = rsi < 30;
  
  // Detect reversal conditions
  const reversalRisk = quantData.forecast?.trendReversal || 0;
  const continuationStrength = quantData.forecast?.trendContinuation || 0;
  
  // Detect dip/FOMO conditions
  const isDip = quantData.scores.momentum < 40 && quantData.scores.trend < 50 && quantData.marketRegime !== 'bull';
  const isFOMO = quantData.scores.momentum > 70 && quantData.scores.trend > 65 && quantData.marketRegime === 'bull';
  
  let reasoning = `**Trend Analysis:** `;
  if (quantData.scores.trend > 65) {
    reasoning += `Strong ${quantData.metrics.trend.trendDirection.toLowerCase()}ward trend with slope ${quantData.metrics.trend.slope.toFixed(4)}. `;
  } else if (quantData.scores.trend < 35) {
    reasoning += `Weak or declining trend. `;
  } else {
    reasoning += `Moderate trend strength. `;
  }
  
  reasoning += `\n\n**Momentum:** `;
  if (quantData.scores.momentum > 65) {
    reasoning += `Strong bullish momentum (RSI: ${rsi.toFixed(1)}). `;
  } else if (quantData.scores.momentum < 35) {
    reasoning += `Weak momentum, potential oversold conditions. `;
  } else {
    reasoning += `Moderate momentum. `;
  }
  
  reasoning += `\n\n**Volatility:** `;
  reasoning += `${quantData.metrics.volatility.regime.toLowerCase()} volatility environment (${quantData.metrics.volatility.historicalVol.toFixed(2)}%). `;
  
  reasoning += `\n\n**Volume & Liquidity:** `;
  reasoning += `${quantData.metrics.volume.priceVolumeConfirmation}. `;
  reasoning += `Whale flow score: ${whaleFlow}/100, Liquidity: ${liquidityScore}/100. `;
  
  reasoning += `\n\n**Market Regime:** `;
  reasoning += `${quantData.marketRegime.toUpperCase()} market with ${quantData.confidence}% confidence. `;
  
  if (overheated) {
    reasoning += `⚠️ **Overheated:** RSI above 70 suggests potential pullback. `;
  }
  if (oversold) {
    reasoning += `📉 **Oversold:** RSI below 30 suggests potential bounce. `;
  }
  if (reversalRisk > 60) {
    reasoning += `🔄 **Reversal Risk:** ${reversalRisk}% probability of trend reversal. `;
  }
  if (continuationStrength > 70) {
    reasoning += `✅ **Trend Continuation:** ${continuationStrength}% probability of continuation. `;
  }
  if (isDip) {
    reasoning += `💧 **Dip Opportunity:** Current conditions suggest potential buying opportunity. `;
  }
  if (isFOMO) {
    reasoning += `🚀 **FOMO Conditions:** Strong momentum may indicate overextension. `;
  }
  
  reasoning += `\n\n**Sentiment Impact:** `;
  if (sentiment.score > 60) {
    reasoning += `Bullish sentiment (${sentiment.score}/100) supports upward movement. `;
  } else if (sentiment.score < 40) {
    reasoning += `Bearish sentiment (${sentiment.score}/100) may pressure prices. `;
  } else {
    reasoning += `Neutral sentiment (${sentiment.score}/100). `;
  }
  
  const decisionLogic = `The weighted signal combines:
- **80%** Quantitative Model: ${quantData.signal} (Composite Score: ${quantData.scores.compositeScore}/100)
- **10%** Sentiment Analysis: ${sentiment.score}/100
- **10%** GPT Interpretation: Based on scenario analysis

Final weighted value: ${finalSignal === 'BUY' ? '>0.67' : finalSignal === 'SELL' ? '<0.38' : '0.38-0.67'} → **${finalSignal}**`;

  return `## AI Market Analysis for ${symbol}

### ${signalEmoji} Final Signal: ${finalSignal}
### 📈 Composite Score: ${quantData.scores.compositeScore}%

### Reasoning
${reasoning}

### Quant Breakdown
• **Trend:** ${quantData.scores.trend}/100  
• **Momentum:** ${quantData.scores.momentum}/100  
• **Volatility:** ${quantData.scores.volatility}/100  
• **Volume:** ${quantData.scores.volume}/100  
• **Risk:** ${quantData.scores.risk}/100  
• **Liquidity:** ${liquidityScore}/100  
• **Whale Flow:** ${whaleFlow}/100  
• **Regime:** ${quantData.marketRegime.toUpperCase()}  

### Sentiment Summary
${sentiment.text}

### Decision Logic
${decisionLogic}

### Additional Context
• **Forecast Direction:** ${quantData.forecast?.direction} (${quantData.forecast?.probability}% probability)
• **Support:** $${quantData.forecast?.support?.toFixed(2)}
• **Resistance:** $${quantData.forecast?.resistance?.toFixed(2)}
• **Current Price:** $${currentPrice.toFixed(2)} | **Change:** ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
}

/**
 * Analyze multiple coins for market-wide queries
 */
async function analyzeTopCoins(limit: number = 50): Promise<Array<{
  symbol: string;
  quantData: QuantEngineOutput;
  whaleFlow: number;
  liquidityScore: number;
}>> {
  const coins = await getTop50Coins();
  const results: Array<{
    symbol: string;
    quantData: QuantEngineOutput;
    whaleFlow: number;
    liquidityScore: number;
  }> = [];
  
  // Analyze top coins (limit to avoid rate limits)
  const coinsToAnalyze = coins.slice(0, Math.min(limit, 50));
  
  for (const coin of coinsToAnalyze) {
    try {
      const klines = await fetchOHLCData(coin.symbol, '1d', 200);
      if (klines.length === 0) continue;
      
      const ohlc = klinesToOHLC(klines);
      const { closes, volumes } = extractPriceVolume(klines);
      
      const quantData = await runQuantEngine({
        symbol: coin.symbol,
        prices: closes,
        ohlc,
        volumes,
        interval: '1d',
        sentimentScore: 50 // Will be updated later if needed
      });
      
      const whaleFlow = deriveWhaleFlow(quantData);
      const liquidityScore = deriveLiquidityScore(quantData);
      
      results.push({
        symbol: coin.symbol,
        quantData,
        whaleFlow,
        liquidityScore
      });
    } catch (error) {
      console.error(`Error analyzing ${coin.symbol}:`, error);
      continue;
    }
  }
  
  return results;
}

/**
 * Generate market-wide response for general questions
 */
async function generateMarketWideResponse(userQuestion: string): Promise<string> {
  try {
    // Analyze top coins
    const analyses = await analyzeTopCoins(50);
    
    // Filter for bullish opportunities
    const bullishCoins = analyses
      .filter(a => 
        a.quantData.scores.trend > 60 &&
        a.quantData.scores.momentum > 60 &&
        a.quantData.scores.compositeScore > 65 &&
        a.quantData.marketRegime === 'bull' &&
        a.quantData.signal === 'BUY'
      )
      .sort((a, b) => b.quantData.scores.compositeScore - a.quantData.scores.compositeScore)
      .slice(0, 3);
    
    if (bullishCoins.length === 0) {
      // No strong bullish signals, provide market overview
      const avgComposite = analyses.reduce((sum, a) => sum + a.quantData.scores.compositeScore, 0) / analyses.length;
      const bullCount = analyses.filter(a => a.quantData.marketRegime === 'bull').length;
      const bearCount = analyses.filter(a => a.quantData.marketRegime === 'bear').length;
      
      return `## Market-Wide Analysis

### Current Market Overview
• **Average Composite Score:** ${avgComposite.toFixed(1)}/100
• **Bull Markets:** ${bullCount} coins
• **Bear Markets:** ${bearCount} coins
• **Sideways Markets:** ${analyses.length - bullCount - bearCount} coins

### Market Assessment
Based on analysis of top ${analyses.length} cryptocurrencies, the market is currently showing **${avgComposite > 55 ? 'moderate bullish' : avgComposite < 45 ? 'bearish' : 'neutral'}** conditions.

**No strong BUY signals** detected at this time. Consider:
- Waiting for clearer signals
- Focusing on coins with Composite Score > 65
- Monitoring for regime changes

### Top Opportunities (by Composite Score)
${analyses
  .sort((a, b) => b.quantData.scores.compositeScore - a.quantData.scores.compositeScore)
  .slice(0, 5)
  .map((a, i) => `${i + 1}. **${a.symbol}**: Score ${a.quantData.scores.compositeScore}/100, Signal: ${a.quantData.signal}, Regime: ${a.quantData.marketRegime.toUpperCase()}`)
  .join('\n')}`;
    }
    
    // Format bullish opportunities
    let response = `## Market-Wide Analysis: Bullish Opportunities\n\n`;
    response += `Found **${bullishCoins.length}** coins with strong BUY signals:\n\n`;
    
    for (const coin of bullishCoins) {
      const price = await fetchCurrentPrice(coin.symbol) || 0;
      response += `### 🟢 ${coin.symbol}\n`;
      response += `• **Composite Score:** ${coin.quantData.scores.compositeScore}/100\n`;
      response += `• **Trend:** ${coin.quantData.scores.trend}/100\n`;
      response += `• **Momentum:** ${coin.quantData.scores.momentum}/100\n`;
      response += `• **Whale Flow:** ${coin.whaleFlow}/100\n`;
      response += `• **Liquidity:** ${coin.liquidityScore}/100\n`;
      response += `• **Current Price:** $${price.toFixed(2)}\n`;
      response += `• **Reason:** Strong trend and momentum with bullish regime\n\n`;
    }
    
    return response;
  } catch (error) {
    console.error('Error generating market-wide response:', error);
    return 'Unable to generate market-wide analysis at this time. Please try asking about a specific coin.';
  }
}

/**
 * Main chat handler with full AI integration
 * Pipeline: Intent Detection → Symbol Extraction OR Market Mode → Fetch OHLC → Run Quant Engine → Fetch Sentiment → Compute Weighted Signal → GPT Formatting → Return
 */
export async function processAIChat(message: string): Promise<string> {
  // 1. Detect intent
  const intent = await detectIntent(message);
  
  // 2. Handle market-wide queries
  if (intent.isMarketWide || intent.intent === 'market') {
    return await generateMarketWideResponse(message);
  }
  
  // 3. Handle coin-specific queries
  if (!intent.symbol) {
    // No symbol found, but not market-wide - try to provide helpful response
    return await generateMarketWideResponse(message);
  }
  
  const symbol = intent.symbol;
  
  try {
    // 4. Fetch OHLC data (always fresh, no cache for analysis)
    const klines = await fetchOHLCData(symbol, '1d', 200);
    
    if (klines.length === 0) {
      return `Unable to fetch market data for ${symbol}. Please try another coin.`;
    }
    
    const ohlc = klinesToOHLC(klines);
    const { closes, volumes } = extractPriceVolume(klines);
    
    // 5. Run quant engine (always fresh)
    const quantResult = await runQuantEngine({
      symbol,
      prices: closes,
      ohlc,
      volumes,
      interval: '1d',
      sentimentScore: 50 // Will be updated with actual sentiment
    });
    
    // 6. Get current price and prepare market snapshot
    const currentPrice = await fetchCurrentPrice(symbol) || closes[closes.length - 1];
    const priceChange = quantResult.metrics.momentum.roc || 0;
    
    const marketSnapshot = `Symbol: ${symbol}
Current Price: $${currentPrice.toFixed(2)}
Price Change: ${priceChange.toFixed(2)}%
Composite Score: ${quantResult.scores.compositeScore}/100
Signal: ${quantResult.signal}
Market Regime: ${quantResult.marketRegime}
Trend: ${quantResult.scores.trend}/100
Momentum: ${quantResult.scores.momentum}/100
Risk: ${quantResult.scores.risk}/100
Volatility: ${quantResult.metrics.volatility.regime}
RSI: ${quantResult.metrics.momentum.rsi.toFixed(1)}`;
    
    // 7. Get sentiment analysis
    const sentiment = await getSentimentAnalysis(symbol, marketSnapshot);
    
    // 8. Re-run quant engine with actual sentiment
    const quantResultWithSentiment = await runQuantEngine({
      symbol,
      prices: closes,
      ohlc,
      volumes,
      interval: '1d',
      sentimentScore: sentiment.score
    });
    
    // 9. Get GPT interpretation score
    const gptInterpretation = await getGPTInterpretationScore(
      symbol,
      quantResultWithSentiment,
      sentiment.text,
      sentiment.score,
      message,
      intent.scenario
    );
    
    // 10. Compute weighted final signal
    const finalSignal = computeWeightedSignal(
      quantResultWithSentiment.signal,
      sentiment.score,
      gptInterpretation.score
    );
    
    // 11. Derive whale flow and liquidity scores
    const whaleFlow = deriveWhaleFlow(quantResultWithSentiment);
    const liquidityScore = deriveLiquidityScore(quantResultWithSentiment);
    
    // 12. Format comprehensive response
    return formatResponse(
      symbol,
      quantResultWithSentiment,
      sentiment,
      finalSignal,
      gptInterpretation.reasoning,
      whaleFlow,
      liquidityScore,
      currentPrice,
      priceChange
    );
    
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
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a cryptocurrency market analyst. Provide brief actionable insights (2-3 sentences) based on the current market regime.'
        },
        {
          role: 'user',
          content: `Current market regime: ${quantResult.marketRegime}
Volatility: ${quantResult.metrics.volatility.regime}
Trend Strength: ${quantResult.scores.trend}/100
Momentum: ${quantResult.scores.momentum}/100
Risk: ${quantResult.scores.risk}/100
Confidence: ${quantResult.confidence}%

Provide trading insights for this market condition.`
        }
      ],
      temperature: 0.5,
      max_tokens: 200,
    });
    
    const aiInsight = response.choices[0]?.message?.content || '';
    
    return `## Market Regime Analysis

**Regime:** ${quantResult.marketRegime.toUpperCase()}
**Volatility:** ${quantResult.metrics.volatility.regime}
**Trend Strength:** ${quantResult.scores.trend}/100
**Momentum:** ${quantResult.scores.momentum}/100
**Risk:** ${quantResult.scores.risk}/100
**Confidence:** ${quantResult.confidence}%

---

### AI Insight
${aiInsight}`;
    
  } catch (error) {
    console.error('Error in regime analysis:', error);
    return 'Unable to analyze market regime at this time.';
  }
}
