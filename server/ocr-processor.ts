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

    // Extract merchant name (usually first few lines, look for capitalized text)
    if (lines.length > 0) {
      // Try first 3 lines to find a good merchant name
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i];
        // Skip lines with only numbers, dates, or very short text
        if (line.length > 3 && !/^\d+$/.test(line) && !/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
          merchantName = line;
          console.log('Found merchant name:', merchantName);
          break;
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
          
          // Filter out common non-item keywords
          const lowerName = itemName.toLowerCase();
          const skipPatterns = ['total', 'subtotal', 'tax', 'vat', 'thank', 'visit', 'date:', 'phone:', 'ref:', 'receipt', 'change', 'cash', 'card'];
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
          
          // Filter out common non-item keywords
          const lowerName = itemName.toLowerCase();
          const skipPatterns = ['total', 'subtotal', 'tax', 'vat', 'thank', 'visit', 'date:', 'phone:', 'ref:', 'receipt', 'change', 'cash', 'card', 'balance', 'amount', 'due'];
          const shouldSkip = skipPatterns.some(pattern => lowerName.includes(pattern));
          
          if (!shouldSkip && itemName.length > 2 && itemName.length < 50 && parseFloat(lineTotal) > 0) {
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
      paymentMethod
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