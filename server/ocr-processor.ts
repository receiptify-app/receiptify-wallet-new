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
      const worker = await this.getWorker();
      const { data: { text } } = await worker.recognize(imagePath);
      
      console.log('OCR extracted text:', text);
      
      return this.parseReceiptText(text);
    } catch (error) {
      console.error('OCR processing error:', error);
      return this.getDefaultReceiptData();
    }
  }

  private static parseReceiptText(text: string): ExtractedReceiptData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let merchantName = '[UNKNOWN MERCHANT]';
    let location = 'Unknown Location';
    let total = '0.00';
    let subtotal: string | undefined;
    let tax: string | undefined;
    let receiptNumber = '';
    let paymentMethod = 'Unknown';
    const items: Array<{ name: string; price: string; quantity?: number }> = [];

    // Extract merchant name (usually first few lines)
    if (lines.length > 0) {
      // Take first non-empty line as merchant
      merchantName = lines[0].length > 2 ? lines[0] : (lines[1] || '[UNKNOWN MERCHANT]');
    }

    // Extract tax
    const taxPattern = /tax[:\s]*[$£]?\s*(\d+\.\d{2})/i;
    const taxMatch = text.match(taxPattern);
    if (taxMatch) {
      tax = parseFloat(taxMatch[1]).toFixed(2);
    }

    // Extract subtotal
    const subtotalPattern = /subtotal[:\s]*[$£]?\s*(\d+\.\d{2})/i;
    const subtotalMatch = text.match(subtotalPattern);
    if (subtotalMatch) {
      subtotal = parseFloat(subtotalMatch[1]).toFixed(2);
    }

    // Look for explicit total
    const totalPattern = /total[:\s]*[$£]?\s*(\d+\.\d{2})/i;
    const totalMatch = text.match(totalPattern);
    if (totalMatch) {
      total = parseFloat(totalMatch[1]).toFixed(2);
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

    // Extract line items - look for patterns like "1x Item Name $10.00" or "Item Name $10.00"
    const itemPattern = /^(?:(\d+)\s*x?\s*)?(.+?)\s+[$£]?\s*(\d+\.\d{2})$/gm;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(text)) !== null) {
      const quantity = itemMatch[1] ? parseInt(itemMatch[1]) : 1;
      const itemName = itemMatch[2].trim();
      const itemPrice = parseFloat(itemMatch[3]).toFixed(2);
      
      // Filter out common non-item lines
      const lowerName = itemName.toLowerCase();
      const skipPatterns = ['total', 'subtotal', 'tax', 'thank', 'visit', 'date:', 'phone:', 'ref:', 'receipt'];
      const shouldSkip = skipPatterns.some(pattern => lowerName.includes(pattern));
      
      if (!shouldSkip && itemName.length > 1 && itemName.length < 50 && parseFloat(itemPrice) > 0) {
        items.push({
          name: itemName,
          price: itemPrice,
          quantity: quantity
        });
      }
    }

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