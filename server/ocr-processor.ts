import { createWorker } from 'tesseract.js';
import * as fs from 'fs';

interface ExtractedReceiptData {
  merchantName: string;
  location: string;
  total: string;
  subtotal?: string;
  tax?: string;
  items: Array<{
    name: string;
    price: string;
    quantity?: number;
  }>;
  date?: Date;
  receiptNumber?: string;
  paymentMethod?: string;
}

export class OCRProcessor {
  private static worker: any = null;

  private static async getWorker() {
    if (!this.worker) {
      this.worker = await createWorker('eng');
    }
    return this.worker;
  }

  static async processReceiptImage(imagePath: string): Promise<ExtractedReceiptData> {
    try {
      console.log('=== Starting OCR Processing ===');
      console.log('Image path:', imagePath);
      
      const worker = await this.getWorker();
      
      // Configure Tesseract for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€-:/ ',
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
      });
      
      // Add timeout and better error handling
      const recognitionPromise = worker.recognize(imagePath);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR timeout after 30 seconds')), 30000)
      );
      
      const result = await Promise.race([recognitionPromise, timeoutPromise]) as any;
      const text = result?.data?.text || '';
      
      console.log('OCR text length:', text.length);
      console.log('OCR confidence:', result?.data?.confidence || 'unknown');
      
      if (!text || text.trim().length === 0) {
        console.error('OCR returned empty text');
        return this.getDefaultReceiptData();
      }
      
      console.log('=== OCR Extracted Text ===');
      console.log(text);
      console.log('=== End OCR Text ===');
      
      const parsedData = this.parseReceiptText(text);
      console.log('=== Parsed Receipt Data ===');
      console.log(JSON.stringify(parsedData, null, 2));
      console.log('=== End Parsed Data ===');
      
      return parsedData;
    } catch (error) {
      console.error('OCR processing error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Return default data instead of throwing - prevents server crash
      return this.getDefaultReceiptData();
    }
  }

  private static parseReceiptText(text: string): ExtractedReceiptData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let merchantName = 'Store Receipt';
    let location = 'Unknown Location';
    let total = '0.00';
    let subtotal: string | undefined;
    let tax: string | undefined;
    let receiptNumber = '';
    let paymentMethod = 'Unknown';
    const items: Array<{ name: string; price: string; quantity?: number }> = [];

    console.log(`Parsing ${lines.length} lines of text`);

    // Extract merchant name - improved filtering for cleaner names
    if (lines.length > 0) {
      // Try first 5 lines to find a good merchant name
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        
        // Skip if line contains too many special characters (likely OCR noise)
        const specialCharCount = (line.match(/[^a-zA-Z0-9\s&'-]/g) || []).length;
        const totalChars = line.length;
        const specialRatio = specialCharCount / totalChars;
        
        // Skip lines with:
        // - Only numbers
        // - Dates
        // - Too many special characters (>30% of line)
        // - Very short text (< 3 chars)
        // - Too long (> 50 chars - likely not a merchant name)
        const isValidMerchantName = 
          line.length >= 3 && 
          line.length <= 50 &&
          !/^\d+$/.test(line) && 
          !/^\d{2}\/\d{2}\/\d{4}/.test(line) &&
          !/^[\d\s]+$/.test(line) &&
          specialRatio < 0.3;
        
        if (isValidMerchantName) {
          // Clean up the merchant name
          merchantName = line
            .replace(/[^\w\s&'-]/g, ' ')  // Remove special chars except &, ', -
            .replace(/\s+/g, ' ')          // Normalize whitespace
            .trim();
          
          if (merchantName.length >= 3) {
            console.log('Found merchant name:', merchantName);
            break;
          }
        }
      }
    }

    // Extract tax - support both $ and £
    const taxPattern = /(?:tax|vat)[:\s]*[$£€]?\s*(\d+\.\d{2})/i;
    const taxMatch = text.match(taxPattern);
    if (taxMatch) {
      tax = parseFloat(taxMatch[1]).toFixed(2);
      console.log('Found tax:', tax);
    }

    // Extract subtotal - support both $ and £
    const subtotalPattern = /subtotal[:\s]*[$£€]?\s*(\d+\.\d{2})/i;
    const subtotalMatch = text.match(subtotalPattern);
    if (subtotalMatch) {
      subtotal = parseFloat(subtotalMatch[1]).toFixed(2);
      console.log('Found subtotal:', subtotal);
    }

    // Look for explicit total with multiple patterns - support both $ and £
    const totalPatterns = [
      /total[:\s]*[$£€]?\s*(\d+\.\d{2})/i,
      /amount\s+due[:\s]*[$£€]?\s*(\d+\.\d{2})/i,
      /balance[:\s]*[$£€]?\s*(\d+\.\d{2})/i,
      /to\s+pay[:\s]*[$£€]?\s*(\d+\.\d{2})/i,
      /grand\s+total[:\s]*[$£€]?\s*(\d+\.\d{2})/i,
    ];
    
    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        total = parseFloat(match[1]).toFixed(2);
        console.log('Found total with pattern:', pattern, '=', total);
        break;
      }
    }
    
    // If still no total, look for any price-like number that's larger (likely the total)
    if (total === '0.00') {
      const allPrices = text.match(/[$£€]\s*(\d+\.\d{2})/g);
      if (allPrices && allPrices.length > 0) {
        const prices = allPrices.map(p => parseFloat(p.replace(/[$£€]/g, '')));
        total = Math.max(...prices).toFixed(2);
        console.log('Using largest price as total:', total);
      }
    }

    // Extract location information
    const addressPattern = /([\w\s]+(?:street|road|avenue|lane|way|drive|close|square|place|court|terrace|row)[,\s]*[\w\s]*)/i;
    const locationMatch = text.match(addressPattern);
    if (locationMatch) {
      location = locationMatch[1].trim();
    }

    // Extract receipt number
    const receiptNumPattern = /(?:receipt|ref|transaction|order)[#:\s]*([a-zA-Z0-9]+)/i;
    const receiptMatch = text.match(receiptNumPattern);
    if (receiptMatch) {
      receiptNumber = receiptMatch[1];
    }

    // Extract date
    let extractedDate: Date | undefined;
    
    // Pattern 1: "12 March 2025" or "12 Mar 2025"
    const datePattern1 = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/i;
    const dateMatch1 = text.match(datePattern1);
    if (dateMatch1) {
      const dateStr = `${dateMatch1[1]} ${dateMatch1[2]} ${dateMatch1[3]}`;
      extractedDate = new Date(dateStr);
      console.log('Found date (format 1):', dateStr, '→', extractedDate);
    }
    
    // Pattern 2: "12/03/2025" or "03/12/2025" (DD/MM/YYYY or MM/DD/YYYY)
    if (!extractedDate) {
      const datePattern2 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      const dateMatch2 = text.match(datePattern2);
      if (dateMatch2) {
        // Assume DD/MM/YYYY (UK format)
        const day = parseInt(dateMatch2[1]);
        const month = parseInt(dateMatch2[2]) - 1; // JS months are 0-indexed
        const year = parseInt(dateMatch2[3]);
        extractedDate = new Date(year, month, day);
        console.log('Found date (format 2):', `${day}/${month + 1}/${year}`, '→', extractedDate);
      }
    }
    
    // Pattern 3: "2025-03-12" (ISO format)
    if (!extractedDate) {
      const datePattern3 = /(\d{4})-(\d{2})-(\d{2})/;
      const dateMatch3 = text.match(datePattern3);
      if (dateMatch3) {
        extractedDate = new Date(dateMatch3[0]);
        console.log('Found date (format 3):', dateMatch3[0], '→', extractedDate);
      }
    }

    // Extract payment method
    if (text.toLowerCase().includes('card')) paymentMethod = 'Card';
    else if (text.toLowerCase().includes('cash')) paymentMethod = 'Cash';
    else if (text.toLowerCase().includes('contactless')) paymentMethod = 'Contactless';

    // Extract line items - support both $ and £, with and without quantity
    console.log('Extracting line items...');
    for (const line of lines) {
      // Pattern 1: Lines with quantity like "1x Item Name £7.00" or "2 Item Name $10.00"
      const qtyMatch = line.match(/^(\d+)\s*x?\s*(.+)/i);
      if (qtyMatch) {
        const quantity = parseInt(qtyMatch[1]);
        const restOfLine = qtyMatch[2].trim();
        
        // Find all prices in the line (support $, £, €)
        const priceMatches = restOfLine.match(/[$£€]\s*(\d+\.\d{2})/g);
        if (priceMatches && priceMatches.length > 0) {
          // Take the LAST price as the line total
          const lineTotal = priceMatches[priceMatches.length - 1].replace(/[$£€]/g, '').trim();
          
          // Remove all prices to get item name
          let itemName = restOfLine.replace(/[$£€]\s*\d+\.\d{2}/g, '').trim();
          
          // Remove reference numbers (long sequences of digits)
          itemName = itemName.replace(/\b\d{5,}\b/g, '').trim();
          
          // Filter out common non-item keywords
          const lowerName = itemName.toLowerCase();
          const skipPatterns = ['total', 'subtotal', 'tax', 'vat', 'thank', 'visit', 'date:', 'phone:', 'ref:', 'receipt', 'change', 'cash', 'card', 'amount', 'account'];
          const shouldSkip = skipPatterns.some(pattern => lowerName.includes(pattern));
          
          if (!shouldSkip && itemName.length > 1 && itemName.length < 50) {
            console.log(`  Item found: ${itemName} x${quantity} @ ${lineTotal}`);
            items.push({
              name: itemName,
              price: lineTotal,
              quantity: quantity
            });
          }
        }
      }
      // Pattern 2: Lines without quantity but with item name and price like "Item Name £7.00"
      else if (line.match(/[$£€]\s*\d+\.\d{2}/)) {
        const priceMatches = line.match(/[$£€]\s*(\d+\.\d{2})/g);
        if (priceMatches && priceMatches.length > 0) {
          const lineTotal = priceMatches[priceMatches.length - 1].replace(/[$£€]/g, '').trim();
          let itemName = line.replace(/[$£€]\s*\d+\.\d{2}/g, '').trim();
          
          // Remove reference numbers (long sequences of digits)
          itemName = itemName.replace(/\b\d{5,}\b/g, '').trim();
          
          // Filter out common non-item keywords
          const lowerName = itemName.toLowerCase();
          const skipPatterns = ['total', 'subtotal', 'tax', 'vat', 'thank', 'visit', 'date:', 'phone:', 'ref:', 'receipt', 'change', 'cash', 'card', 'balance', 'amount', 'due', 'paid', 'account'];
          const shouldSkip = skipPatterns.some(pattern => lowerName.includes(pattern));
          
          // Additional check: skip if item name is just "name" or similar generic words
          const tooGeneric = ['name', 'item', 'description', 'reference'].includes(lowerName);
          
          if (!shouldSkip && !tooGeneric && itemName.length > 2 && itemName.length < 50 && parseFloat(lineTotal) > 0) {
            console.log(`  Item found (no qty): ${itemName} @ ${lineTotal}`);
            items.push({
              name: itemName,
              price: lineTotal,
              quantity: 1
            });
          }
        }
      }
    }
    
    console.log(`Extracted ${items.length} items`);

    // If total wasn't found explicitly, calculate it
    if (total === '0.00' && items.length > 0) {
      const itemsTotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * (item.quantity || 1));
      }, 0);
      const taxAmount = tax ? parseFloat(tax) : 0;
      total = (itemsTotal + taxAmount).toFixed(2);
    }

    return {
      merchantName: merchantName.substring(0, 100), // Limit length
      location: location.substring(0, 200),
      total,
      subtotal,
      tax,
      items: items.slice(0, 20), // Limit items
      receiptNumber,
      paymentMethod,
      date: extractedDate
    };
  }

  private static getDefaultReceiptData(): ExtractedReceiptData {
    return {
      merchantName: '[OCR PROCESSING FAILED]',
      location: 'Unable to extract location',
      total: '0.00',
      items: [],
      paymentMethod: 'Unknown'
    };
  }

  static async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}