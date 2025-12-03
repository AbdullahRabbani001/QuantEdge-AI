import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";

interface MarketRegimeWidgetProps {
  regime: string;
  volatility: string;
  trendStrength: number;
  explanation: string;
}

export function MarketRegimeWidget({ regime, volatility, trendStrength, explanation }: MarketRegimeWidgetProps) {
  const isBull = regime === "Bull";
  const isBear = regime === "Bear";
  
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 p-6 backdrop-blur-sm">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-medium text-foreground">Market Regime</h3>
        <span className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
          isBull ? "bg-green-500/20 text-green-500" : isBear ? "bg-red-500/20 text-red-500" : "bg-yellow-500/20 text-yellow-500"
        )}>
          {isBull ? <TrendingUp className="h-3 w-3" /> : isBear ? <TrendingDown className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
          {regime}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Volatility</p>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="font-mono font-medium">{volatility}</span>
          </div>
        </div>
        <div className="space-y-1 col-span-2">
          <p className="text-xs text-muted-foreground">Trend Strength</p>
          <div className="flex items-center gap-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className="h-full rounded-full bg-primary shadow-[0_0_10px_theme('colors.primary')]" 
                style={{ width: `${trendStrength}%` }}
              />
            </div>
            <span className="font-mono text-sm font-medium">{trendStrength}/100</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 p-3 border border-white/5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {explanation}
        </p>
      </div>
    </div>
  );
}
