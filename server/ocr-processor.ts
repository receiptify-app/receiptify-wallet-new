import { createWorker } from 'tesseract.js';
import * as fs from 'fs';

interface ExtractedReceiptData {
  merchantName: string;
  location: string;
  total: string;
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
    let receiptNumber = '';
    let paymentMethod = 'Unknown';
    const items: Array<{ name: string; price: string; quantity?: number }> = [];

    // Extract merchant name (usually first few lines)
    if (lines.length > 0) {
      // Take first non-empty line as merchant
      merchantName = lines[0].length > 2 ? lines[0] : (lines[1] || '[UNKNOWN MERCHANT]');
    }

    // Look for total amount patterns
    const totalPatterns = [
      /total[:\s]*£?(\d+\.?\d*)/i,
      /amount[:\s]*£?(\d+\.?\d*)/i,
      /£(\d+\.\d{2})/g,
      /(\d+\.\d{2})/g
    ];

    for (const pattern of totalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        // Extract numbers that look like prices
        const amounts = matches.map(match => {
          const numMatch = match.match(/(\d+\.?\d*)/);
          return numMatch ? parseFloat(numMatch[1]) : 0;
        }).filter(amount => amount > 0);

        if (amounts.length > 0) {
          // Take the largest amount as the total
          total = Math.max(...amounts).toFixed(2);
          break;
        }
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

    // Extract line items (simple pattern matching)
    const itemPattern = /^(.+?)\s+£?(\d+\.?\d*)$/gm;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(text)) !== null) {
      const itemName = itemMatch[1].trim();
      const itemPrice = parseFloat(itemMatch[2]).toFixed(2);
      
      if (itemName.length > 2 && itemName.length < 50 && parseFloat(itemPrice) > 0) {
        items.push({
          name: itemName,
          price: itemPrice,
          quantity: 1
        });
      }
    }

    return {
      merchantName: merchantName.substring(0, 100), // Limit length
      location: location.substring(0, 200),
      total,
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