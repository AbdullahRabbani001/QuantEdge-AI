import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PortfolioItem } from "@/lib/mockData";

const COLORS = ['hsl(190, 100%, 50%)', 'hsl(262, 83%, 58%)', 'hsl(142, 70%, 50%)', 'hsl(47, 95%, 50%)'];

interface PortfolioSnapshotProps {
  portfolio: PortfolioItem[];
}

export function PortfolioSnapshot({ portfolio }: PortfolioSnapshotProps) {
  const totalValue = portfolio.reduce((acc, item) => acc + (item.amount * item.currentPrice), 0);
  const data = portfolio.map(item => ({
    name: item.symbol,
    value: item.amount * item.currentPrice
  }));

  return (
    <Card className="h-full bg-card/50 border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="font-display text-lg font-medium">Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1 pl-6 space-y-4">
             <div>
               <p className="text-sm text-muted-foreground">Total Value</p>
               <h2 className="font-mono text-2xl font-bold tracking-tight text-foreground">
                 ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </h2>
             </div>
             <div className="space-y-2">
                {data.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono font-medium">
                      {((item.value / totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
