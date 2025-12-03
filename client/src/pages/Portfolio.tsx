import { Sidebar } from "@/components/layout/Sidebar";
import { useState, useRef } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign, PieChart, TrendingDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, addTrade, deleteTrade } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function Portfolio() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
  });
  const [sellFormData, setSellFormData] = useState({
    quantity: '',
  });
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [symbolForPrice, setSymbolForPrice] = useState<string>('');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const latestSymbolRef = useRef<string>('');
  
  const [sellLivePrice, setSellLivePrice] = useState<number | null>(null);
  const [isSellLoadingPrice, setIsSellLoadingPrice] = useState(false);
  const [sellPriceError, setSellPriceError] = useState<string | null>(null);
  const [deletingTradeId, setDeletingTradeId] = useState<number | null>(null);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 1000, // Refresh every 1 second for live price/PnL updates
  });

  const addTradeMutation = useMutation({
    mutationFn: addTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setIsAddOpen(false);
      setFormData({ symbol: '', quantity: '' });
      setLivePrice(null);
      setSymbolForPrice('');
      setPriceError(null);
    },
  });

  const deleteTradeMutation = useMutation({
    mutationFn: deleteTrade,
    onMutate: (tradeId: number) => {
      setDeletingTradeId(tradeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      setDeletingTradeId(null);
    },
    onError: () => {
      setDeletingTradeId(null);
    },
  });

  const handleSymbolBlur = async () => {
    const requestedSymbol = formData.symbol.toUpperCase();
    latestSymbolRef.current = requestedSymbol;
    
    if (requestedSymbol.length >= 2) {
      setIsLoadingPrice(true);
      setPriceError(null);
      try {
        const res = await fetch(`/api/price/${requestedSymbol}`);
        const data = await res.json();
        
        // Only update state if symbol hasn't changed (prevent race conditions)
        if (latestSymbolRef.current === requestedSymbol) {
          if (res.ok) {
            setLivePrice(data.price);
            setSymbolForPrice(requestedSymbol);
          } else {
            setLivePrice(null);
            setSymbolForPrice('');
            setPriceError(data.error || 'Coin not found');
          }
        }
      } catch (error) {
        // Only update state if symbol hasn't changed
        if (latestSymbolRef.current === requestedSymbol) {
          setLivePrice(null);
          setSymbolForPrice('');
          setPriceError('Failed to fetch price');
        }
      } finally {
        if (latestSymbolRef.current === requestedSymbol) {
          setIsLoadingPrice(false);
        }
      }
    } else {
      setLivePrice(null);
      setSymbolForPrice('');
      setPriceError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentSymbol = formData.symbol.toUpperCase();
    
    if (!livePrice || !formData.quantity || !portfolio?.portfolio?.id) {
      return;
    }

    // Verify that the price is for the current symbol (prevent stale prices)
    if (symbolForPrice !== currentSymbol) {
      setPriceError(`Please fetch price for ${currentSymbol} before submitting`);
      return;
    }

    const quantity = parseFloat(formData.quantity);
    
    if (isNaN(quantity) || quantity <= 0) {
      setPriceError('Please enter a valid quantity greater than 0');
      return;
    }
    
    const subtotal = quantity * livePrice;
    const tax = subtotal * 0.001; // 0.1% tax
    const totalCost = subtotal + tax;

    addTradeMutation.mutate({
      portfolioId: portfolio.portfolio.id,
      symbol: currentSymbol,
      quantity: formData.quantity,
      buyPrice: livePrice.toString(),
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      totalCost: totalCost.toString(),
      side: 'buy',
      date: new Date(),
    });
  };
  
  const openSellModal = async (holding: any) => {
    setSelectedHolding(holding);
    setSellFormData({ quantity: '' });
    setIsSellOpen(true);
    
    // Auto-fetch current sell price
    setIsSellLoadingPrice(true);
    setSellPriceError(null);
    try {
      const res = await fetch(`/api/price/${holding.symbol}`);
      const data = await res.json();
      if (res.ok) {
        setSellLivePrice(data.price);
      } else {
        setSellLivePrice(null);
        setSellPriceError(data.error || 'Failed to fetch price');
      }
    } catch (error) {
      setSellLivePrice(null);
      setSellPriceError('Failed to fetch price');
    } finally {
      setIsSellLoadingPrice(false);
    }
  };
  
  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sellLivePrice || !sellFormData.quantity || !portfolio?.portfolio?.id || !selectedHolding) {
      return;
    }
    
    const quantity = parseFloat(sellFormData.quantity);
    
    if (isNaN(quantity) || quantity <= 0) {
      setSellPriceError('Please enter a valid quantity greater than 0');
      return;
    }
    
    if (quantity > selectedHolding.quantity) {
      setSellPriceError(`Cannot sell more than ${selectedHolding.quantity} ${selectedHolding.symbol}`);
      return;
    }
    
    const subtotal = quantity * sellLivePrice;
    const tax = subtotal * 0.001; // 0.1% tax
    const totalValue = subtotal - tax; // Sell receives money minus tax

    addTradeMutation.mutate({
      portfolioId: portfolio.portfolio.id,
      symbol: selectedHolding.symbol,
      quantity: sellFormData.quantity,
      buyPrice: sellLivePrice.toString(), // Using buyPrice field for sell price
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      totalCost: totalValue.toString(),
      side: 'sell',
      date: new Date(),
    });
    
    setIsSellOpen(false);
    setSellFormData({ quantity: '' });
    setSelectedHolding(null);
    setSellLivePrice(null);
  };

  const totalValue = portfolio?.totalValue || 0;
  const realizedPnl = portfolio?.realizedPnl || 0;
  const unrealizedPnl = portfolio?.unrealizedPnl || 0;
  const totalPnl = portfolio?.totalPnl || 0;
  const holdings = portfolio?.holdings || [];
  const trades = portfolio?.trades || [];

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      
      <main className="flex-1 pt-16 md:pt-0 md:ml-64 p-4 md:p-8">
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Portfolio</h1>
            <p className="text-sm md:text-base text-muted-foreground">Track your crypto holdings and performance</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-trade">
                  <Plus className="mr-2 h-4 w-4" /> Add Trade
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card border-border w-[90%] md:w-full max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Trade</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="BTC, ETH, SOL..."
                    value={formData.symbol}
                    onChange={(e) => {
                      const newSymbol = e.target.value.toUpperCase();
                      setFormData({ ...formData, symbol: e.target.value });
                      latestSymbolRef.current = newSymbol;
                      setLivePrice(null);
                      setSymbolForPrice('');
                      setPriceError(null);
                    }}
                    onBlur={handleSymbolBlur}
                    className="bg-muted/50 border-border"
                    data-testid="input-symbol"
                  />
                  {isLoadingPrice && (
                    <p className="text-xs text-muted-foreground mt-1">Fetching price...</p>
                  )}
                  {livePrice && symbolForPrice && (
                    <p className="text-xs text-primary mt-1">✓ Live Price for {symbolForPrice}: ${livePrice.toLocaleString()}</p>
                  )}
                  {priceError && (
                    <p className="text-xs text-destructive mt-1">⚠ {priceError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.00000001"
                    placeholder="0.5"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="bg-muted/50 border-border"
                    data-testid="input-quantity"
                  />
                </div>
                
                {livePrice && formData.quantity && (
                  <div className="rounded-lg bg-muted/30 p-4 space-y-2 border border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">${(parseFloat(formData.quantity) * livePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (0.1%):</span>
                      <span className="font-mono">${((parseFloat(formData.quantity) * livePrice) * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                      <span className="text-foreground">Total Cost:</span>
                      <span className="font-mono text-primary">${((parseFloat(formData.quantity) * livePrice) * 1.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!livePrice || !formData.quantity || addTradeMutation.isPending}
                  data-testid="button-submit-trade"
                >
                  {addTradeMutation.isPending ? 'Adding...' : 'Add Trade'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isSellOpen} onOpenChange={setIsSellOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                disabled={holdings.length === 0}
                data-testid="button-sell-trade"
              >
                <TrendingDownIcon className="mr-2 h-4 w-4" /> Sell Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border w-[90%] md:w-full max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Sell Trade</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSellSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="select-holding">Select Asset to Sell</Label>
                  <Select
                    value={selectedHolding?.symbol || ''}
                    onValueChange={(value) => {
                      const holding = holdings.find((h: any) => h.symbol === value);
                      if (holding) {
                        openSellModal(holding);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-muted/50 border-border" data-testid="select-holding">
                      <SelectValue placeholder="Choose an asset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {holdings.map((holding: any) => (
                        <SelectItem key={holding.symbol} value={holding.symbol}>
                          {holding.symbol} ({holding.quantity.toFixed(8)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedHolding && (
                  <>
                    <div className="rounded-lg bg-muted/30 p-4 border border-border">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Available:</span>
                        <span className="font-mono font-bold">{selectedHolding.quantity.toFixed(8)} {selectedHolding.symbol}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Entry:</span>
                        <span className="font-mono">${selectedHolding.avgEntry.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="sell-quantity-header">Quantity to Sell</Label>
                      <Input
                        id="sell-quantity-header"
                        type="number"
                        step="0.00000001"
                        placeholder="0.5"
                        value={sellFormData.quantity}
                        onChange={(e) => setSellFormData({ quantity: e.target.value })}
                        className="bg-muted/50 border-border"
                        data-testid="input-sell-quantity"
                        max={selectedHolding.quantity}
                      />
                    </div>
                    
                    <div className="rounded-lg bg-muted/30 p-4 border border-border">
                      {isSellLoadingPrice && (
                        <p className="text-xs text-muted-foreground">Fetching current price...</p>
                      )}
                      {sellLivePrice && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Current Sell Price:</span>
                            <span className="font-mono text-primary">${sellLivePrice.toLocaleString()}</span>
                          </div>
                          {sellFormData.quantity && (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="font-mono">${(parseFloat(sellFormData.quantity) * sellLivePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax (0.1%):</span>
                                <span className="font-mono text-red-500">-${((parseFloat(sellFormData.quantity) * sellLivePrice) * 0.001).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                                <span className="text-foreground">You Receive:</span>
                                <span className="font-mono text-green-500">${((parseFloat(sellFormData.quantity) * sellLivePrice) * 0.999).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between text-sm pt-2 border-t border-border">
                                <span className="text-muted-foreground">Est. Realized PnL:</span>
                                <span className={`font-mono font-bold ${(sellLivePrice - selectedHolding.avgEntry) * parseFloat(sellFormData.quantity) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                  {(sellLivePrice - selectedHolding.avgEntry) * parseFloat(sellFormData.quantity) >= 0 ? '+' : ''}${((sellLivePrice - selectedHolding.avgEntry) * parseFloat(sellFormData.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {sellPriceError && (
                        <p className="text-xs text-destructive">⚠ {sellPriceError}</p>
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-red-500 hover:bg-red-600 text-white" 
                      disabled={!sellLivePrice || !sellFormData.quantity || addTradeMutation.isPending}
                      data-testid="button-submit-sell"
                    >
                      {addTradeMutation.isPending ? 'Selling...' : 'Confirm Sell'}
                    </Button>
                  </>
                )}
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </header>

        {/* Portfolio Summary */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-5 mb-6 md:mb-8">
          <div className="rounded-xl border border-border bg-card/50 p-4 md:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-muted-foreground">Total Value</span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold font-mono text-foreground" data-testid="text-total-value">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-card/50 p-4 md:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-muted-foreground">Realized PnL</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className={`text-xl md:text-2xl lg:text-3xl font-bold font-mono ${realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-realized-pnl">
              {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-card/50 p-4 md:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-muted-foreground">Unrealized PnL</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={`text-xl md:text-2xl lg:text-3xl font-bold font-mono ${unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-unrealized-pnl">
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-card/50 p-4 md:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-muted-foreground">Total PnL</span>
              {totalPnl >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <div className={`text-xl md:text-2xl lg:text-3xl font-bold font-mono ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-total-pnl">
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="rounded-xl border border-border bg-card/50 p-4 md:p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-muted-foreground">Holdings</span>
              <PieChart className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl md:text-2xl lg:text-3xl font-bold font-mono text-foreground" data-testid="text-holdings-count">
              {holdings.length}
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Current Holdings</h2>
          </div>
          
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : holdings.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Asset</th>
                  <th className="px-6 py-3 font-medium text-right">Quantity</th>
                  <th className="px-6 py-3 font-medium text-right">Avg Entry</th>
                  <th className="px-6 py-3 font-medium text-right">Current Price</th>
                  <th className="px-6 py-3 font-medium text-right">Value</th>
                  <th className="px-6 py-3 font-medium text-right">P&L</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((holding: any) => (
                  <tr key={holding.symbol} className="hover:bg-white/5" data-testid={`row-holding-${holding.symbol}`}>
                    <td className="px-6 py-4 font-bold text-foreground">{holding.symbol}</td>
                    <td className="px-6 py-4 text-right font-mono">{holding.quantity.toFixed(8)}</td>
                    <td className="px-6 py-4 text-right font-mono">${holding.avgEntry.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono">${holding.currentPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold">${holding.value.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono font-bold ${holding.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSellModal(holding)}
                        className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                        data-testid={`button-sell-${holding.symbol}`}
                      >
                        Sell
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No holdings yet</p>
              <Button onClick={() => setIsAddOpen(true)}>Add Your First Trade</Button>
            </div>
          )}
        </div>

        {/* Trade History */}
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Trade History</h2>
          </div>
          
          {trades.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium">Side</th>
                  <th className="px-6 py-3 font-medium text-right">Quantity</th>
                  <th className="px-6 py-3 font-medium text-right">Price</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trades.map((trade: any) => (
                  <tr key={trade.id} className="hover:bg-white/5" data-testid={`row-trade-${trade.id}`}>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(trade.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold">{trade.symbol}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${trade.side === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">{trade.quantity}</td>
                    <td className="px-6 py-4 text-right font-mono">${trade.buyPrice}</td>
                    <td className="px-6 py-4 text-right relative z-10">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 cursor-pointer active:bg-destructive/20 relative z-20"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (deletingTradeId === null) {
                            deleteTradeMutation.mutate(trade.id);
                          }
                        }}
                        disabled={deletingTradeId !== null}
                        data-testid={`button-delete-${trade.id}`}
                      >
                        {deletingTradeId === trade.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No trades recorded</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
