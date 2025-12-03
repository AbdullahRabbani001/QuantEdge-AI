import { Sidebar } from "@/components/layout/Sidebar";
import { BrainCircuit, ArrowUpDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchQuantTop50 } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type SortField = 'symbol' | 'score' | 'signal' | 'confidence';
type SortDirection = 'asc' | 'desc';

export default function Strategies() {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch top 50 coins with quant analysis
  const { data: quantData, isLoading: marketsLoading, error, refetch } = useQuery({
    queryKey: ['quant-top50'],
    queryFn: () => fetchQuantTop50(50, '1d'),
    refetchInterval: 300000, // Refresh every 5 minutes
    retry: 2, // Retry failed requests twice
  });

  // Process quant data from unified endpoint
  const coinsWithScores = useMemo(() => {
    if (!quantData) {
      console.log('[Strategies] No quant data available');
      return [];
    }
    
    if (!Array.isArray(quantData)) {
      console.error('[Strategies] Quant data is not an array:', quantData);
      return [];
    }

    if (quantData.length === 0) {
      console.warn('[Strategies] Quant data array is empty');
      return [];
    }
    
    console.log(`[Strategies] Processing ${quantData.length} coins`);
    
    return quantData.map((item: any) => {
      // Determine signal directly from composite score to ensure consistency
      const compositeScore = item.scores?.compositeScore ?? item.score ?? 50;
      const signal = compositeScore >= 65 ? 'Bullish' : 
                     compositeScore <= 35 ? 'Bearish' : 'Neutral';
      
      return {
        id: item.symbol.toLowerCase(),
        symbol: item.symbol,
        name: item.symbol, // Will be enhanced with market data if needed
        current_price: item.currentPrice || 0,
        price_change_percentage_24h: item.metrics?.momentum?.roc || 0,
        quantScore: {
          score: compositeScore,
          signal: signal,
          confidence: item.confidence,
          factors: {
            trend: item.scores.trend,
            momentum: item.scores.momentum,
            volatility: item.scores.volatility,
            volume: item.scores.volume,
            risk: item.scores.risk,
            sentiment: item.scores.sentiment
          }
        },
        isLoadingScore: false,
        marketRegime: item.marketRegime
      };
    });
  }, [quantData]);

  // Filter and sort
  const filteredAndSortedCoins = useMemo(() => {
    let filtered = coinsWithScores;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((coin: any) => 
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    return filtered.sort((a: any, b: any) => {
      let aVal, bVal;

      switch (sortField) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'score':
          aVal = a.quantScore?.score ?? -1;
          bVal = b.quantScore?.score ?? -1;
          break;
        case 'signal':
          aVal = a.quantScore?.signal ?? 'zzz';
          bVal = b.quantScore?.signal ?? 'zzz';
          break;
        case 'confidence':
          aVal = a.quantScore?.confidence ?? -1;
          bVal = b.quantScore?.confidence ?? -1;
          break;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [coinsWithScores, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal === 'Bullish') return 'text-green-500';
    if (signal === 'Bearish') return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      
      <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
        <header className="mb-6 md:mb-8">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-2 md:gap-3">
              <BrainCircuit className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Quant Lab
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">Top 50 crypto assets with real-time quant analysis</p>
          </div>
          <div className="w-full md:w-64">
            <Input
              placeholder="Search coins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/50 border-border"
              data-testid="input-search-coins"
            />
          </div>
        </header>

        {/* Quant Scores Table */}
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
          {marketsLoading ? (
            <div className="p-8">
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('symbol')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                        data-testid="sort-symbol"
                      >
                        Symbol
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-right p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('score')}
                        className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                        data-testid="sort-score"
                      >
                        Score
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-left p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('signal')}
                        className="flex items-center gap-2 hover:text-foreground transition-colors"
                        data-testid="sort-signal"
                      >
                        Signal
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-right p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('confidence')}
                        className="flex items-center gap-2 ml-auto hover:text-foreground transition-colors"
                        data-testid="sort-confidence"
                      >
                        Confidence
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="text-right p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      Price
                    </th>
                    <th className="text-right p-4 font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      24h %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCoins.map((coin: any, index: number) => (
                    <tr
                      key={coin.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      data-testid={`row-coin-${coin.symbol}`}
                    >
                      <td className="p-4">
                        <span className="font-mono font-bold text-foreground">{coin.symbol.toUpperCase()}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-muted-foreground">{coin.name}</span>
                      </td>
                      <td className="p-4 text-right">
                        {coin.isLoadingScore ? (
                          <Skeleton className="h-5 w-12 ml-auto" />
                        ) : coin.quantScore ? (
                          <span className="font-mono font-bold text-lg text-foreground" data-testid={`score-${coin.symbol}`}>
                            {coin.quantScore.score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {coin.isLoadingScore ? (
                          <Skeleton className="h-5 w-20" />
                        ) : coin.quantScore ? (
                          <span className={`font-semibold ${getSignalColor(coin.quantScore.signal)}`} data-testid={`signal-${coin.symbol}`}>
                            {coin.quantScore.signal}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {coin.isLoadingScore ? (
                          <Skeleton className="h-5 w-12 ml-auto" />
                        ) : coin.quantScore ? (
                          <span className="text-muted-foreground font-mono" data-testid={`confidence-${coin.symbol}`}>
                            {coin.quantScore.confidence}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-foreground font-mono">
                          ${coin.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={coin.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                          {coin.price_change_percentage_24h?.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-border bg-card/50 p-12 text-center mt-8">
            <BrainCircuit className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-red-500 mb-2 font-semibold">Error loading quant data</p>
            <p className="text-muted-foreground text-sm mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        )}
        {filteredAndSortedCoins.length === 0 && !marketsLoading && !error && (
          <div className="rounded-xl border border-border bg-card/50 p-12 text-center mt-8">
            <BrainCircuit className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchQuery ? `No coins found matching "${searchQuery}"` : 'No quant data available yet.'}
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery ? 'Try a different search term.' : 'The analysis may still be processing. This can take a minute for 50 coins.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
