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

// Email integration tables
export const emailIntegrations = pgTable("email_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  provider: text("provider").notNull(), // gmail, outlook, forwarding
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  syncCursor: text("sync_cursor"), // historyId for Gmail, deltaToken for Outlook
  lastSyncAt: timestamp("last_sync_at"),
  status: text("status").default("active"), // active, paused, error
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pendingReceipts = pgTable("pending_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  messageId: text("message_id").notNull(),
  extractedData: jsonb("extracted_data").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.0"),
  status: text("status").default("pending"), // pending, accepted, rejected
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const processedMessages = pgTable("processed_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailIntegrationId: varchar("email_integration_id").notNull(),
  messageId: text("message_id").notNull(),
  subject: text("subject"),
  sender: text("sender"),
  receivedAt: timestamp("received_at").notNull(),
  processed: boolean("processed").default(false),
  hasReceipt: boolean("has_receipt").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forwardingAddresses = pgTable("forwarding_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  address: text("address").notNull().unique(),
  token: text("token").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailSyncJobs = pgTable("email_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull(),
  jobType: text("job_type").notNull(), // poll, backfill, push_notification
  status: text("status").default("pending"), // pending, running, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  syncCursor: text("sync_cursor"),
  messagesProcessed: integer("messages_processed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Receipt Design Customization
export const receiptDesigns = pgTable("receipt_designs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  
  // Theme settings
  colorScheme: text("color_scheme").default("green"), // green, blue, purple, red, orange, dark
  backgroundStyle: text("background_style").default("clean"), // clean, gradient, pattern, textured
  
  // Layout settings  
  layoutStyle: text("layout_style").default("modern"), // modern, classic, minimal, detailed
  showMap: boolean("show_map").default(true),
  showEcoPoints: boolean("show_eco_points").default(true),
  showAnalyticsToggle: boolean("show_analytics_toggle").default(true),
  
  // Typography settings
  fontStyle: text("font_style").default("modern"), // modern, classic, monospace, handwritten
  fontSize: text("font_size").default("medium"), // small, medium, large
  
  // Display settings
  itemDisplayStyle: text("item_display_style").default("list"), // list, grid, compact
  showItemCategories: boolean("show_item_categories").default(false),
  showItemImages: boolean("show_item_images").default(false),
  groupSimilarItems: boolean("group_similar_items").default(false),
  
  // Branding settings
  showMerchantLogo: boolean("show_merchant_logo").default(true),
  customWatermark: text("custom_watermark"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertEmailIntegrationSchema = createInsertSchema(emailIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPendingReceiptSchema = createInsertSchema(pendingReceipts).omit({
  id: true,
  createdAt: true,
});

export const insertProcessedMessageSchema = createInsertSchema(processedMessages).omit({
  id: true,
  createdAt: true,
});

export const insertForwardingAddressSchema = createInsertSchema(forwardingAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSyncJobSchema = createInsertSchema(emailSyncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertReceiptDesignSchema = createInsertSchema(receiptDesigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type EmailIntegration = typeof emailIntegrations.$inferSelect;
export type InsertEmailIntegration = z.infer<typeof insertEmailIntegrationSchema>;

export type PendingReceipt = typeof pendingReceipts.$inferSelect;
export type InsertPendingReceipt = z.infer<typeof insertPendingReceiptSchema>;

export type ProcessedMessage = typeof processedMessages.$inferSelect;
export type InsertProcessedMessage = z.infer<typeof insertProcessedMessageSchema>;

export type ForwardingAddress = typeof forwardingAddresses.$inferSelect;
export type InsertForwardingAddress = z.infer<typeof insertForwardingAddressSchema>;

export type EmailSyncJob = typeof emailSyncJobs.$inferSelect;
export type InsertEmailSyncJob = z.infer<typeof insertEmailSyncJobSchema>;

export type ReceiptDesign = typeof receiptDesigns.$inferSelect;
export type InsertReceiptDesign = z.infer<typeof insertReceiptDesignSchema>;

export type InsertWarrantyClaim = z.infer<typeof insertWarrantyClaimSchema>;
