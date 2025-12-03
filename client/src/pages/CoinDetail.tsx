import { useParams, Link } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { AIChatWidget } from "@/components/dashboard/AIChatWidget";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { fetchCoin, fetchKlines, fetchQuantScore } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoinDetail() {
  const { symbol } = useParams();
  
  const { data: coinData, isLoading: coinLoading } = useQuery({
    queryKey: ['coin', symbol],
    queryFn: () => fetchCoin(symbol || 'BTC'),
    enabled: !!symbol,
  });

  const { data: klines, isLoading: klinesLoading } = useQuery({
    queryKey: ['klines', symbol],
    queryFn: () => fetchKlines(symbol || 'BTC', '1d', 100),
    enabled: !!symbol,
    refetchInterval: 60000,
  });

  const { data: quantScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['quant-score', symbol],
    queryFn: () => fetchQuantScore(symbol || 'BTC', '1d'),
    enabled: !!symbol,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (coinLoading || !coinData) {
    return (
      <div className="flex min-h-screen bg-background font-sans">
        <Sidebar />
        <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
          <Skeleton className="h-32 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  const price = coinData.market_data?.current_price?.usd || 0;
  const priceChange24h = coinData.market_data?.price_change_percentage_24h || 0;
  const marketCap = coinData.market_data?.market_cap?.usd || 0;
  const volume = coinData.market_data?.total_volume?.usd || 0;
  
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      
      <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <img 
                src={coinData.image?.large} 
                alt={coinData.name} 
                className="h-12 w-12 md:h-16 md:w-16 rounded-2xl border border-white/10 shadow-[0_0_30px_-10px_theme('colors.primary')]"
              />
              <div>
                <h1 className="text-xl md:text-3xl font-bold text-foreground tracking-tight flex flex-col md:flex-row md:items-center md:gap-3">
                  <span>{coinData.name}</span>
                  <span className="text-muted-foreground text-sm md:text-xl font-normal">{coinData.symbol?.toUpperCase()}</span>
                </h1>
                <div className="mt-1 flex items-center gap-4">
                   <Badge variant="outline" className="border-primary/20 text-primary bg-primary/10">
                     Rank #{coinData.market_cap_rank || 'N/A'}
                   </Badge>
                   {coinData.categories && coinData.categories[0] && (
                     <span className="text-sm text-muted-foreground">{coinData.categories[0]}</span>
                   )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-foreground">
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center justify-end gap-1 text-lg font-medium ${priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {priceChange24h >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                {Math.abs(priceChange24h).toFixed(2)}% (24h)
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex bg-card/50 rounded-lg p-1 border border-border">
                {['1H', '4H', '1D', '1W', '1M'].map((tf) => (
                  <button 
                    key={tf} 
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${tf === '1D' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-2 border-border bg-card/50">
                  <Activity className="h-3 w-3" /> Indicators
                </Button>
              </div>
            </div>
            
            {klinesLoading ? (
              <Skeleton className="h-[400px] w-full rounded-xl" />
            ) : (
              <PriceChart klines={klines || []} />
            )}
          </div>

          {/* Quant Stats Panel */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm">
              <h3 className="font-display text-lg font-medium text-foreground mb-4">Quant Signal</h3>
              
              {scoreLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : quantScore ? (
                <>
                  <div className="mb-6 flex flex-col items-center justify-center py-4 border-b border-white/5">
                    <div className={`text-4xl font-bold mb-1 ${
                      quantScore.signal === 'BUY' || quantScore.signal === 'Bullish' ? 'text-green-500' :
                      quantScore.signal === 'SELL' || quantScore.signal === 'Bearish' ? 'text-red-500' :
                      'text-yellow-500'
                    }`}>
                      {(quantScore.signal === 'BUY' ? 'BUY' : 
                        quantScore.signal === 'SELL' ? 'SELL' : 
                        quantScore.signal === 'HOLD' ? 'HOLD' :
                        quantScore.signal === 'Bullish' ? 'BULLISH' :
                        quantScore.signal === 'Bearish' ? 'BEARISH' :
                        'NEUTRAL').toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Confidence: <span className="text-foreground font-mono">{quantScore.confidence}%</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Composite Score</span>
                      <span className="font-mono font-bold text-lg">{quantScore.scores?.compositeScore || quantScore.score || 0}/100</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${quantScore.scores?.compositeScore || quantScore.score || 0}%` }} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Trend</span>
                        <span className="font-mono font-medium">{quantScore.scores?.trend || quantScore.factors?.trend || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${quantScore.scores?.trend || quantScore.factors?.trend || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Momentum</span>
                        <span className="font-mono font-medium">{quantScore.scores?.momentum || quantScore.factors?.momentum || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${quantScore.scores?.momentum || quantScore.factors?.momentum || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Volatility</span>
                        <span className="font-mono font-medium">{quantScore.scores?.volatility || quantScore.factors?.volatility || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${quantScore.scores?.volatility || quantScore.factors?.volatility || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Volume</span>
                        <span className="font-mono font-medium">{quantScore.scores?.volume || quantScore.factors?.volume || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${quantScore.scores?.volume || quantScore.factors?.volume || 0}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Risk</span>
                        <span className="font-mono font-medium">{quantScore.scores?.risk || 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${quantScore.scores?.risk || 0}%` }} />
                      </div>
                    </div>
                    {quantScore.scores?.sentiment !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Sentiment</span>
                          <span className="font-mono font-medium">{quantScore.scores.sentiment}/100</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${quantScore.scores.sentiment}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {quantScore.marketRegime && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-white/5">
                      <div className="text-xs text-muted-foreground mb-1">Market Regime</div>
                      <div className="font-bold text-sm uppercase">{quantScore.marketRegime}</div>
                    </div>
                  )}
                  
                  {quantScore.explanation && (
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-white/5">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <Zap className="h-3 w-3 inline mr-1 text-yellow-500" />
                        {quantScore.explanation}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Failed to load quant score</p>
              )}
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 gap-4">
               <div className="rounded-xl border border-border bg-card/50 p-4">
                 <div className="text-xs text-muted-foreground mb-1">Market Cap</div>
                 <div className="font-mono font-bold text-lg">${(marketCap / 1e9).toFixed(2)}B</div>
               </div>
               <div className="rounded-xl border border-border bg-card/50 p-4">
                 <div className="text-xs text-muted-foreground mb-1">Volume (24h)</div>
                 <div className="font-mono font-bold text-lg">${(volume / 1e9).toFixed(2)}B</div>
               </div>
               <div className="rounded-xl border border-border bg-card/50 p-4">
                 <div className="text-xs text-muted-foreground mb-1">Circulating</div>
                 <div className="font-mono font-bold text-lg">
                   {coinData.market_data?.circulating_supply ? 
                     (coinData.market_data.circulating_supply / 1e6).toFixed(2) + 'M' : 
                     'N/A'}
                 </div>
               </div>
               <div className="rounded-xl border border-border bg-card/50 p-4">
                 <div className="text-xs text-muted-foreground mb-1">Max Supply</div>
                 <div className="font-mono font-bold text-lg">
                   {coinData.market_data?.max_supply ? 
                     (coinData.market_data.max_supply / 1e6).toFixed(2) + 'M' : 
                     '∞'}
                 </div>
               </div>
            </div>
          </div>
        </div>

        <AIChatWidget />
      </main>
    </div>
  );
}
