import { Sidebar } from "@/components/layout/Sidebar";
import { MarketRegimeWidget } from "@/components/dashboard/MarketRegimeWidget";
import { PortfolioSnapshot } from "@/components/dashboard/PortfolioSnapshot";
import { AIChatWidget } from "@/components/dashboard/AIChatWidget";
import { RecentSignals } from "@/components/dashboard/RecentSignals";
import { ArrowUpRight, ArrowDownRight, Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchMarkets, fetchMarketRegime, fetchPortfolio } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: markets, isLoading: marketsLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => fetchMarkets(50),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: regime, isLoading: regimeLoading } = useQuery({
    queryKey: ['regime'],
    queryFn: fetchMarketRegime,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: portfolio, isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 60000,
  });

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      
      <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
        {/* Top Bar */}
        <header className="mb-6 md:mb-8">
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Welcome back, Quant Architect.</p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative flex-1 md:flex-initial md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search assets..." 
                className="pl-10 bg-card/50 border-border focus-visible:ring-primary/50 transition-all hover:bg-card" 
              />
            </div>
            <Button size="icon" variant="outline" className="bg-card/50 border-border hover:bg-card text-muted-foreground shrink-0">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-primary to-accent ring-2 ring-background shadow-lg shadow-primary/20" />
          </div>
        </header>

        {/* Grid Layout */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mb-6 md:mb-8">
          {/* Market Regime */}
          <div className="lg:col-span-2">
            {regimeLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : regime ? (
              <MarketRegimeWidget {...regime} />
            ) : (
              <div className="rounded-xl border border-border bg-card/50 p-6">
                <p className="text-muted-foreground">Failed to load regime data</p>
              </div>
            )}
          </div>

          {/* Portfolio Snapshot */}
          <div className="lg:col-span-1">
            {portfolioLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : portfolio && portfolio.holdings && portfolio.holdings.length > 0 ? (
              <PortfolioSnapshot portfolio={portfolio.holdings.map((h: any) => ({
                symbol: h.symbol,
                amount: h.quantity,
                avgEntry: h.avgEntry,
                currentPrice: h.currentPrice,
              }))} />
            ) : (
              <div className="rounded-xl border border-border bg-card/50 p-6 h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">No holdings yet</p>
                  <Button size="sm">Add First Trade</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Market Overview - Spans 2 cols */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm h-fit">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground font-display">Market Overview</h2>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
            </div>
            {marketsLoading ? (
              <div className="p-6 space-y-4">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Asset</th>
                    <th className="px-6 py-3 font-medium text-right">Price</th>
                    <th className="px-6 py-3 font-medium text-right">24h Change</th>
                    <th className="px-6 py-3 font-medium text-right">Market Cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {markets && markets.map((coin: any) => (
                    <tr key={coin.id} className="group hover:bg-white/5 transition-colors cursor-pointer relative">
                      <td className="px-6 py-4">
                        <Link href={`/coin/${coin.symbol.toUpperCase()}`} className="absolute inset-0 z-10" />
                        <div className="flex items-center gap-3">
                          <img src={coin.image} alt={coin.name} className="h-8 w-8 rounded-full" />
                          <div>
                            <div className="font-bold text-foreground">{coin.name}</div>
                            <div className="text-xs text-muted-foreground">{coin.symbol.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-foreground">
                        ${coin.current_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`flex items-center justify-end gap-1 ${coin.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {coin.price_change_percentage_24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          <span className="font-mono font-bold">{Math.abs(coin.price_change_percentage_24h).toFixed(2)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                        ${(coin.market_cap / 1e9).toFixed(2)}B
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Signals - Spans 1 col */}
          <div className="lg:col-span-1">
            <RecentSignals />
          </div>
        </div>

        <AIChatWidget />
      </main>
    </div>
  );
}
