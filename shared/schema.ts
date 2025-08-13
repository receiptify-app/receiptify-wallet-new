import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, integer, boolean, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  email: text("email"),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  authProvider: text("auth_provider").default("local"), // local, google, apple, facebook, phone
  providerId: text("provider_id"), // External provider user ID
  phoneVerified: boolean("phone_verified").default(false),
  emailVerified: boolean("email_verified").default(false),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  serviceName: text("service_name").notNull(), // Netflix, Spotify, etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(), // monthly, weekly, yearly
  nextDate: timestamp("next_date"),
  lastChargedDate: timestamp("last_charged_date"),
  isPaused: boolean("is_paused").default(false),
  isActive: boolean("is_active").default(true),
  status: text("status").default("active"), // active, paused, cancelled
  cancellationUrl: text("cancellation_url"),
  manageUrl: text("manage_url"),
  category: text("category"), // Entertainment, Fitness, Software, etc.
  description: text("description"),
  lastReceiptId: varchar("last_receipt_id"),
  autoDetected: boolean("auto_detected").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const warranties = pgTable("warranties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  receiptId: varchar("receipt_id"),
  productName: text("product_name").notNull(),
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  purchaseDate: timestamp("purchase_date").notNull(),
  warrantyStartDate: timestamp("warranty_start_date").notNull(),
  warrantyEndDate: timestamp("warranty_end_date").notNull(),
  warrantyPeriodMonths: integer("warranty_period_months").notNull(),
  warrantyType: text("warranty_type").default("manufacturer"), // manufacturer, extended, store
  retailerName: text("retailer_name").notNull(),
  retailerContact: text("retailer_contact"),
  retailerWebsite: text("retailer_website"),
  retailerSupportEmail: text("retailer_support_email"),
  retailerSupportPhone: text("retailer_support_phone"),
  invoiceNumber: text("invoice_number"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  category: text("category"), // Electronics, Appliances, etc.
  description: text("description"),
  warrantyTerms: text("warranty_terms"),
  claimInstructions: text("claim_instructions"),
  isActive: boolean("is_active").default(true),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
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

export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // credit_card, apple_pay, google_pay
  last4: varchar("last4", { length: 4 }),
  brand: text("brand"),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").default(false),
  nickname: text("nickname"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for authentication
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// OTP verification table for phone/SMS authentication
export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  otpCode: text("otp_code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isVerified: boolean("is_verified").default(false),
  attempts: integer("attempts").default(0),
  method: text("method").default("sms"), // sms, ussd, email
  createdAt: timestamp("created_at").defaultNow(),
});

// Kiosk integration table for in-store scanning
export const kioskSessions = pgTable("kiosk_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeId: text("store_id").notNull(),
  userId: varchar("user_id"),
  phoneNumber: text("phone_number").notNull(),
  qrCode: text("qr_code").notNull(),
  pointsEarned: integer("points_earned").default(0),
  receiptId: varchar("receipt_id"),
  status: text("status").default("pending"), // pending, completed, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Warranty claims table for tracking warranty claims
export const warrantyClaims = pgTable("warranty_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warrantyId: varchar("warranty_id").notNull(),
  userId: varchar("user_id").notNull(),
  claimType: text("claim_type").notNull(), // repair, replacement, refund
  issueDescription: text("issue_description").notNull(),
  claimDate: timestamp("claim_date").defaultNow(),
  status: text("status").default("submitted"), // submitted, in_progress, approved, denied, completed
  claimNumber: text("claim_number"),
  retailerResponse: text("retailer_response"),
  resolutionDate: timestamp("resolution_date"),
  resolutionDetails: text("resolution_details"),
  attachments: text("attachments").array(), // image URLs
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertWarrantySchema = createInsertSchema(warranties).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarrantyClaimSchema = createInsertSchema(warrantyClaims).omit({
  id: true,
  createdAt: true,
});

export const insertKioskSessionSchema = createInsertSchema(kioskSessions).omit({
  id: true,
  createdAt: true,
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

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;

export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;

export type KioskSession = typeof kioskSessions.$inferSelect;
export type InsertKioskSession = z.infer<typeof insertKioskSessionSchema>;

export type WarrantyClaim = typeof warrantyClaims.$inferSelect;
export type InsertWarrantyClaim = z.infer<typeof insertWarrantyClaimSchema>;
