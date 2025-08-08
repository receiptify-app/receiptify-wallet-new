import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertReceiptSchema, 
  insertReceiptItemSchema,
  insertCommentSchema,
  insertSplitSchema,
  insertLoyaltyCardSchema,
  insertSubscriptionSchema,
  insertWarrantySchema
} from "@shared/schema";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  const defaultUserId = "default-user"; // For demo purposes

  // Receipt routes
  app.get("/api/receipts", async (req, res) => {
    try {
      const { category, merchant, startDate, endDate, minAmount, maxAmount } = req.query;
      
      const filters: any = {};
      if (category && typeof category === 'string') filters.category = category;
      if (merchant && typeof merchant === 'string') filters.merchantName = merchant;
      if (startDate && typeof startDate === 'string') filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === 'string') filters.endDate = new Date(endDate);
      if (minAmount && typeof minAmount === 'string') filters.minAmount = parseFloat(minAmount);
      if (maxAmount && typeof maxAmount === 'string') filters.maxAmount = parseFloat(maxAmount);

      const receipts = await storage.getReceipts(defaultUserId, filters);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const items = await storage.getReceiptItems(receipt.id);
      res.json({ ...receipt, items });
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({ error: "Failed to fetch receipt" });
    }
  });

  app.post("/api/receipts", async (req, res) => {
    try {
      const validatedData = insertReceiptSchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const receipt = await storage.createReceipt(validatedData);
      
      // Process items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const validatedItem = insertReceiptItemSchema.parse({
            ...item,
            receiptId: receipt.id,
          });
          await storage.createReceiptItem(validatedItem);
        }
      }

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(400).json({ error: "Failed to create receipt" });
    }
  });

  app.post("/api/receipts/upload", upload.single('receipt'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Simulate OCR processing
      const mockReceiptData = {
        userId: defaultUserId,
        merchantName: "Scanned Receipt",
        location: "Unknown Location",
        total: "0.00",
        date: new Date(),
        category: "Other",
        paymentMethod: "Unknown",
        receiptNumber: `SCN${Date.now()}`,
      };

      const receipt = await storage.createReceipt(mockReceiptData);
      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(400).json({ error: "Failed to process receipt" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const success = await storage.deleteReceipt(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting receipt:", error);
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  // Receipt items routes
  app.get("/api/receipts/:id/items", async (req, res) => {
    try {
      const items = await storage.getReceiptItems(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching receipt items:", error);
      res.status(500).json({ error: "Failed to fetch receipt items" });
    }
  });

  app.post("/api/receipts/:id/items", async (req, res) => {
    try {
      const validatedData = insertReceiptItemSchema.parse({
        ...req.body,
        receiptId: req.params.id,
      });
      
      const item = await storage.createReceiptItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating receipt item:", error);
      res.status(400).json({ error: "Failed to create receipt item" });
    }
  });

  app.put("/api/receipt-items/:id", async (req, res) => {
    try {
      const item = await storage.updateReceiptItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Receipt item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating receipt item:", error);
      res.status(500).json({ error: "Failed to update receipt item" });
    }
  });

  // Search routes
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query required" });
      }

      const receipts = await storage.searchReceipts(defaultUserId, q);
      res.json(receipts);
    } catch (error) {
      console.error("Error searching receipts:", error);
      res.status(500).json({ error: "Failed to search receipts" });
    }
  });

  // Merchant routes
  app.get("/api/merchants", async (req, res) => {
    try {
      const merchants = await storage.getMerchants();
      res.json(merchants);
    } catch (error) {
      console.error("Error fetching merchants:", error);
      res.status(500).json({ error: "Failed to fetch merchants" });
    }
  });

  // Eco metrics routes
  app.get("/api/eco-metrics", async (req, res) => {
    try {
      const { month } = req.query;
      const metrics = await storage.getEcoMetrics(
        defaultUserId, 
        typeof month === 'string' ? month : undefined
      );
      
      if (!metrics) {
        // Return default empty metrics
        res.json({
          papersSaved: 0,
          co2Reduced: "0",
          treesEquivalent: "0",
          ecoPoints: 0
        });
      } else {
        res.json(metrics);
      }
    } catch (error) {
      console.error("Error fetching eco metrics:", error);
      res.status(500).json({ error: "Failed to fetch eco metrics" });
    }
  });

  // Loyalty cards routes
  app.get("/api/loyalty-cards", async (req, res) => {
    try {
      const cards = await storage.getLoyaltyCards(defaultUserId);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching loyalty cards:", error);
      res.status(500).json({ error: "Failed to fetch loyalty cards" });
    }
  });

  app.post("/api/loyalty-cards", async (req, res) => {
    try {
      const validatedData = insertLoyaltyCardSchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const card = await storage.createLoyaltyCard(validatedData);
      res.status(201).json(card);
    } catch (error) {
      console.error("Error creating loyalty card:", error);
      res.status(400).json({ error: "Failed to create loyalty card" });
    }
  });

  // Subscriptions routes
  app.get("/api/subscriptions", async (req, res) => {
    try {
      const subscriptions = await storage.getSubscriptions(defaultUserId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    try {
      const validatedData = insertSubscriptionSchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const subscription = await storage.createSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ error: "Failed to create subscription" });
    }
  });

  // Warranties routes
  app.get("/api/warranties", async (req, res) => {
    try {
      const warranties = await storage.getWarranties(defaultUserId);
      res.json(warranties);
    } catch (error) {
      console.error("Error fetching warranties:", error);
      res.status(500).json({ error: "Failed to fetch warranties" });
    }
  });

  app.post("/api/warranties", async (req, res) => {
    try {
      const validatedData = insertWarrantySchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const warranty = await storage.createWarranty(validatedData);
      res.status(201).json(warranty);
    } catch (error) {
      console.error("Error creating warranty:", error);
      res.status(400).json({ error: "Failed to create warranty" });
    }
  });

  // Comments routes
  app.get("/api/comments", async (req, res) => {
    try {
      const { receiptId, itemId } = req.query;
      const comments = await storage.getComments(
        typeof receiptId === 'string' ? receiptId : undefined,
        typeof itemId === 'string' ? itemId : undefined
      );
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", async (req, res) => {
    try {
      const validatedData = insertCommentSchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const comment = await storage.createComment(validatedData);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(400).json({ error: "Failed to create comment" });
    }
  });

  // Splits routes
  app.get("/api/receipts/:id/splits", async (req, res) => {
    try {
      const splits = await storage.getSplits(req.params.id);
      res.json(splits);
    } catch (error) {
      console.error("Error fetching splits:", error);
      res.status(500).json({ error: "Failed to fetch splits" });
    }
  });

  app.post("/api/receipts/:id/splits", async (req, res) => {
    try {
      const validatedData = insertSplitSchema.parse({
        ...req.body,
        receiptId: req.params.id,
        userId: defaultUserId,
      });
      
      const split = await storage.createSplit(validatedData);
      res.status(201).json(split);
    } catch (error) {
      console.error("Error creating split:", error);
      res.status(400).json({ error: "Failed to create split" });
    }
  });

  // QR code webhook (mock)
  app.post("/api/webhook/qr", async (req, res) => {
    try {
      // Simulate QR code receipt data
      const mockReceiptData = {
        userId: defaultUserId,
        merchantName: req.body.merchantName || "QR Merchant",
        location: req.body.location || "Unknown Location",
        total: req.body.total || "0.00",
        date: new Date(req.body.date || Date.now()),
        category: req.body.category || "Other",
        paymentMethod: "Card",
        receiptNumber: req.body.receiptNumber || `QR${Date.now()}`,
      };

      const receipt = await storage.createReceipt(mockReceiptData);
      
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          await storage.createReceiptItem({
            ...item,
            receiptId: receipt.id,
          });
        }
      }

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error processing QR webhook:", error);
      res.status(400).json({ error: "Failed to process QR receipt" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
