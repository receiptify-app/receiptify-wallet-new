import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerEmailRoutes } from "./email-routes";
import { emailOAuthRouter } from "./email-oauth";
import { forwardingInboxRouter } from "./forwarding-inbox";
import { adminRouter } from "./admin-routes";
import { ObjectStorageService, registerObjectStorageRoutes } from "./replit_integrations/object_storage";
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
import * as fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileP = promisify(execFile);
import sharp from 'sharp';
import heicConvert from 'heic-convert';

// helper: fetch GBP exchange rate for a currency and snapshot it on the receipt
async function snapshotExchangeRateToGBP(currency: string): Promise<string | null> {
  if (!currency || currency === 'GBP') return '1.00000000';
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=GBP`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const rate: number = data.rates?.GBP;
    return rate ? String(rate) : null;
  } catch {
    return null;
  }
}

// helper: safely parse date, returns valid Date or null
function safeParseDate(value: any): Date | null {
  if (!value || value === 'null' || value === 'undefined') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// helper: save buffer into public/uploads, convert HEIC/HEIF -> PNG for browser compatibility
async function saveBufferToUploads(buffer: Buffer, suggestedName?: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const base = suggestedName
    ? String(suggestedName).replace(/[^a-zA-Z0-9-_]/g, '_').replace(/\.[^.]+$/, '')
    : `proc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  // detect HEIC/HEIF by magic bytes (ftyp ... heic/heif) as a heuristic
  const header = buffer.slice(4, 12).toString('utf8').toLowerCase();
  const isHeic = header.includes('heic') || header.includes('heif');

  let finalBuf = buffer;
  let finalExt = isHeic ? 'png' : 'png'; // default to png for web

  if (isHeic) {
    // try heic-convert npm package first (most reliable in Node.js)
    try {
      const jpegBuffer = await heicConvert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.9
      });
      finalBuf = Buffer.from(jpegBuffer);
      finalExt = 'jpg';
      console.log('saveBufferToUploads: converted HEIC -> JPEG with heic-convert');
    } catch (heicConvertErr) {
      console.warn('saveBufferToUploads: heic-convert failed, trying sharp:', (heicConvertErr as any)?.message || heicConvertErr);
      
      // try sharp as fallback
      try {
        finalBuf = await sharp(buffer, { failOnError: false }).png().toBuffer();
        finalExt = 'png';
        console.log('saveBufferToUploads: converted HEIC -> PNG with sharp');
      } catch (sharpErr) {
        console.warn('saveBufferToUploads: sharp conversion also failed:', (sharpErr as any)?.message || sharpErr);
        // Save original as fallback - browser won't display but at least data is preserved
        console.warn('saveBufferToUploads: saving original HEIC as fallback (browser may not display)');
        finalBuf = buffer;
        finalExt = 'heic';
      }
    }
  }

  // write final buffer to uploads
  const filename = `${base}.${finalExt}`;
  const outPath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(outPath, finalBuf);
  console.log('saveBufferToUploads: wrote file ->', outPath, 'ext=', finalExt);
  return `/uploads/${filename}`;
}

import { authMiddleware, requireAuth, getUserId, AuthenticatedRequest } from './auth-middleware';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; name?: string; [key: string]: any };
    }
  }
}

const upload = multer({ storage: multer.memoryStorage() });

// Helper: upload buffer to Object Storage for persistent storage
async function uploadToObjectStorage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const objectStorageService = new ObjectStorageService();
  
  try {
    // Get presigned URL for upload
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    // Upload the buffer directly to Object Storage
    const response = await fetch(uploadURL, {
      method: 'PUT',
      body: buffer,
      headers: { 'Content-Type': contentType },
    });
    
    if (!response.ok) {
      throw new Error(`Object Storage upload failed: ${response.status}`);
    }
    
    // Return the normalized path for accessing the object
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    console.log(`Uploaded to Object Storage: ${objectPath}`);
    return objectPath;
  } catch (err) {
    console.error('Object Storage upload failed:', err);
    throw err;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from public directory (for uploaded receipt images - fallback)
  app.use('/uploads', express.static('public/uploads'));
  
  // Serve avatar images from attached_assets
  app.use('/assets', express.static('attached_assets'));
  
  // Authentication middleware - validates Firebase tokens and extracts user ID
  app.use(authMiddleware);
  
  // Register Object Storage routes for persistent file storage
  registerObjectStorageRoutes(app);
  
  // Register email import routes
  registerEmailRoutes(app);
  
  // Register OAuth routes
  app.use("/api/email/oauth", emailOAuthRouter);
  
  // Register forwarding inbox routes
  app.use("/api/email", forwardingInboxRouter);
  
  // Register admin routes
  app.use("/api/admin", adminRouter);

  // Get current user profile
  app.get("/api/user", async (req, res) => {
    try {
      const firebaseUid = req.user?.id;
      const userEmail = req.user?.email;
      const userName = req.user?.name;
      
      if (!firebaseUid) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Try to find existing user by Firebase providerId first (correct lookup)
      let user = await storage.getUserByProviderId('firebase', firebaseUid);
      
      // Fallback: try by email if providerId lookup fails
      if (!user && userEmail) {
        user = await storage.getUserByEmail(userEmail);
        // Update providerId if found by email but missing providerId
        if (user && !user.providerId) {
          await storage.updateUser(user.id, { providerId: firebaseUid, authProvider: 'firebase' });
        }
      }
      
      // If user doesn't exist in our DB, create them (auto-registration from Firebase / Google sign-in)
      if (!user) {
        // Build a clean base username from email prefix or display name
        const rawBase = (userEmail?.split('@')[0] || userName || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 20) || 'user';

        // Find a unique username by trying base, base_2, base_3 ...
        let candidateUsername = rawBase;
        let suffix = 2;
        while (await storage.getUserByUsername(candidateUsername)) {
          candidateUsername = `${rawBase}_${suffix}`;
          suffix++;
        }

        user = await storage.createUser({
          email: userEmail || null,
          username: candidateUsername,
          firstName: userName?.split(' ')[0] || null,
          lastName: userName?.split(' ').slice(1).join(' ') || null,
          authProvider: 'firebase',
          providerId: firebaseUid,
        });
      }
      
      // Update lastLoginAt for tracking daily/weekly active users
      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);
      
      res.json({
        id: user.id,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User',
        username: user.username,
        authProvider: user.authProvider,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.profileImageUrl,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Update user avatar
  app.patch("/api/user/display-name", async (req, res) => {
    try {
      const firebaseUid = req.user?.id;
      if (!firebaseUid) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { displayName } = req.body;
      if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        return res.status(400).json({ error: 'Display name is required' });
      }

      let user = await storage.getUserByProviderId('firebase', firebaseUid);
      if (!user) {
        // email/password users are stored with authProvider='local'
        const email = req.user?.email;
        if (email) user = await storage.getUserByEmail(email);
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const trimmed = displayName.trim();
      const spaceIdx = trimmed.indexOf(' ');
      const firstName = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const lastName  = spaceIdx === -1 ? null     : trimmed.slice(spaceIdx + 1).trim() || null;

      await storage.updateUser(user.id, { firstName, lastName } as any);

      res.json({ success: true, displayName: trimmed });
    } catch (error) {
      console.error("Error updating display name:", error);
      res.status(500).json({ error: "Failed to update display name" });
    }
  });

  app.patch("/api/user/avatar", async (req, res) => {
    try {
      const firebaseUid = req.user?.id;
      if (!firebaseUid) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { avatar } = req.body;
      if (!avatar || typeof avatar !== 'string') {
        return res.status(400).json({ error: 'Avatar URL is required' });
      }

      // Find user by Firebase providerId
      const user = await storage.getUserByProviderId('firebase', firebaseUid);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await storage.updateUser(user.id, { profileImageUrl: avatar });
      
      res.json({ success: true, avatar });
    } catch (error) {
      console.error("Error updating avatar:", error);
      res.status(500).json({ error: "Failed to update avatar" });
    }
  });

  // Track user activity for analytics (no auth required for signup tracking)
  app.post("/api/activity", async (req, res) => {
    try {
      const { activityType, metadata } = req.body;
      
      if (!activityType) {
        return res.status(400).json({ error: "activityType is required" });
      }
      
      // Generate a session ID for anonymous tracking
      const sessionId = req.headers['x-session-id'] as string || `anon_${Date.now()}`;
      
      await storage.createUserActivity({
        userId: sessionId,
        activityType,
        metadata: metadata || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking activity:", error);
      res.status(500).json({ error: "Failed to track activity" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/spending", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { period = 'month' } = req.query;
      
      // Get current month's date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const receipts = await storage.getReceipts(userId, {
        startDate: startOfMonth,
        endDate: endOfMonth,
      });
      
      // Aggregate by category
      const categoryTotals: { [key: string]: number } = {};
      let totalSpending = 0;
      
      for (const receipt of receipts) {
        const category = receipt.category || 'Other';
        const amount = parseFloat(receipt.total);
        
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        totalSpending += amount;
      }
      
      // Format response
      const spendingData = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount: parseFloat(amount.toFixed(2)),
        percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
      }));
      
      res.json({
        period: 'This month',
        total: parseFloat(totalSpending.toFixed(2)),
        categories: spendingData,
        receipts: receipts.map(r => ({
          id: r.id,
          merchant: r.merchantName,
          amount: parseFloat(r.total).toFixed(2),
          date: r.date,
          category: r.category,
        })),
      });
    } catch (error) {
      console.error("Error fetching spending analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Receipt routes
  app.get("/api/receipts/process", async (req, res) => {
    try {
      const { category, merchant, startDate, endDate, minAmount, maxAmount } = req.query;
      
      const filters: any = {};
      if (category && typeof category === 'string') filters.category = category;
      if (merchant && typeof merchant === 'string') filters.merchantName = merchant;
      if (startDate && typeof startDate === 'string') filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === 'string') filters.endDate = new Date(endDate);
      if (minAmount && typeof minAmount === 'string') filters.minAmount = parseFloat(minAmount);
      if (maxAmount && typeof maxAmount === 'string') filters.maxAmount = parseFloat(maxAmount);

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const receipts = await storage.getReceipts(userId, filters);
      
      // Attach items to each receipt
      const receiptsWithItems = await Promise.all(
        receipts.map(async (receipt) => {
          const items = await storage.getReceiptItems(receipt.id);
          return { ...receipt, items };
        })
      );
      
      res.json(receiptsWithItems);
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Convert date string to Date object if needed
      const receiptData = { ...req.body, userId };
      if (receiptData.date && typeof receiptData.date === 'string') {
        receiptData.date = new Date(receiptData.date);
      }
      
      // Convert numeric fields to strings for decimal columns
      const numericFields = ['total', 'subtotal', 'tax', 'latitude', 'longitude'];
      for (const field of numericFields) {
        if (typeof receiptData[field] === 'number') {
          receiptData[field] = String(receiptData[field]);
        }
      }
      
      if (!receiptData.exchangeRateToGBP) {
        receiptData.exchangeRateToGBP = await snapshotExchangeRateToGBP(receiptData.currency || 'GBP');
      }

      const validatedData = insertReceiptSchema.parse(receiptData);
      
      const receipt = await storage.createReceipt(validatedData);
      
      // Process items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          // Convert numeric fields to strings for decimal columns
          const itemData = {
            ...item,
            receiptId: receipt.id,
            price: typeof item.price === 'number' ? String(item.price) : item.price,
            quantity: typeof item.quantity === 'number' ? String(item.quantity) : item.quantity,
          };
          const validatedItem = insertReceiptItemSchema.parse(itemData);
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Process the receipt image with OCR
      console.log(`Processing uploaded receipt image: ${req.file.originalname}`);
      console.log(`Image size: ${req.file.size} bytes`);
      
      // Save the image permanently (choose extension based on conversion)
      const timestamp = Date.now();
      const origBase = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '');
      // Will adjust ext to 'png' when we convert HEIC/HEIF
      let ext = path.extname(req.file.originalname).replace(/^\./, '') || 'jpg';
      let filename = `${timestamp}_${origBase}.${ext}`;
      let permanentPath = `public/uploads/${filename}`;
      let imageUrl = `/uploads/${filename}`;
 
       // Create uploads directory if it doesn't exist
       if (!fs.existsSync('public/uploads')) {
         fs.mkdirSync('public/uploads', { recursive: true });
       }
       
       // Save the uploaded file permanently, converting HEIC/HEIF to PNG if needed
       const origLower = (req.file.originalname || '').toLowerCase();
       const isHeic = /\.(heic|heif)$/i.test(origLower) || req.file.mimetype === 'image/heif' || req.file.mimetype === 'image/heic';
       
       if (isHeic) {
         console.log('HEIC/HEIF upload detected — attempting conversion before saving');
         let converted = false;
         
         // Try heic-convert npm package first (most reliable in Node.js)
         try {
           const jpegBuffer = await heicConvert({
             buffer: req.file.buffer,
             format: 'JPEG',
             quality: 0.9
           });
           ext = 'jpg';
           filename = `${timestamp}_${origBase}.${ext}`;
           permanentPath = `public/uploads/${filename}`;
           imageUrl = `/uploads/${filename}`;
           fs.writeFileSync(permanentPath, Buffer.from(jpegBuffer));
           console.log(`Converted HEIC -> JPEG (heic-convert) and saved to: ${permanentPath}`);
           converted = true;
         } catch (heicConvertErr) {
           console.warn('heic-convert failed, trying sharp:', (heicConvertErr as any)?.message || heicConvertErr);
           
           // Try sharp as fallback
           try {
             const pngBuffer = await sharp(req.file.buffer, { failOnError: false }).png().toBuffer();
             ext = 'png';
             filename = `${timestamp}_${origBase}.${ext}`;
             permanentPath = `public/uploads/${filename}`;
             imageUrl = `/uploads/${filename}`;
             fs.writeFileSync(permanentPath, pngBuffer);
             console.log(`Converted HEIC -> PNG (sharp) and saved to: ${permanentPath}`);
             converted = true;
           } catch (sharpErr) {
             console.warn('Sharp conversion also failed:', (sharpErr as any)?.message || sharpErr);
           }
         }
         
         if (!converted) {
           // Save original as fallback - browser won't display but data is preserved
           console.warn('All HEIC converters failed, saving original buffer as fallback');
           ext = path.extname(req.file.originalname).replace(/^\./, '') || 'heic';
           filename = `${timestamp}_${origBase}.${ext}`;
           permanentPath = `public/uploads/${filename}`;
           imageUrl = `/uploads/${filename}`;
           fs.writeFileSync(permanentPath, req.file.buffer);
         }
       } else {
         fs.writeFileSync(permanentPath, req.file.buffer);
         console.log(`Receipt image saved to: ${permanentPath}`);
       }
      
       try {
         // Extract real data from the receipt image using Gemini AI (primary) or Tesseract OCR (fallback)
         let extractedData;
         let geminiSucceeded = false;
         
         // Try Gemini AI first - it provides better receipt understanding
         try {
           console.log('Attempting receipt extraction with Gemini AI...');
           const { processReceiptWithGemini } = await import('./gemini-receipt-processor').catch(() => ({} as any));
           
           if (typeof processReceiptWithGemini === 'function') {
             extractedData = await processReceiptWithGemini(permanentPath);
             console.log('Gemini AI extraction successful');
             geminiSucceeded = true;
           } else {
             throw new Error('Gemini processor not available');
           }
         } catch (geminiErr: any) {
           // Check if Gemini explicitly determined this is NOT a receipt
           if (geminiErr?.code === 'NOT_A_RECEIPT' || /NOT_A_RECEIPT/i.test(String(geminiErr?.message || ''))) {
             await fs.promises.unlink(permanentPath).catch(()=>{});
             console.warn('Upload rejected - Gemini determined image is not a receipt');
             return res.status(400).json({ error: 'Uploaded image does not appear to contain a receipt' });
           }
           
           console.warn('Gemini extraction failed, falling back to Tesseract OCR:', geminiErr?.message || geminiErr);
           
           // Fallback to Tesseract OCR - DO NOT delete the image yet
           try {
             const { OCRProcessor } = await import('./ocr-processor').catch(() => ({} as any));
             if (typeof OCRProcessor?.processReceiptImage !== 'function') {
               throw new Error('OCRProcessor.processReceiptImage not available');
             }
             extractedData = await OCRProcessor.processReceiptImage(permanentPath);
           } catch (ocrErr: any) {
             // If OCR explicitly determined this is not a receipt, clean up and return 400
             if (ocrErr && (ocrErr.code === 'NOT_A_RECEIPT' || /Not a receipt/i.test(String(ocrErr.message || '')))) {
               await fs.promises.unlink(permanentPath).catch(()=>{});
               console.warn('Upload rejected - image does not appear to contain a receipt');
               return res.status(400).json({ error: 'Uploaded image does not appear to contain a receipt' });
             }
             throw ocrErr;
           }
         }

        // Defensive check: processReceiptImage may return a default "empty" object.
        if ((!extractedData.items || extractedData.items.length === 0) &&
            extractedData.total === '0.00' &&
            /unknown/i.test(String(extractedData.merchantName || ''))) {
          await fs.promises.unlink(permanentPath).catch(()=>{});
          console.warn('Upload rejected - OCR produced default/empty receipt data');
          return res.status(400).json({ error: 'Uploaded image does not appear to contain a receipt' });
        }

        console.log('Extracted receipt data:', extractedData);

        // Upload image to persistent Object Storage
        let persistentImageUrl = imageUrl;
        try {
          const localBuffer = await fs.promises.readFile(permanentPath);
          const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/jpeg';
          persistentImageUrl = await uploadToObjectStorage(localBuffer, filename, contentType);
          console.log(`Image uploaded to persistent storage: ${persistentImageUrl}`);
          // Clean up local file after successful upload to Object Storage
          await fs.promises.unlink(permanentPath).catch(() => {});
        } catch (storageErr) {
          console.warn('Object Storage upload failed, keeping local file as fallback:', storageErr);
          // Keep local imageUrl as fallback
        }

        // sanitize parsed OCR output before saving
        const sanitized = sanitizeParsedForDb(extractedData || {});

        const receiptData = {
          userId,
          merchantName: sanitized.merchantName || 'Unknown Merchant',
          location: sanitized.location || null,
          total: sanitized.total !== null ? String(sanitized.total) : '0.00',
          subtotal: sanitized.subtotal !== null ? String(sanitized.subtotal) : undefined,
          tax: sanitized.tax !== null ? String(sanitized.tax) : undefined,
          date: safeParseDate(sanitized.date) || new Date(),
          category: sanitized.category || 'Shopping',
          paymentMethod: sanitized.paymentMethod || 'Unknown',
          receiptNumber: sanitized.receiptNumber || `OCR${Date.now()}`,
          imageUrl: persistentImageUrl,
          ecoPoints: 1,
          currency: sanitized.currency || 'GBP',
          exchangeRateToGBP: await snapshotExchangeRateToGBP(sanitized.currency || 'GBP'),
        };

        const receipt = await storage.createReceipt(receiptData);
        
        // Add extracted items if any
        for (const item of extractedData.items) {
          try {
            await storage.createReceiptItem({
              receiptId: receipt.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity?.toString() || "1",
              category: "Other"
            });
          } catch (error) {
            console.error('Error adding receipt item:', error);
          }
        }
        
        res.status(201).json(receipt);
      } catch (error) {
        console.error('OCR processing error:', error);
        
        // Fallback: create basic receipt with OCR error indication but keep the image
        console.log('OCR extraction failed, creating placeholder receipt with image');
        
        // Still try to upload to Object Storage for persistence
        let persistentImageUrl = imageUrl;
        try {
          const localBuffer = await fs.promises.readFile(permanentPath);
          const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/jpeg';
          persistentImageUrl = await uploadToObjectStorage(localBuffer, filename, contentType);
          await fs.promises.unlink(permanentPath).catch(() => {});
        } catch (storageErr) {
          console.warn('Object Storage upload failed in fallback:', storageErr);
        }
        
        const receiptData = {
          userId,
          merchantName: "Receipt (OCR Failed)",
          location: "Unknown Location", 
          total: "0.00",
          date: new Date(),
          category: "Other",
          paymentMethod: "Unknown",
          receiptNumber: `ERR${Date.now()}`,
          imageUrl: persistentImageUrl,
          ecoPoints: 1
        };
        
        const receipt = await storage.createReceipt(receiptData);
        
        res.status(201).json(receipt);
      }
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(400).json({ error: "Failed to process receipt" });
    }
  });

  // QR Code processing endpoint
  app.post("/api/receipts/qr", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
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
        userId,
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

  // Update receipt category
  app.post("/api/receipts/:id/move", async (req, res) => {
    try {
      const { categoryId } = req.body;
      if (!categoryId) {
        return res.status(400).json({ error: "Category ID is required" });
      }

      const receipt = await storage.updateReceipt(req.params.id, { category: categoryId });
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      res.json(receipt);
    } catch (error) {
      console.error("Error moving receipt:", error);
      res.status(500).json({ error: "Failed to move receipt" });
    }
  });

  // Bulk move receipts to category
  app.post("/api/receipts/bulk-move", async (req, res) => {
    try {
      const { receiptIds, categoryId } = req.body;
      
      if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
        return res.status(400).json({ error: "Receipt IDs array is required" });
      }
      if (!categoryId) {
        return res.status(400).json({ error: "Category ID is required" });
      }

      const updatedReceipts = [];
      for (const receiptId of receiptIds) {
        const receipt = await storage.updateReceipt(receiptId, { category: categoryId });
        if (receipt) {
          updatedReceipts.push(receipt);
        }
      }

      res.json({ 
        success: true, 
        updated: updatedReceipts.length,
        receipts: updatedReceipts 
      });
    } catch (error) {
      console.error("Error bulk moving receipts:", error);
      res.status(500).json({ error: "Failed to bulk move receipts" });
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: "Search query required" });
      }

      const receipts = await storage.searchReceipts(userId, q);
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const validatedData = insertSplitSchema.parse({
        ...req.body,
        receiptId: req.params.id,
        userId,
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Simulate QR code receipt data
      const mockReceiptData = {
        userId,
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

  // Username availability check (public, no auth needed)
  app.get("/api/check-username", async (req, res) => {
    const username = (req.query.username as string || "").trim().toLowerCase();
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: "Username must be at least 3 characters" });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: "Username can only contain letters, numbers, and underscores" });
    }
    const existing = await storage.getUserByUsername(username);
    return res.json({ available: !existing });
  });

  // Email availability check (public, no auth needed)
  app.get("/api/check-email", async (req, res) => {
    const email = (req.query.email as string || "").trim().toLowerCase();
    if (!email) return res.json({ available: false });
    const existing = await storage.getUserByEmail(email);
    return res.json({ available: !existing });
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const email = validatedData.email;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Valid email is required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // User already exists (created by the /api/user auto-registration race).
        // Update their username with the one they explicitly chose during signup,
        // but only if the chosen username isn't already taken by someone else.
        const chosenUsername = validatedData.username;
        const updates: any = {
          authProvider: 'local',
          providerId: validatedData.providerId,
        };
        if (validatedData.firstName) updates.firstName = validatedData.firstName;
        if (validatedData.lastName) updates.lastName = validatedData.lastName;
        if (chosenUsername && chosenUsername !== existingUser.username) {
          const usernameOwner = await storage.getUserByUsername(chosenUsername);
          if (!usernameOwner || usernameOwner.id === existingUser.id) {
            updates.username = chosenUsername;
          }
        }
        await storage.updateUser(existingUser.id, updates);
        return res.status(200).json({ user: { id: existingUser.id, email: existingUser.email, username: updates.username || existingUser.username } });
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
      
      // Update last login time — cast to any because storage.updateUser's partial type doesn't include lastLoginAt
      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);
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
          userId: session.userId || req.user?.id || 'anonymous',
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

  // Receipt design customization routes
  app.get("/api/receipt-designs", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const designs = await storage.getReceiptDesigns(userId);
      res.json(designs);
    } catch (error) {
      console.error("Error getting receipt designs:", error);
      res.status(500).json({ error: "Failed to get receipt designs" });
    }
  });

  app.get("/api/receipt-designs/default", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }
      
      const design = await storage.getDefaultReceiptDesign(userId);
      res.json(design);
    } catch (error) {
      console.error("Error getting default receipt design:", error);
      res.status(500).json({ error: "Failed to get default receipt design" });
    }
  });

  app.post("/api/receipt-designs", async (req, res) => {
    try {
      const { userId, name, isDefault, ...designSettings } = req.body;
      
      if (!userId || !name) {
        return res.status(400).json({ error: "User ID and name are required" });
      }

      const design = await storage.createReceiptDesign({
        userId,
        name,
        isDefault: isDefault || false,
        ...designSettings
      });
      
      res.status(201).json(design);
    } catch (error) {
      console.error("Error creating receipt design:", error);
      res.status(500).json({ error: "Failed to create receipt design" });
    }
  });

  app.put("/api/receipt-designs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const design = await storage.updateReceiptDesign(id, updates);
      res.json(design);
    } catch (error) {
      console.error("Error updating receipt design:", error);
      res.status(500).json({ error: "Failed to update receipt design" });
    }
  });

  app.delete("/api/receipt-designs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReceiptDesign(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting receipt design:", error);
      res.status(500).json({ error: "Failed to delete receipt design" });
    }
  });

  app.post('/api/receipts/process', async (req, res) => {
    console.log('POST /api/receipts/process - body:', req.body);
    try {
      const { path } = req.body || {};
      if (!path) {
        console.warn('No storage path provided in request body');
        return res.status(400).json({ error: 'Missing path' });
      }

      // try to download the file from storage
      let buffer: Buffer | null = null;
      try {
        // if you have a helper export, use it; otherwise log the attempt
        const { downloadBufferFromStorage } = await import('./firebase-storage').catch(() => ({} as any));
        if (typeof downloadBufferFromStorage === 'function') {
          buffer = await downloadBufferFromStorage(path);
          console.log('Downloaded bytes from storage:', buffer?.length);
        } else {
          console.warn('downloadBufferFromStorage helper not found - cannot download file for processing');
        }
      } catch (dlErr) {
        console.error('Error downloading from storage:', dlErr);
        throw dlErr;
      }

      // Persist downloaded image into public/uploads so UI can load it (convert HEIC/HEIF -> PNG)
      let savedImageUrl: string | null = null;
      try {
        if (buffer) {
          const uploadsDir = 'public/uploads';
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

          // derive extension from storage path string (req body uses `path`)
          const extMatch = String(path || '').toLowerCase().match(/\.(jpg|jpeg|png|webp|heic|heif)$/);
          let ext = extMatch ? extMatch[0].replace(/^\./, '') : 'png';
          let outBuf = buffer;

          if (ext === 'heic' || ext === 'heif') {
            try {
              outBuf = await sharp(buffer, { failOnError: false }).png().toBuffer();
              ext = 'png';
            } catch (convErr) {
              console.warn('HEIC -> PNG conversion failed, saving original buffer:', (convErr as any)?.message ?? String(convErr));
              // fall back to original buffer and original ext (may not display in some browsers)
            }
          }

          const filename = `proc_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
          const outPath = `${uploadsDir}/${filename}`;
          await fs.promises.writeFile(outPath, outBuf);
          savedImageUrl = await saveBufferToUploads(outBuf, filename);
          console.log('Saved processing image for UI at:', outPath);
        }
      } catch (saveImgErr) {
        console.error('Failed to persist downloaded image for UI:', saveImgErr);
      }

      // run OCR/processing if we have buffer
      let parsed: any = null;
      try {
        if (!buffer) {
          console.warn('No buffer available to run OCRProcessor');
        } else {
          const { OCRProcessor } = await import('./ocr-processor').catch(() => ({} as any));
          if (typeof OCRProcessor?.processReceiptImage === 'function') {
            parsed = await OCRProcessor.processReceiptImage(buffer);
            // attach saved image url so downstream save logic persists it
            if (savedImageUrl && parsed) parsed.imageUrl = parsed.imageUrl || savedImageUrl;
            console.log('Attached imageUrl to parsed result:', parsed?.imageUrl);
            console.log('OCRProcessor parsed object:', parsed);
          } else {
            console.warn('OCRProcessor.processReceiptImage not available');
          }
        }
      } catch (ocrErr) {
        console.error('OCR processing error:', ocrErr);
        throw ocrErr;
      }

      if (!parsed) {
        console.warn('No parsed result produced');
        return res.status(200).json({ ok: true, parsed: null });
      }

      // ensure a date exists (analytics/filtering often depends on this)
      if (!parsed.date) {
        parsed.date = new Date().toISOString();
        console.log('Assigned fallback date to parsed receipt:', parsed.date);
      }

      // sanitize parsed result before saving to DB/storage
      const parsedForDb = sanitizeParsedForDb(parsed || {});

       // attempt to save parsed result if a save helper exists (optional)
       let saved = null;
       try {
         let maybe: any = {};
         // try dynamic helper first (keeps current behaviour)
         maybe = await import('./receipt-save').catch(() => ({} as any));
         const saveFn = maybe?.saveParsedReceiptToDb || (global as any).saveParsedReceiptToDb;
         if (typeof saveFn === 'function') {
          saved = await saveFn(parsedForDb);
           console.log('Saved receipt to DB via helper:', saved?.id ?? saved);
         } else {
           // Fallback: persist using storage API so parsed receipts are visible in UI
           console.log('No DB save helper found; falling back to storage.createReceipt');
           const userId = req.user?.id;
           if (!userId) {
             console.warn('No authenticated user for receipt save');
             return res.status(401).json({ error: 'Authentication required' });
           }
           const receiptData = {
            userId,
            merchantName: parsedForDb.merchantName || 'Unknown Merchant',
            location: parsedForDb.location || null,
            total: parsedForDb.total !== null ? String(parsedForDb.total) : '0.00',
            subtotal: parsedForDb.subtotal !== null ? String(parsedForDb.subtotal) : undefined,
            tax: parsedForDb.tax !== null ? String(parsedForDb.tax) : undefined,
            date: safeParseDate(parsedForDb.date) || new Date(),
            category: parsedForDb.category || 'Shopping',
            paymentMethod: parsedForDb.paymentMethod || 'Unknown',
            receiptNumber: parsedForDb.receiptNumber || `PROC${Date.now()}`,
            imageUrl: parsedForDb.imageUrl || null,
            ecoPoints: 1
           };
 
           const receipt = await storage.createReceipt(receiptData);
           // attach any items if present
           if (Array.isArray(parsed.items) && parsed.items.length > 0) {
             for (const it of parsed.items) {
               try {
                 await storage.createReceiptItem({
                   receiptId: receipt.id,
                   name: it.name || 'Item',
                   price: it.price || '0.00',
                   quantity: (it.quantity ?? 1).toString(),
                   category: 'Other'
                 });
               } catch (itemErr) {
                 console.error('Error creating receipt item (fallback):', itemErr);
               }
             }
           }
           saved = receipt;
           console.log('Saved receipt via storage.createReceipt:', saved.id);
         }
       } catch (saveErr) {
         console.error('Error saving parsed receipt:', saveErr);
       }

      return res.status(200).json({ ok: true, parsed, saved });
    } catch (err) {
      console.error('Error in /api/receipts/process:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/receipts', async (req, res) => {
    const userId = (req as any).user?.id;
    console.log('GET /api/receipts - userId:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Load receipts directly from PostgreSQL (indexed for fast user queries)
    try {
      const receipts = await storage.getReceipts(userId);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });

  // Warranty routes
  app.get('/api/warranties', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const warranties = await storage.getWarranties(userId);
      res.json(warranties);
    } catch (error) {
      console.error("Error fetching warranties:", error);
      res.status(500).json({ error: "Failed to fetch warranties" });
    }
  });

  app.get('/api/warranties/receipt/:receiptId', async (req, res) => {
    const userId = (req as any).user?.id;
    const { receiptId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const warranty = await storage.getWarrantyByReceiptId(receiptId, userId);
      res.json(warranty || null);
    } catch (error) {
      console.error("Error fetching warranty:", error);
      res.status(500).json({ error: "Failed to fetch warranty" });
    }
  });

  app.post('/api/warranties', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const { receiptId, productName, durationMonths, warrantyType, notes } = req.body;
      
      if (!receiptId || !productName || !durationMonths) {
        return res.status(400).json({ error: 'Missing required fields: receiptId, productName, durationMonths' });
      }
      
      // Get the receipt to use its date as warranty start date
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ error: 'Receipt not found' });
      }
      
      // Verify the receipt belongs to this user (critical ownership check)
      if (receipt.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden: Receipt does not belong to this user' });
      }
      
      // Check if warranty already exists for this receipt
      const existingWarranty = await storage.getWarrantyByReceiptId(receiptId, userId);
      if (existingWarranty) {
        return res.status(409).json({ error: 'Warranty already exists for this receipt' });
      }
      
      const warrantyStartDate = receipt.date || new Date();
      const warrantyEndDate = new Date(warrantyStartDate);
      warrantyEndDate.setMonth(warrantyEndDate.getMonth() + durationMonths);
      
      const warranty = await storage.createWarranty({
        userId,
        receiptId,
        productName,
        retailerName: receipt.merchantName || 'Unknown',
        purchaseDate: receipt.date || new Date(),
        warrantyStartDate,
        warrantyEndDate,
        warrantyPeriodMonths: durationMonths,
        warrantyType: warrantyType || 'manufacturer',
        warrantyTerms: notes || null,
        isActive: true,
      });
      
      res.status(201).json(warranty);
    } catch (error) {
      console.error("Error creating warranty:", error);
      res.status(500).json({ error: "Failed to create warranty" });
    }
  });

  app.patch('/api/warranties/:id', async (req, res) => {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      // First verify ownership by checking warranty belongs to user
      const warranties = await storage.getWarranties(userId);
      const existingWarranty = warranties.find(w => w.id === id);
      
      if (!existingWarranty) {
        return res.status(404).json({ error: 'Warranty not found or access denied' });
      }
      
      // Additional check: verify the warranty's userId matches
      if (existingWarranty.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden: Warranty does not belong to this user' });
      }
      
      const { productName, durationMonths, warrantyType, notes } = req.body;
      
      const updates: any = {};
      if (productName) updates.productName = productName;
      if (warrantyType) updates.warrantyType = warrantyType;
      if (notes !== undefined) updates.warrantyTerms = notes;
      
      // If duration changed, recalculate end date
      if (durationMonths) {
        const warrantyEndDate = new Date(existingWarranty.warrantyStartDate);
        warrantyEndDate.setMonth(warrantyEndDate.getMonth() + durationMonths);
        updates.warrantyEndDate = warrantyEndDate;
        updates.warrantyPeriodMonths = durationMonths;
      }
      
      const warranty = await storage.updateWarranty(id, updates, userId);
      if (!warranty) {
        return res.status(404).json({ error: 'Warranty not found' });
      }
      
      res.json(warranty);
    } catch (error) {
      console.error("Error updating warranty:", error);
      res.status(500).json({ error: "Failed to update warranty" });
    }
  });

  app.delete('/api/warranties/:id', async (req, res) => {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      // Verify ownership by checking warranty belongs to user
      const warranties = await storage.getWarranties(userId);
      const existingWarranty = warranties.find(w => w.id === id);
      
      if (!existingWarranty) {
        return res.status(404).json({ error: 'Warranty not found or access denied' });
      }
      
      // Additional check: verify the warranty's userId matches
      if (existingWarranty.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden: Warranty does not belong to this user' });
      }
      
      const deleted = await storage.deleteWarranty(id, userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Warranty not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting warranty:", error);
      res.status(500).json({ error: "Failed to delete warranty" });
    }
  });

  function sanitizeParsedForDb(parsed: any) {
    if (!parsed || typeof parsed !== 'object') return parsed;
    const copy: any = { ...parsed };

    const toNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const s = v.trim();
        if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'n/a') return null;
        const n = parseFloat(s.replace(/[^\d\-\.\+]/g, ''));
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };

    copy.total = toNum(copy.total);
    copy.subtotal = toNum(copy.subtotal);
    copy.tax = toNum(copy.tax);
    copy.confidence = toNum(copy.confidence);

    if (copy.items && Array.isArray(copy.items)) {
      copy.items = copy.items.map((it: any) => ({
        name: it?.name || '',
        price: toNum(it?.price),
        quantity: it?.quantity ? Number(it.quantity) || 1 : 1
      }));
    }

    if (typeof copy.date === 'string') {
      const d = new Date(copy.date);
      copy.date = isNaN(d.getTime()) ? null : d.toISOString();
    }

    return copy;
  }

  const httpServer = createServer(app);
  return httpServer;
}