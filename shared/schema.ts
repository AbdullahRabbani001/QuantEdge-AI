import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - Replit Auth format
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Portfolios table
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull().default("Default Portfolio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({ id: true, createdAt: true });
export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;

// Trades table
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
  buyPrice: decimal("buy_price", { precision: 20, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 20, scale: 2 }),
  tax: decimal("tax", { precision: 20, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 20, scale: 2 }),
  side: text("side").notNull(), // 'buy' or 'sell'
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, createdAt: true }).extend({
  date: z.coerce.date(), // Accept both Date objects and ISO date strings
});
export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

// Quant signals table
export const quantSignals = pgTable("quant_signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  score: integer("score").notNull(), // 0-100
  signal: text("signal").notNull(), // 'Bullish', 'Bearish', 'Neutral'
  confidence: integer("confidence").notNull(), // 0-100
  factors: jsonb("factors").notNull(), // { trend, momentum, volatility, volume, sentiment }
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuantSignalSchema = createInsertSchema(quantSignals).omit({ id: true, createdAt: true });
export type QuantSignal = typeof quantSignals.$inferSelect;
export type InsertQuantSignal = z.infer<typeof insertQuantSignalSchema>;

// Chat logs table
export const chatLogs = pgTable("chat_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  message: text("message").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatLogSchema = createInsertSchema(chatLogs).omit({ id: true, createdAt: true });
export type ChatLog = typeof chatLogs.$inferSelect;
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;

// Regime logs table
export const regimeLogs = pgTable("regime_logs", {
  id: serial("id").primaryKey(),
  regime: text("regime").notNull(), // 'bull', 'bear', 'sideways'
  volatility: text("volatility").notNull(), // 'high', 'normal', 'low'
  trendStrength: integer("trend_strength").notNull(), // 0-100
  confidence: integer("confidence").notNull(), // 0-100
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRegimeLogSchema = createInsertSchema(regimeLogs).omit({ id: true, createdAt: true });
export type RegimeLog = typeof regimeLogs.$inferSelect;
export type InsertRegimeLog = z.infer<typeof insertRegimeLogSchema>;

// Realized PnL logs table
export const realizedPnlLogs = pgTable("realized_pnl_logs", {
  id: serial("id").primaryKey(),
  portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
  buyPrice: decimal("buy_price", { precision: 20, scale: 2 }).notNull(),
  sellPrice: decimal("sell_price", { precision: 20, scale: 2 }).notNull(),
  realizedPnl: decimal("realized_pnl", { precision: 20, scale: 2 }).notNull(),
  tradeId: integer("trade_id").references(() => trades.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRealizedPnlLogSchema = createInsertSchema(realizedPnlLogs).omit({ id: true, createdAt: true });
export type RealizedPnlLog = typeof realizedPnlLogs.$inferSelect;
export type InsertRealizedPnlLog = z.infer<typeof insertRealizedPnlLogSchema>;
