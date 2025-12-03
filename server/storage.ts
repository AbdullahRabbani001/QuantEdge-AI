import { 
  users, 
  portfolios, 
  trades, 
  quantSignals, 
  chatLogs, 
  regimeLogs,
  realizedPnlLogs,
  type User, 
  type UpsertUser,
  type Portfolio,
  type InsertPortfolio,
  type Trade,
  type InsertTrade,
  type QuantSignal,
  type InsertQuantSignal,
  type ChatLog,
  type InsertChatLog,
  type RegimeLog,
  type InsertRegimeLog,
  type RealizedPnlLog,
  type InsertRealizedPnlLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Portfolios
  getPortfoliosByUserId(userId: string): Promise<Portfolio[]>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  
  // Trades
  getTradesByPortfolioId(portfolioId: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, trade: Partial<InsertTrade>): Promise<Trade | undefined>;
  deleteTrade(id: number): Promise<void>;
  
  // Quant Signals
  getLatestQuantSignal(symbol: string): Promise<QuantSignal | undefined>;
  getRecentQuantSignals(limit: number): Promise<QuantSignal[]>;
  createQuantSignal(signal: InsertQuantSignal): Promise<QuantSignal>;
  
  // Chat Logs
  getChatLogsByUserId(userId: string, limit?: number): Promise<ChatLog[]>;
  createChatLog(log: InsertChatLog): Promise<ChatLog>;
  
  // Regime Logs
  getLatestRegimeLog(): Promise<RegimeLog | undefined>;
  createRegimeLog(log: InsertRegimeLog): Promise<RegimeLog>;
  
  // Realized PnL Logs
  getRealizedPnlLogsByPortfolioId(portfolioId: number): Promise<RealizedPnlLog[]>;
  createRealizedPnlLog(log: InsertRealizedPnlLog): Promise<RealizedPnlLog>;
  deleteRealizedPnlLogByTradeId(tradeId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
  
  // Portfolios
  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    return await db.select().from(portfolios).where(eq(portfolios.userId, userId));
  }
  
  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const [newPortfolio] = await db.insert(portfolios).values(portfolio).returning();
    return newPortfolio;
  }
  
  // Trades
  async getTradesByPortfolioId(portfolioId: number): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.portfolioId, portfolioId)).orderBy(desc(trades.date));
  }
  
  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }
  
  async updateTrade(id: number, tradeUpdate: Partial<InsertTrade>): Promise<Trade | undefined> {
    const [updated] = await db.update(trades).set(tradeUpdate).where(eq(trades.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteTrade(id: number): Promise<void> {
    await db.delete(trades).where(eq(trades.id, id));
  }
  
  // Quant Signals
  async getLatestQuantSignal(symbol: string): Promise<QuantSignal | undefined> {
    const [signal] = await db.select().from(quantSignals).where(eq(quantSignals.symbol, symbol)).orderBy(desc(quantSignals.createdAt)).limit(1);
    return signal || undefined;
  }
  
  async getRecentQuantSignals(limit: number): Promise<QuantSignal[]> {
    return await db.select().from(quantSignals).orderBy(desc(quantSignals.createdAt)).limit(limit);
  }
  
  async createQuantSignal(signal: InsertQuantSignal): Promise<QuantSignal> {
    const [newSignal] = await db.insert(quantSignals).values(signal).returning();
    return newSignal;
  }
  
  // Chat Logs
  async getChatLogsByUserId(userId: string, limit: number = 50): Promise<ChatLog[]> {
    return await db.select().from(chatLogs).where(eq(chatLogs.userId, userId)).orderBy(desc(chatLogs.createdAt)).limit(limit);
  }
  
  async createChatLog(log: InsertChatLog): Promise<ChatLog> {
    const [newLog] = await db.insert(chatLogs).values(log).returning();
    return newLog;
  }
  
  // Regime Logs
  async getLatestRegimeLog(): Promise<RegimeLog | undefined> {
    const [log] = await db.select().from(regimeLogs).orderBy(desc(regimeLogs.createdAt)).limit(1);
    return log || undefined;
  }
  
  async createRegimeLog(log: InsertRegimeLog): Promise<RegimeLog> {
    const [newLog] = await db.insert(regimeLogs).values(log).returning();
    return newLog;
  }
  
  // Realized PnL Logs
  async getRealizedPnlLogsByPortfolioId(portfolioId: number): Promise<RealizedPnlLog[]> {
    return await db.select().from(realizedPnlLogs).where(eq(realizedPnlLogs.portfolioId, portfolioId)).orderBy(desc(realizedPnlLogs.createdAt));
  }
  
  async createRealizedPnlLog(log: InsertRealizedPnlLog): Promise<RealizedPnlLog> {
    const [newLog] = await db.insert(realizedPnlLogs).values(log).returning();
    return newLog;
  }

  async deleteRealizedPnlLogByTradeId(tradeId: number): Promise<void> {
    await db.delete(realizedPnlLogs).where(eq(realizedPnlLogs.tradeId, tradeId));
  }
}

/**
 * In-memory mock storage for local development (no DB required)
 */
export class MockStorage implements IStorage {
  private users = new Map<string, User>();
  private portfolios = new Map<number, Portfolio>();
  private trades = new Map<number, Trade>();
  private quantSignals: QuantSignal[] = [];
  private chatLogs: ChatLog[] = [];
  private regimeLogs: RegimeLog[] = [];
  private realizedPnlLogs: RealizedPnlLog[] = [];
  private nextPortfolioId = 1;
  private nextTradeId = 1;

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      ...userData,
      createdAt: this.users.has(userData.id) ? this.users.get(userData.id)!.createdAt : new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id, user);
    return user;
  }

  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values()).filter(p => p.userId === userId);
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const id = this.nextPortfolioId++;
    const newPortfolio: Portfolio = {
      ...portfolio,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.portfolios.set(id, newPortfolio);
    return newPortfolio;
  }

  async getTradesByPortfolioId(portfolioId: number): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(t => t.portfolioId === portfolioId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = this.nextTradeId++;
    const newTrade: Trade = {
      ...trade,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async updateTrade(id: number, tradeUpdate: Partial<InsertTrade>): Promise<Trade | undefined> {
    const trade = this.trades.get(id);
    if (!trade) return undefined;
    const updated: Trade = { ...trade, ...tradeUpdate, updatedAt: new Date() };
    this.trades.set(id, updated);
    return updated;
  }

  async deleteTrade(id: number): Promise<void> {
    this.trades.delete(id);
  }

  async getLatestQuantSignal(symbol: string): Promise<QuantSignal | undefined> {
    return this.quantSignals.filter(s => s.symbol === symbol).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async getRecentQuantSignals(limit: number): Promise<QuantSignal[]> {
    return this.quantSignals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async createQuantSignal(signal: InsertQuantSignal): Promise<QuantSignal> {
    const newSignal: QuantSignal = { ...signal, createdAt: new Date() };
    this.quantSignals.push(newSignal);
    return newSignal;
  }

  async getChatLogsByUserId(userId: string, limit: number = 50): Promise<ChatLog[]> {
    return this.chatLogs
      .filter(log => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createChatLog(log: InsertChatLog): Promise<ChatLog> {
    const newLog: ChatLog = { ...log, createdAt: new Date() };
    this.chatLogs.push(newLog);
    return newLog;
  }

  async getLatestRegimeLog(): Promise<RegimeLog | undefined> {
    return this.regimeLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async createRegimeLog(log: InsertRegimeLog): Promise<RegimeLog> {
    const newLog: RegimeLog = { ...log, createdAt: new Date() };
    this.regimeLogs.push(newLog);
    return newLog;
  }

  async getRealizedPnlLogsByPortfolioId(portfolioId: number): Promise<RealizedPnlLog[]> {
    return this.realizedPnlLogs
      .filter(log => log.portfolioId === portfolioId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createRealizedPnlLog(log: InsertRealizedPnlLog): Promise<RealizedPnlLog> {
    const newLog: RealizedPnlLog = { ...log, createdAt: new Date() };
    this.realizedPnlLogs.push(newLog);
    return newLog;
  }

  async deleteRealizedPnlLogByTradeId(tradeId: number): Promise<void> {
    const index = this.realizedPnlLogs.findIndex(log => log.tradeId === tradeId);
    if (index !== -1) {
      this.realizedPnlLogs.splice(index, 1);
    }
  }
}

// Use mock storage by default (no DB required for local dev)
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MockStorage();
