// API client utilities

const API_BASE = '/api';

export async function fetchMarkets(limit: number = 50) {
  const response = await fetch(`${API_BASE}/markets?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch markets');
  return response.json();
}

export async function fetchCoin(symbol: string) {
  const response = await fetch(`${API_BASE}/coin/${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch coin');
  return response.json();
}

export async function fetchKlines(symbol: string, interval: string = '1d', limit: number = 100) {
  const response = await fetch(`${API_BASE}/klines/${symbol}?interval=${interval}&limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch klines');
  return response.json();
}

export async function fetchQuantScore(symbol: string, interval: string = '1d') {
  const response = await fetch(`${API_BASE}/quant/${symbol}?interval=${interval}`);
  if (!response.ok) throw new Error('Failed to fetch quant score');
  return response.json();
}

export async function fetchQuantTop50(limit: number = 50, interval: string = '1d') {
  const response = await fetch(`${API_BASE}/quant/top50?limit=${limit}&interval=${interval}`);
  if (!response.ok) throw new Error('Failed to fetch top 50 quant scores');
  return response.json();
}

export async function fetchQuantSignal(symbol: string, interval: string = '1d') {
  const response = await fetch(`${API_BASE}/quant/signal/${symbol}?interval=${interval}`);
  if (!response.ok) throw new Error('Failed to fetch quant signal');
  return response.json();
}

export async function fetchMarketRegime() {
  const response = await fetch(`${API_BASE}/regime`);
  if (!response.ok) throw new Error('Failed to fetch market regime');
  return response.json();
}

export async function fetchQuantSignals(limit: number = 10) {
  const response = await fetch(`${API_BASE}/quant/signals?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch quant signals');
  return response.json();
}

export async function fetchPortfolio() {
  const response = await fetch(`${API_BASE}/portfolio`);
  if (!response.ok) throw new Error('Failed to fetch portfolio');
  return response.json();
}

export async function addTrade(trade: {
  portfolioId: number;
  symbol: string;
  quantity: string;
  buyPrice: string;
  subtotal?: string;
  tax?: string;
  totalCost?: string;
  side: string;
  date: Date;
}) {
  const response = await fetch(`${API_BASE}/portfolio/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trade),
  });
  if (!response.ok) throw new Error('Failed to add trade');
  return response.json();
}

export async function deleteTrade(id: number) {
  const response = await fetch(`${API_BASE}/portfolio/trade/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete trade');
  return response.json();
}

export async function sendChatMessage(message: string) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error('Failed to send chat message');
  return response.json();
}
