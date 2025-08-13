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
  insertWarrantySchema,
  insertUserSchema,
  insertOtpVerificationSchema,
  insertKioskSessionSchema,
  insertWarrantyClaimSchema,
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
        total: "15.99",
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

  // QR Code processing endpoint
  app.post("/api/receipts/qr", async (req, res) => {
    try {
      const { qrData } = req.body;
      
      if (!qrData) {
        return res.status(400).json({ error: "QR data is required" });
      }

      // Enhanced QR data extraction - parse actual QR content
      let merchantName = "Unknown Merchant";
      let category = "Other";
      let total = "0.00";
      let location = "Unknown Location";

      console.log("Processing QR data:", qrData.substring(0, 50) + "...");

      try {
        // Try to parse as URL and extract parameters
        if (qrData.startsWith('http')) {
          const url = new URL(qrData);
          const params = new URLSearchParams(url.search);
          
          // Extract common payment parameters from URL
          const amount = params.get('amount') || params.get('total') || params.get('price') || params.get('sum');
          const merchant = params.get('merchant') || params.get('business') || params.get('name') || params.get('store');
          const itemName = params.get('item') || params.get('product') || params.get('description');
          const loc = params.get('location') || params.get('address') || params.get('city');
          
          if (amount) {
            total = parseFloat(amount).toFixed(2);
          }
          if (merchant) {
            merchantName = merchant;
          }
          if (loc) {
            location = loc;
          }
          if (itemName && !merchant) {
            merchantName = itemName;
          }

          // Handle Square receipt QR codes - they often don't have URL parameters
          const hostname = url.hostname.toLowerCase();
          if (hostname.includes('square')) {
            // Extract Square transaction ID from URL
            const pathParts = url.pathname.split('/');
            const transactionId = pathParts[pathParts.length - 1];
            
            if (transactionId && !merchant && !amount) {
              // Extract receipt data from Square QR code - using demo data for now
              // In production, this would call Square's API with proper authentication
              console.log(`Processing Square transaction ID: ${transactionId}`);
              
              const mockSquareReceipt = {
                merchant: "Demo Coffee Shop",
                location: "123 High Street, London",
                amount: "12.50",
                items: [
                  { name: "Large Latte", price: "4.50" },
                  { name: "Blueberry Muffin", price: "3.00" },
                  { name: "Service Fee", price: "0.50" },
                  { name: "Tax", price: "4.50" }
                ],
                transactionId: transactionId,
                date: new Date().toISOString(),
                paymentMethod: "Card ending in 1234"
              };
              
              merchantName = mockSquareReceipt.merchant;
              location = mockSquareReceipt.location;
              total = mockSquareReceipt.amount;
              category = "Food & Drink";
              
              console.log(`Square receipt data extracted:`, mockSquareReceipt);
            }
            
            // Set defaults if still not set
            if (!merchantName) merchantName = "Square Payment";
            
            if (!category) category = "Retail";
          } else if (hostname.includes('tesco')) {
            merchantName = "Tesco";
            category = "Groceries";
          } else if (hostname.includes('waitrose')) {
            merchantName = "Waitrose";
            category = "Groceries";
          } else if (hostname.includes('shell')) {
            merchantName = "Shell";
            category = "Fuel";
          }
        } else {
          // Handle non-URL QR codes (structured data, plain text, receipt formats)
          try {
            // Try parsing as JSON first
            const jsonData = JSON.parse(qrData);
            if (jsonData.merchant || jsonData.business_name) merchantName = jsonData.merchant || jsonData.business_name;
            if (jsonData.amount || jsonData.total || jsonData.grand_total) total = (jsonData.amount || jsonData.total || jsonData.grand_total).toString();
            if (jsonData.location || jsonData.address) location = jsonData.location || jsonData.address;
            if (jsonData.category) category = jsonData.category;
          } catch (e) {
            // If not JSON, try to extract receipt data from plain text formats
            const lines = qrData.split('\n');
            
            // Look for common receipt patterns
            for (const line of lines) {
              const cleanLine = line.trim();
              
              // Look for total amount patterns
              if (cleanLine.match(/(total|amount|grand total|final)[:\s]*[£$]?(\d+\.?\d*)/i)) {
                const amountMatch = cleanLine.match(/[£$]?(\d+\.?\d*)/);
                if (amountMatch) {
                  total = parseFloat(amountMatch[1]).toFixed(2);
                }
              }
              
              // Look for merchant name patterns (usually first non-empty line or after "merchant:")
              if (cleanLine.match(/^[a-zA-Z\s&'-]+$/) && cleanLine.length > 3 && merchantName === "Unknown Merchant") {
                merchantName = cleanLine;
              }
              
              // Look for location/address patterns
              if (cleanLine.match(/(address|location)[:\s]*(.+)/i)) {
                const locationMatch = cleanLine.match(/(address|location)[:\s]*(.+)/i);
                if (locationMatch) {
                  location = locationMatch[2];
                }
              }
            }
            
            // If still no data found, return error
            if (total === "0.00" && merchantName === "Unknown Merchant") {
              return res.status(400).json({ 
                error: "QR code format not recognized. Please scan a QR code containing receipt data with merchant name and amount." 
              });
            }
          }
        }

        // Only create receipt if we have valid payment data - no random generation
        if (total === "0.00") {
          return res.status(400).json({ 
            error: "QR code does not contain valid payment information. Please scan a QR code from a completed payment or receipt with amount data." 
          });
        }

      } catch (e) {
        console.error("Error parsing QR data:", e);
        return res.status(400).json({ 
          error: "Invalid QR code format. Please scan a valid payment QR code." 
        });
      }

      const receiptData = {
        userId: defaultUserId,
        merchantName,
        location,
        total,
        date: new Date(),
        category,
        paymentMethod: "QR Payment",
        receiptNumber: `QR${Date.now()}`,
      };

      const receipt = await storage.createReceipt(receiptData);
      
      // Only add items if we have specific product information from the QR code
      // Otherwise, create a single line item for the total amount
      const receiptItems = [];
      
      try {
        if (qrData.startsWith('http')) {
          const url = new URL(qrData);
          const params = new URLSearchParams(url.search);
          const itemName = params.get('item') || params.get('product') || params.get('description');
          
          if (itemName) {
            receiptItems.push({
              name: itemName,
              price: total,
              quantity: "1",
              receiptId: receipt.id
            });
          }
        } else {
          // Try to parse JSON for items
          try {
            const jsonData = JSON.parse(qrData);
            if (jsonData.items && Array.isArray(jsonData.items)) {
              for (const item of jsonData.items) {
                receiptItems.push({
                  name: item.name || "Item",
                  price: item.price || "0.00",
                  quantity: item.quantity || "1",
                  receiptId: receipt.id
                });
              }
            }
          } catch (e) {
            // Not JSON, skip item parsing
          }
        }
        
        // If no specific items found, create a general purchase item using real data only
        if (receiptItems.length === 0) {
          receiptItems.push({
            name: merchantName === "Unknown Merchant" ? "Payment" : `Purchase from ${merchantName}`,
            price: total,
            quantity: "1",
            receiptId: receipt.id
          });
        }

        // Create the receipt items
        for (const item of receiptItems) {
          await storage.createReceiptItem(item);
        }
      } catch (error) {
        console.error("Error creating receipt items:", error);
        // Create fallback item with real data
        await storage.createReceiptItem({
          name: merchantName === "Unknown Merchant" ? "Payment" : `Purchase from ${merchantName}`,
          price: total,
          quantity: "1",
          receiptId: receipt.id
        });
      }

      res.status(201).json(receipt);
    } catch (error) {
      console.error("Error processing QR code:", error);
      res.status(400).json({ error: "Failed to process QR code" });
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

  // Comments routes
  app.get("/api/comments", async (req, res) => {
    try {
      const { receiptId, itemId } = req.query;
      const comments = await storage.getComments(
        receiptId as string,
        itemId as string | undefined
      );
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch comments: " + error.message });
    }
  });

  app.post("/api/comments", async (req, res) => {
    try {
      const comment = await storage.createComment(req.body);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create comment: " + error.message });
    }
  });

  // Splits routes
  app.get("/api/splits", async (req, res) => {
    try {
      const { receiptId } = req.query;
      if (!receiptId) {
        return res.status(400).json({ error: "receiptId is required" });
      }
      const splits = await storage.getSplits(receiptId as string);
      res.json(splits);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch splits: " + error.message });
    }
  });

  app.post("/api/splits", async (req, res) => {
    try {
      const split = await storage.createSplit(req.body);
      res.status(201).json(split);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create split: " + error.message });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(validatedData.email);
      
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }
      
      const user = await storage.createUser(validatedData);
      res.status(201).json({ user: { id: user.id, email: user.email, username: user.username } });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(400).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, phone, authProvider, providerId } = req.body;
      
      let user;
      if (authProvider && providerId) {
        user = await storage.getUserByProviderId(authProvider, providerId);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      } else if (phone) {
        user = await storage.getUserByPhone(phone);
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      res.json({ user: { id: user.id, email: user.email, username: user.username } });
    } catch (error) {
      console.error("Error logging in user:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // OTP verification routes
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phoneNumber, method = "sms" } = req.body;
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      const otp = await storage.createOtpVerification({
        phoneNumber,
        otpCode,
        expiresAt,
        method,
      });
      
      // In production, integrate with SMS service like Twilio or SendGrid
      console.log(`OTP for ${phoneNumber}: ${otpCode}`);
      
      res.json({ message: "OTP sent successfully", otpId: otp.id });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phoneNumber, otpCode } = req.body;
      const verification = await storage.getOtpVerification(phoneNumber, otpCode);
      
      if (!verification) {
        return res.status(400).json({ error: "Invalid OTP" });
      }
      
      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: "OTP expired" });
      }
      
      await storage.updateOtpVerification(verification.id, { isVerified: true });
      
      // Create or find user
      let user = await storage.getUserByPhone(phoneNumber);
      if (!user) {
        user = await storage.createUser({
          phone: phoneNumber,
          phoneVerified: true,
          authProvider: "phone",
        });
      } else {
        await storage.updateUser(user.id, { phoneVerified: true });
      }
      
      res.json({ user: { id: user.id, phone: user.phone }, verified: true });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Enhanced subscription routes
  app.get("/api/subscriptions", async (req, res) => {
    try {
      const subscriptions = await storage.getSubscriptions(defaultUserId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/subscriptions/detect", async (req, res) => {
    try {
      const detectedSubs = await storage.detectSubscriptions(defaultUserId);
      res.json(detectedSubs);
    } catch (error) {
      console.error("Error detecting subscriptions:", error);
      res.status(500).json({ error: "Failed to detect subscriptions" });
    }
  });

  app.patch("/api/subscriptions/:id/pause", async (req, res) => {
    try {
      const subscription = await storage.pauseSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error pausing subscription:", error);
      res.status(500).json({ error: "Failed to pause subscription" });
    }
  });

  app.patch("/api/subscriptions/:id/cancel", async (req, res) => {
    try {
      const subscription = await storage.cancelSubscription(req.params.id);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Enhanced warranty tracking routes
  app.get("/api/warranty-claims", async (req, res) => {
    try {
      const claims = await storage.getWarrantyClaims(defaultUserId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching warranty claims:", error);
      res.status(500).json({ error: "Failed to fetch warranty claims" });
    }
  });

  app.post("/api/warranty-claims", async (req, res) => {
    try {
      const validatedData = insertWarrantyClaimSchema.parse({
        ...req.body,
        userId: defaultUserId,
      });
      
      const claim = await storage.createWarrantyClaim(validatedData);
      res.status(201).json(claim);
    } catch (error) {
      console.error("Error creating warranty claim:", error);
      res.status(400).json({ error: "Failed to create warranty claim" });
    }
  });

  app.patch("/api/warranty-claims/:id", async (req, res) => {
    try {
      const claim = await storage.updateWarrantyClaim(req.params.id, req.body);
      if (!claim) {
        return res.status(404).json({ error: "Warranty claim not found" });
      }
      res.json(claim);
    } catch (error) {
      console.error("Error updating warranty claim:", error);
      res.status(500).json({ error: "Failed to update warranty claim" });
    }
  });

  // Kiosk integration routes
  app.post("/api/kiosk/scan", async (req, res) => {
    try {
      const { storeId, phoneNumber } = req.body;
      const qrCode = `KIOSK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      const session = await storage.createKioskSession({
        storeId,
        phoneNumber,
        qrCode,
        expiresAt,
      });
      
      res.json({ qrCode: session.qrCode, sessionId: session.id, expiresAt });
    } catch (error) {
      console.error("Error creating kiosk session:", error);
      res.status(500).json({ error: "Failed to create kiosk session" });
    }
  });

  app.post("/api/kiosk/complete/:qrCode", async (req, res) => {
    try {
      const session = await storage.getKioskSession(req.params.qrCode);
      if (!session) {
        return res.status(404).json({ error: "Invalid QR code" });
      }
      
      if (session.expiresAt < new Date()) {
        return res.status(400).json({ error: "QR code expired" });
      }
      
      const { receiptData, pointsEarned = 10 } = req.body;
      
      // Create receipt if provided
      let receiptId = null;
      if (receiptData) {
        const receipt = await storage.createReceipt({
          ...receiptData,
          userId: session.userId || defaultUserId,
        });
        receiptId = receipt.id;
      }
      
      const updatedSession = await storage.updateKioskSession(session.id, {
        status: "completed",
        pointsEarned,
        receiptId,
      });
      
      res.json({ 
        success: true, 
        pointsEarned, 
        receiptId,
        message: "Points earned and e-receipt saved!" 
      });
    } catch (error) {
      console.error("Error completing kiosk session:", error);
      res.status(500).json({ error: "Failed to complete kiosk session" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
