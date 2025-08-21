const fs = require('fs').promises;
const path = require('path');

// Google Vision API implementation
class GoogleVisionOCR {
  constructor() {
    this.apiKey = process.env.GOOGLE_VISION_KEY;
    this.endpoint = 'https://vision.googleapis.com/v1/images:annotate';
    
    if (!this.apiKey) {
      console.warn('Google Vision API key not provided, using stub implementation');
      this.isStub = true;
    }
  }
  
  async ocrExtract(filepath) {
    if (this.isStub) {
      return this.stubExtract(filepath);
    }
    
    try {
      const imageBuffer = await fs.readFile(filepath);
      const base64Image = imageBuffer.toString('base64');
      
      const requestBody = {
        requests: [{
          image: {
            content: base64Image
          },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 1
          }]
        }]
      };
      
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Google Vision API error: ${response.status}`);
      }
      
      const result = await response.json();
      const textAnnotations = result.responses[0]?.textAnnotations;
      
      if (textAnnotations && textAnnotations.length > 0) {
        return {
          text: textAnnotations[0].description,
          confidence: textAnnotations[0].confidence || 0.8
        };
      }
      
      return { text: '', confidence: 0 };
      
    } catch (error) {
      console.error('Google Vision OCR error:', error);
      return { text: '', confidence: 0, error: error.message };
    }
  }
  
  stubExtract(filepath) {
    // Generate realistic mock OCR text based on filename
    const filename = path.basename(filepath).toLowerCase();
    
    let mockText = '';
    if (filename.includes('amazon')) {
      mockText = `Amazon.com
Order #123-4567890-1234567
Order Date: December 15, 2023

Items:
Echo Dot (4th Gen) - $29.99
Shipping - $5.99

Total: $35.98

Thank you for shopping with Amazon!`;
    } else if (filename.includes('starbucks')) {
      mockText = `Starbucks Coffee
Store #12345
123 Main Street

Date: 12/15/2023 2:30 PM

Grande Latte - $5.45
Blueberry Muffin - $3.25

Subtotal: $8.70
Tax: $0.70
Total: $9.40

Thank you!`;
    } else if (filename.includes('uber')) {
      mockText = `Uber
Trip on Dec 15, 2023

From: 123 Main St
To: 456 Oak Ave

Trip Fare: $12.50
Service Fee: $2.00
Total: $14.50

Trip ID: abc123def456`;
    } else {
      mockText = `Receipt
Date: ${new Date().toLocaleDateString()}

Item 1 - $10.99
Item 2 - $5.50

Subtotal: $16.49
Tax: $1.32
Total: $17.81

Thank you for your purchase!`;
    }
    
    return {
      text: mockText,
      confidence: 0.85
    };
  }
}

// Tesseract.js implementation
class TesseractOCR {
  constructor() {
    this.tesseract = null;
    this.initTesseract();
  }
  
  async initTesseract() {
    try {
      // Note: tesseract.js would need to be installed
      // const Tesseract = require('tesseract.js');
      // this.tesseract = Tesseract;
      console.log('Tesseract OCR initialized (stub mode)');
    } catch (error) {
      console.warn('Tesseract.js not available, using stub implementation');
    }
  }
  
  async ocrExtract(filepath) {
    try {
      if (!this.tesseract) {
        return this.stubExtract(filepath);
      }
      
      // Real Tesseract implementation would go here
      /*
      const { data: { text, confidence } } = await this.tesseract.recognize(filepath, 'eng', {
        logger: m => console.log(m)
      });
      
      return { text, confidence: confidence / 100 };
      */
      
      return this.stubExtract(filepath);
      
    } catch (error) {
      console.error('Tesseract OCR error:', error);
      return { text: '', confidence: 0, error: error.message };
    }
  }
  
  stubExtract(filepath) {
    // Same stub implementation as Google Vision
    return new GoogleVisionOCR().stubExtract(filepath);
  }
}

function createOCR() {
  if (process.env.GOOGLE_VISION_KEY) {
    return new GoogleVisionOCR();
  } else {
    return new TesseractOCR();
  }
}

// Singleton instance
let ocrInstance = null;

function getOCR() {
  if (!ocrInstance) {
    ocrInstance = createOCR();
  }
  return ocrInstance;
}

async function ocrExtract(filepath) {
  const ocr = getOCR();
  return await ocr.ocrExtract(filepath);
}

module.exports = {
  ocrExtract,
  getOCR,
  GoogleVisionOCR,
  TesseractOCR
};