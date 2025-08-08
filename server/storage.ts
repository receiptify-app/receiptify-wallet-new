import {
  type User, type InsertUser,
  type Receipt, type InsertReceipt,
  type ReceiptItem, type InsertReceiptItem,
  type Merchant, type InsertMerchant,
  type LoyaltyCard, type InsertLoyaltyCard,
  type Subscription, type InsertSubscription,
  type Warranty, type InsertWarranty,
  type EcoMetrics, type InsertEcoMetrics,
  type Comment, type InsertComment,
  type Split, type InsertSplit,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Merchant operations
  getMerchants(): Promise<Merchant[]>;
  getMerchant(id: string): Promise<Merchant | undefined>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;

  // Receipt operations
  getReceipts(userId: string, filters?: {
    category?: string;
    merchantName?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<Receipt[]>;
  getReceipt(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;

  // Receipt item operations
  getReceiptItems(receiptId: string): Promise<ReceiptItem[]>;
  createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem>;
  updateReceiptItem(id: string, updates: Partial<InsertReceiptItem>): Promise<ReceiptItem | undefined>;
  deleteReceiptItem(id: string): Promise<boolean>;

  // Loyalty card operations
  getLoyaltyCards(userId: string): Promise<LoyaltyCard[]>;
  createLoyaltyCard(card: InsertLoyaltyCard): Promise<LoyaltyCard>;
  updateLoyaltyCard(id: string, updates: Partial<InsertLoyaltyCard>): Promise<LoyaltyCard | undefined>;

  // Subscription operations
  getSubscriptions(userId: string): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<InsertSubscription>): Promise<Subscription | undefined>;

  // Warranty operations
  getWarranties(userId: string): Promise<Warranty[]>;
  createWarranty(warranty: InsertWarranty): Promise<Warranty>;
  updateWarranty(id: string, updates: Partial<InsertWarranty>): Promise<Warranty | undefined>;

  // Eco metrics operations
  getEcoMetrics(userId: string, month?: string): Promise<EcoMetrics | undefined>;
  updateEcoMetrics(userId: string, month: string, metrics: Partial<InsertEcoMetrics>): Promise<EcoMetrics>;

  // Comment operations
  getComments(receiptId?: string, itemId?: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  // Split operations
  getSplits(receiptId: string): Promise<Split[]>;
  createSplit(split: InsertSplit): Promise<Split>;
  updateSplit(id: string, updates: Partial<InsertSplit>): Promise<Split | undefined>;

  // Search
  searchReceipts(userId: string, query: string): Promise<Receipt[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private merchants: Map<string, Merchant> = new Map();
  private receipts: Map<string, Receipt> = new Map();
  private receiptItems: Map<string, ReceiptItem> = new Map();
  private loyaltyCards: Map<string, LoyaltyCard> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private warranties: Map<string, Warranty> = new Map();
  private ecoMetrics: Map<string, EcoMetrics> = new Map();
  private comments: Map<string, Comment> = new Map();
  private splits: Map<string, Split> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create sample UK merchants
    const merchants = [
      { name: "Tesco Express", logo: "T", category: "Groceries", brandColor: "#00539C" },
      { name: "Waitrose", logo: "W", category: "Groceries", brandColor: "#2C5F41" },
      { name: "Shell", logo: "⛽", category: "Fuel", brandColor: "#DC143C" },
      { name: "Sainsbury's", logo: "S", category: "Groceries", brandColor: "#FF8200" },
      { name: "Argos", logo: "A", category: "Retail", brandColor: "#DC143C" },
      { name: "Boots", logo: "B", category: "Health", brandColor: "#0054A6" },
    ];

    merchants.forEach(merchant => {
      const id = randomUUID();
      this.merchants.set(id, { id, ...merchant });
    });

    // Create default user
    const defaultUser = {
      id: "default-user",
      username: "demo",
      email: "demo@receiptify.com",
      phone: "+44 7700 900123",
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Create sample eco metrics
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const ecoId = randomUUID();
    this.ecoMetrics.set(ecoId, {
      id: ecoId,
      userId: defaultUser.id,
      month: currentMonth,
      papersSaved: 47,
      co2Reduced: "2.3",
      treesEquivalent: "0.1",
      ecoPoints: 470,
    });

    // Create sample receipts
    const sampleReceipts = [
      {
        userId: defaultUser.id,
        merchantName: "Tesco Express",
        location: "Camden, London",
        total: "24.18",
        date: new Date("2024-04-26"),
        category: "Groceries",
        ecoPoints: 1,
      },
      {
        userId: defaultUser.id,
        merchantName: "Waitrose",
        location: "Harrow Weald",
        total: "12.02",
        date: new Date("2024-04-25"),
        category: "Groceries",
        ecoPoints: 1,
      },
      {
        userId: defaultUser.id,
        merchantName: "Shell",
        location: "M25 Services",
        total: "45.67",
        date: new Date("2024-04-24"),
        category: "Fuel",
        ecoPoints: 1,
      },
    ];

    sampleReceipts.forEach(receipt => {
      const receiptId = randomUUID();
      this.receipts.set(receiptId, {
        id: receiptId,
        ...receipt,
        currency: "GBP",
        receiptNumber: `R${Math.floor(Math.random() * 100000)}`,
        paymentMethod: "Card",
        rawData: null,
        imageUrl: null,
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        merchantId: null,
      });

      // Add sample items for each receipt
      const sampleItems = receipt.merchantName === "Tesco Express" 
        ? [
            { name: "Plain Bagels 4pk", price: "1.50", category: "Bakery" },
            { name: "Whole Milk 4 Pints", price: "1.65", category: "Dairy" },
            { name: "Cheddar Cheese", price: "3.25", category: "Dairy" },
            { name: "Bananas", price: "1.20", category: "Fruit" },
            { name: "Bread Loaf", price: "0.85", category: "Bakery" },
          ]
        : receipt.merchantName === "Waitrose"
        ? [
            { name: "SDGH BGTTE", price: "2.00", category: "Groceries" },
            { name: "ITAL MOZZARELLA", price: "1.70", category: "Dairy" },
            { name: "ITAL MOZZARELLA", price: "1.70", category: "Dairy" },
            { name: "CWDSO SMK SALMON", price: "4.87", category: "Fish" },
          ]
        : [
            { name: "Unleaded Petrol", price: "43.50", category: "Fuel" },
            { name: "Coffee", price: "2.17", category: "Food" },
          ];

      sampleItems.forEach(item => {
        const itemId = randomUUID();
        this.receiptItems.set(itemId, {
          id: itemId,
          receiptId,
          quantity: "1",
          notes: null,
          ...item,
        });
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      email: insertUser.email || null,
      phone: insertUser.phone || null,
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async getMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values());
  }

  async getMerchant(id: string): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const id = randomUUID();
    const newMerchant: Merchant = { 
      id, 
      ...merchant,
      category: merchant.category || null,
      logo: merchant.logo || null,
      brandColor: merchant.brandColor || null
    };
    this.merchants.set(id, newMerchant);
    return newMerchant;
  }

  async getReceipts(userId: string, filters?: any): Promise<Receipt[]> {
    let receipts = Array.from(this.receipts.values()).filter(r => r.userId === userId);
    
    if (filters) {
      if (filters.category) {
        receipts = receipts.filter(r => r.category === filters.category);
      }
      if (filters.merchantName) {
        receipts = receipts.filter(r => r.merchantName.toLowerCase().includes(filters.merchantName.toLowerCase()));
      }
      if (filters.startDate) {
        receipts = receipts.filter(r => new Date(r.date) >= filters.startDate);
      }
      if (filters.endDate) {
        receipts = receipts.filter(r => new Date(r.date) <= filters.endDate);
      }
      if (filters.minAmount) {
        receipts = receipts.filter(r => parseFloat(r.total) >= filters.minAmount);
      }
      if (filters.maxAmount) {
        receipts = receipts.filter(r => parseFloat(r.total) <= filters.maxAmount);
      }
    }

    return receipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    const newReceipt: Receipt = { 
      ...receipt,
      id, 
      createdAt: new Date(),
      currency: receipt.currency || "GBP",
      ecoPoints: receipt.ecoPoints || 1,
      location: receipt.location || null,
      category: receipt.category || null,
      merchantId: receipt.merchantId || null,
      paymentMethod: receipt.paymentMethod || null,
      latitude: receipt.latitude || null,
      longitude: receipt.longitude || null,
    };
    this.receipts.set(id, newReceipt);

    // Update eco metrics
    const month = new Date(receipt.date).toISOString().slice(0, 7);
    await this.updateEcoMetrics(receipt.userId, month, {
      papersSaved: 1,
      co2Reduced: "0.05",
      treesEquivalent: "0.001",
      ecoPoints: 10,
    });

    return newReceipt;
  }

  async updateReceipt(id: string, updates: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const receipt = this.receipts.get(id);
    if (!receipt) return undefined;

    const updatedReceipt = { ...receipt, ...updates };
    this.receipts.set(id, updatedReceipt);
    return updatedReceipt;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    return this.receipts.delete(id);
  }

  async getReceiptItems(receiptId: string): Promise<ReceiptItem[]> {
    return Array.from(this.receiptItems.values()).filter(item => item.receiptId === receiptId);
  }

  async createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem> {
    const id = randomUUID();
    const newItem: ReceiptItem = { 
      ...item, 
      id,
      quantity: item.quantity || "1",
      category: item.category || null,
      notes: item.notes || null,
    };
    this.receiptItems.set(id, newItem);
    return newItem;
  }

  async updateReceiptItem(id: string, updates: Partial<InsertReceiptItem>): Promise<ReceiptItem | undefined> {
    const item = this.receiptItems.get(id);
    if (!item) return undefined;

    const updatedItem = { ...item, ...updates };
    this.receiptItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteReceiptItem(id: string): Promise<boolean> {
    return this.receiptItems.delete(id);
  }

  async getLoyaltyCards(userId: string): Promise<LoyaltyCard[]> {
    return Array.from(this.loyaltyCards.values()).filter(card => card.userId === userId);
  }

  async createLoyaltyCard(card: InsertLoyaltyCard): Promise<LoyaltyCard> {
    const id = randomUUID();
    const newCard: LoyaltyCard = { 
      ...card, 
      id,
      points: card.points || 0,
      isActive: card.isActive ?? true,
    };
    this.loyaltyCards.set(id, newCard);
    return newCard;
  }

  async updateLoyaltyCard(id: string, updates: Partial<InsertLoyaltyCard>): Promise<LoyaltyCard | undefined> {
    const card = this.loyaltyCards.get(id);
    if (!card) return undefined;

    const updatedCard = { ...card, ...updates };
    this.loyaltyCards.set(id, updatedCard);
    return updatedCard;
  }

  async getSubscriptions(userId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(sub => sub.userId === userId);
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const newSubscription: Subscription = { 
      ...subscription, 
      id,
      isActive: subscription.isActive ?? true,
      nextDate: subscription.nextDate || null,
      lastReceiptId: subscription.lastReceiptId || null,
    };
    this.subscriptions.set(id, newSubscription);
    return newSubscription;
  }

  async updateSubscription(id: string, updates: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return undefined;

    const updatedSubscription = { ...subscription, ...updates };
    this.subscriptions.set(id, updatedSubscription);
    return updatedSubscription;
  }

  async getWarranties(userId: string): Promise<Warranty[]> {
    return Array.from(this.warranties.values()).filter(warranty => warranty.userId === userId);
  }

  async createWarranty(warranty: InsertWarranty): Promise<Warranty> {
    const id = randomUUID();
    const newWarranty: Warranty = { 
      ...warranty, 
      id,
      isActive: warranty.isActive ?? true,
      claimCode: warranty.claimCode || `WR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      warrantyPeriod: warranty.warrantyPeriod || null,
    };
    this.warranties.set(id, newWarranty);
    return newWarranty;
  }

  async updateWarranty(id: string, updates: Partial<InsertWarranty>): Promise<Warranty | undefined> {
    const warranty = this.warranties.get(id);
    if (!warranty) return undefined;

    const updatedWarranty = { ...warranty, ...updates };
    this.warranties.set(id, updatedWarranty);
    return updatedWarranty;
  }

  async getEcoMetrics(userId: string, month?: string): Promise<EcoMetrics | undefined> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    return Array.from(this.ecoMetrics.values()).find(
      metric => metric.userId === userId && metric.month === targetMonth
    );
  }

  async updateEcoMetrics(userId: string, month: string, updates: Partial<InsertEcoMetrics>): Promise<EcoMetrics> {
    const existing = await this.getEcoMetrics(userId, month);
    
    if (existing) {
      const updated: EcoMetrics = {
        ...existing,
        papersSaved: (existing.papersSaved || 0) + (updates.papersSaved || 0),
        co2Reduced: (parseFloat(existing.co2Reduced || "0") + parseFloat(updates.co2Reduced || "0")).toString(),
        treesEquivalent: (parseFloat(existing.treesEquivalent || "0") + parseFloat(updates.treesEquivalent || "0")).toString(),
        ecoPoints: (existing.ecoPoints || 0) + (updates.ecoPoints || 0),
      };
      this.ecoMetrics.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newMetrics: EcoMetrics = {
        id,
        userId,
        month,
        papersSaved: updates.papersSaved || 0,
        co2Reduced: updates.co2Reduced || "0",
        treesEquivalent: updates.treesEquivalent || "0",
        ecoPoints: updates.ecoPoints || 0,
      };
      this.ecoMetrics.set(id, newMetrics);
      return newMetrics;
    }
  }

  async getComments(receiptId?: string, itemId?: string): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter(comment => 
      (!receiptId || comment.receiptId === receiptId) &&
      (!itemId || comment.itemId === itemId)
    );
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const newComment: Comment = { 
      ...comment, 
      id, 
      createdAt: new Date(),
      receiptId: comment.receiptId || null,
      itemId: comment.itemId || null,
    };
    this.comments.set(id, newComment);
    return newComment;
  }

  async getSplits(receiptId: string): Promise<Split[]> {
    return Array.from(this.splits.values()).filter(split => split.receiptId === receiptId);
  }

  async createSplit(split: InsertSplit): Promise<Split> {
    const id = randomUUID();
    const newSplit: Split = { 
      ...split, 
      id, 
      createdAt: new Date(),
      status: split.status || "pending",
      paymentLink: `https://pay.receiptify.com/split/${id}`,
    };
    this.splits.set(id, newSplit);
    return newSplit;
  }

  async updateSplit(id: string, updates: Partial<InsertSplit>): Promise<Split | undefined> {
    const split = this.splits.get(id);
    if (!split) return undefined;

    const updatedSplit = { ...split, ...updates };
    this.splits.set(id, updatedSplit);
    return updatedSplit;
  }

  async searchReceipts(userId: string, query: string): Promise<Receipt[]> {
    const lowerQuery = query.toLowerCase();
    const receipts = Array.from(this.receipts.values()).filter(r => r.userId === userId);
    
    return receipts.filter(receipt => 
      receipt.merchantName.toLowerCase().includes(lowerQuery) ||
      receipt.location?.toLowerCase().includes(lowerQuery) ||
      receipt.category?.toLowerCase().includes(lowerQuery) ||
      receipt.receiptNumber?.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const storage = new MemStorage();
