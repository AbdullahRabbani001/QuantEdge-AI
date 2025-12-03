import { Sidebar } from "@/components/layout/Sidebar";
import { Link } from "wouter";
import { ArrowUpRight, ArrowDownRight, Search, Bell, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchMarkets } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Markets() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => fetchMarkets(50),
    refetchInterval: 60000,
  });

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      
      <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
        <header className="mb-6 md:mb-8">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Markets</h1>
            <p className="text-sm md:text-base text-muted-foreground">Real-time cryptocurrency market data</p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search assets..." 
                className="pl-10 bg-card/50 border-border" 
              />
            </div>
            <Button size="icon" variant="outline" className="bg-card/50 border-border shrink-0">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Asset</th>
                  <th className="px-6 py-4 font-medium text-right">Price</th>
                  <th className="px-6 py-4 font-medium text-right">24h Change</th>
                  <th className="px-6 py-4 font-medium text-right">Market Cap</th>
                  <th className="px-6 py-4 font-medium text-right">Volume (24h)</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {markets && markets.map((coin: any) => (
                  <tr key={coin.id} className="group hover:bg-white/5 transition-colors" data-testid={`row-coin-${coin.symbol}`}>
                    <td className="px-6 py-4 text-muted-foreground">
                      #{coin.market_cap_rank}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={coin.image} alt={coin.name} className="h-10 w-10 rounded-full" />
                        <div>
                          <div className="font-bold text-foreground">{coin.name}</div>
                          <div className="text-xs text-muted-foreground">{coin.symbol.toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-foreground font-medium">
                      ${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`flex items-center justify-end gap-1 font-bold ${coin.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {coin.price_change_percentage_24h >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        <span className="font-mono">{Math.abs(coin.price_change_percentage_24h).toFixed(2)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      ${(coin.market_cap / 1e9).toFixed(2)}B
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      ${(coin.total_volume / 1e9).toFixed(2)}B
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/coin/${coin.symbol.toUpperCase()}`}>
                        <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80" data-testid={`button-view-${coin.symbol}`}>
                          View <TrendingUp className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
