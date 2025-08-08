import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const merchants = pgTable("merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logo: text("logo"),
  category: text("category"),
  brandColor: text("brand_color"),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  merchantId: varchar("merchant_id"),
  merchantName: text("merchant_name").notNull(),
  location: text("location"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("GBP"),
  date: timestamp("date").notNull(),
  receiptNumber: text("receipt_number"),
  paymentMethod: text("payment_method"),
  category: text("category"),
  rawData: jsonb("raw_data"),
  imageUrl: text("image_url"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  ecoPoints: integer("eco_points").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const receiptItems = pgTable("receipt_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull(),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 8, scale: 2 }).default("1"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
  notes: text("notes"),
});

export const loyaltyCards = pgTable("loyalty_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  merchantId: varchar("merchant_id").notNull(),
  cardNumber: text("card_number").notNull(),
  cardName: text("card_name").notNull(),
  points: integer("points").default(0),
  isActive: boolean("is_active").default(true),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  merchantName: text("merchant_name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(), // monthly, weekly, yearly
  nextDate: timestamp("next_date"),
  isActive: boolean("is_active").default(true),
  lastReceiptId: varchar("last_receipt_id"),
});

export const warranties = pgTable("warranties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  receiptId: varchar("receipt_id").notNull(),
  productName: text("product_name").notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  warrantyPeriod: integer("warranty_period"), // months
  claimCode: text("claim_code"),
  isActive: boolean("is_active").default(true),
});

export const ecoMetrics = pgTable("eco_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  month: text("month").notNull(), // YYYY-MM format
  papersSaved: integer("papers_saved").default(0),
  co2Reduced: decimal("co2_reduced", { precision: 8, scale: 2 }).default("0"), // kg
  treesEquivalent: decimal("trees_equivalent", { precision: 6, scale: 2 }).default("0"),
  ecoPoints: integer("eco_points").default(0),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id"),
  itemId: varchar("item_id"),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const splits = pgTable("splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptId: varchar("receipt_id").notNull(),
  userId: varchar("user_id").notNull(),
  sharedWith: text("shared_with").notNull(), // email or phone
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending"), // pending, paid, cancelled
  paymentLink: text("payment_link"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  phone: true,
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
});

export const insertReceiptItemSchema = createInsertSchema(receiptItems).omit({
  id: true,
});

export const insertLoyaltyCardSchema = createInsertSchema(loyaltyCards).omit({
  id: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
});

export const insertWarrantySchema = createInsertSchema(warranties).omit({
  id: true,
});

export const insertEcoMetricsSchema = createInsertSchema(ecoMetrics).omit({
  id: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertSplitSchema = createInsertSchema(splits).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;

export type ReceiptItem = typeof receiptItems.$inferSelect;
export type InsertReceiptItem = z.infer<typeof insertReceiptItemSchema>;

export type LoyaltyCard = typeof loyaltyCards.$inferSelect;
export type InsertLoyaltyCard = z.infer<typeof insertLoyaltyCardSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Warranty = typeof warranties.$inferSelect;
export type InsertWarranty = z.infer<typeof insertWarrantySchema>;

export type EcoMetrics = typeof ecoMetrics.$inferSelect;
export type InsertEcoMetrics = z.infer<typeof insertEcoMetricsSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Split = typeof splits.$inferSelect;
export type InsertSplit = z.infer<typeof insertSplitSchema>;
