import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchQuantSignals } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const getSignalColor = (signal: string) => {
  if (signal === 'BUY' || signal === 'Bullish') return 'text-green-500';
  if (signal === 'SELL' || signal === 'Bearish') return 'text-red-500';
  return 'text-yellow-500';
};

export function RecentSignals() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['quant-signals'],
    queryFn: () => fetchQuantSignals(50),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  return (
    <div className="rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-foreground">Live Quant Signals</h3>
        <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
          View All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </>
        ) : signals && signals.length > 0 ? (
          signals.map((signal: any) => {
            const color = getSignalColor(signal.signal);
            return (
              <div key={signal.id} className="group flex items-center justify-between rounded-lg border border-white/5 bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 font-bold text-xs ${color}`}>
                    {signal.symbol[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{signal.symbol}</span>
                      <span className={`text-xs font-medium ${color} uppercase`}>
                        {signal.signal === 'BUY' ? 'BUY' : 
                         signal.signal === 'SELL' ? 'SELL' : 
                         signal.signal === 'HOLD' ? 'HOLD' :
                         signal.signal === 'Bullish' ? 'BULLISH' :
                         signal.signal === 'Bearish' ? 'BEARISH' :
                         'NEUTRAL'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">Score: {signal.score}/100</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-foreground">{signal.confidence}%</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No signals available yet
          </div>
        )}
      </div>
    </div>
  );
}
