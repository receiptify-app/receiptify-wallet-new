import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Prefer explicit credentials from env (no file), else keyFilename, else ADC
const visionClient = (() => {
  if (process.env.GOOGLE_CREDENTIALS) {
    // set GOOGLE_CREDENTIALS to the raw JSON string (or base64 decoded JSON)
    try {
      const creds = typeof process.env.GOOGLE_CREDENTIALS === 'string'
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
        : process.env.GOOGLE_CREDENTIALS;
      return new ImageAnnotatorClient({ credentials: creds });
    } catch (err) {
      console.warn('Failed to parse GOOGLE_CREDENTIALS env, falling back:', err);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new ImageAnnotatorClient({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
  }
  // Fallback to Application Default Credentials (e.g. GCE/GKE service account)
  return new ImageAnnotatorClient();
})();

const execFileP = promisify(execFile);

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
  category?: string;
}

export class OCRProcessor {
  private static worker: any = null;
  private static visionClient: any = null;

  private static getDefaultReceiptData(): ExtractedReceiptData {
    // Minimal safe default used when OCR fails or input is invalid
    return {
      merchantName: 'Store Receipt',
      location: 'Unknown Location',
      total: '0.00',
      subtotal: undefined,
      tax: undefined,
      items: [],
      date: undefined,
      receiptNumber: undefined,
      paymentMethod: 'Unknown',
      category: undefined,
    };
  }

  private static async getWorker() {
    if (!this.worker) {
      // createWorker may return a Promise in some installs/bundlers or an already-usable object.
      let maybeWorker: any;
      try {
        maybeWorker = createWorker();
      } catch (err) {
        // fallback: if import failed or createWorker threw, rethrow with context
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error('Failed to create tesseract worker: ' + errMsg);
      }

      if (maybeWorker && typeof maybeWorker.then === 'function') {
        // createWorker returned a Promise
        this.worker = await maybeWorker;
      } else {
        this.worker = maybeWorker;
      }

      // Guarded checks for different tesseract.js worker APIs:
      const hasLoad = this.worker && typeof this.worker.load === 'function';
      const hasLoadLanguage = this.worker && typeof this.worker.loadLanguage === 'function';
      const hasInitialize = this.worker && typeof this.worker.initialize === 'function';
      const hasSetParameters = this.worker && typeof this.worker.setParameters === 'function';
      const hasRecognize = this.worker && typeof this.worker.recognize === 'function';

      if (hasLoad && hasLoadLanguage && hasInitialize) {
        // common lifecycle (older/newer tesseract.js builds)
        await this.worker.load();
        await this.worker.loadLanguage('eng');
        await this.worker.initialize('eng');
        if (hasSetParameters) {
          await this.worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€-:/ ()@&',
            load_system_dawg: '0',
            load_freq_dawg: '0',
          });
        }
      } else if (hasInitialize) {
        // some builds expose only initialize()
        await this.worker.initialize('eng');
        if (hasSetParameters) {
          await this.worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,£$€-:/ ()@&',
            load_system_dawg: '0',
            load_freq_dawg: '0',
          });
        }
      } else if (hasRecognize) {
        // pre-initialized worker (skip lifecycle)
        console.log('Tesseract worker appears pre-initialized (skipping load/initialize).');
      } else {
        throw new Error('Tesseract worker does not expose expected API (load/initialize/recognize). Check tesseract.js installation/version.');
      }
    }
    return this.worker;
  }
  
  private static async preprocessImage(imageInput: string | Buffer): Promise<Buffer> {
    console.log('=== Starting Image Preprocessing ===');
    try {
      // Use sharp with failOnError disabled to be more tolerant of mobile formats
      let img = sharp(imageInput, { failOnError: false });
      let metadata = await img.metadata();
      console.log('Original image size:', metadata.width, 'x', metadata.height, 'format:', metadata.format);

      // If HEIF/HEIC and sharp doesn't support it we try an external conversion first.
      const looksLikeHeif = (metadata.format === 'heif') || (typeof imageInput === 'string' && /\.(heic|heif)$/i.test(imageInput));
      if (looksLikeHeif) {
        try {
          console.log('HEIF/HEIC detected — attempting external conversion (ImageMagick or heif-convert)...');
          const tmpIn = typeof imageInput === 'string'
            ? imageInput
            : path.join(os.tmpdir(), `ocr_in_${Date.now()}.heic`);
          const needCleanupIn = typeof imageInput !== 'string';
          if (needCleanupIn) {
            await fs.promises.writeFile(tmpIn, imageInput as Buffer);
          }
          const tmpOut = path.join(os.tmpdir(), `ocr_out_${Date.now()}.png`);

          // Try ImageMagick 'magick' first, then 'heif-convert'
          try {
            await execFileP('magick', [tmpIn, tmpOut]);
          } catch (e1) {
            await execFileP('heif-convert', [tmpIn, tmpOut]);
          }

          const converted = await fs.promises.readFile(tmpOut);
          // cleanup
          if (needCleanupIn) await fs.promises.unlink(tmpIn).catch(()=>{});
          await fs.promises.unlink(tmpOut).catch(()=>{});

          // replace input for sharp and re-read metadata
          imageInput = converted;
          img = sharp(imageInput, { failOnError: false });
          metadata = await img.metadata();
          console.log('External conversion successful — new format:', metadata.format);
        } catch (convErr) {
          console.warn('External HEIF conversion failed:', convErr);
         // Continue — sharp may still attempt to process and fail downstream
        }
      }
 
       // Auto-rotate based on EXIF (very important for phone photos)
       // Convert/flatten to white background to avoid alpha issues (webp/heic)
       // Ensure a reasonable minimum width so characters aren't too small for Tesseract.
       const MIN_WIDTH = 1200;
       const baseWidth = metadata.width || 1500;
       // scale up moderately but avoid excessive upscaling
       const scale = Math.min(2.0, Math.max(1.0, MIN_WIDTH / baseWidth));
       const targetWidth = Math.max(MIN_WIDTH, Math.round(baseWidth * scale));
 
      const pipeline = img
         .rotate() // respect EXIF orientation
         .flatten({ background: '#ffffff' }) // remove alpha channels
         .resize(targetWidth, undefined, { // preserve aspect ratio, ensure min width
           kernel: sharp.kernel.lanczos3,
           fit: 'inside',
         })
         .grayscale()
         .normalise()   // auto contrast
         .gamma(1.05)   // slight mid-tone boost
         // Mild denoise to remove speckles but keep stroke thickness
         .median(3)
         // Sharpen to make strokes clearer for OCR
         .sharpen({ sigma: 0.8 })
         // Do not apply hard binary threshold — it creates ultra-thin fragments that break tesseract.
         .png();
   
       const preprocessed = await pipeline.toBuffer();
       console.log('Preprocessing complete - image enhanced for OCR');
       // Debug: save preprocessed image for inspection in development
       try {
         if (process.env.NODE_ENV === 'development') {
           const debugDir = path.join(process.cwd(), 'public', 'uploads', 'debug');
           fs.mkdirSync(debugDir, { recursive: true });
           const debugPath = path.join(debugDir, `preprocessed_${Date.now()}.png`);
           fs.writeFileSync(debugPath, preprocessed);
           console.log('Saved debug preprocessed image:', debugPath);
         }
       } catch (saveErr) {
         console.warn('Failed to save debug preprocessed image:', saveErr);
       }
       return preprocessed;
    } catch (err) {
      console.error('Preprocessing failed, attempting a simpler pass:', err);
      // Fallback: try a basic conversion to PNG and return that buffer
      try {
        const fallback = await sharp(imageInput, { failOnError: false }).rotate().png().toBuffer();
        return fallback;
      } catch (err2) {
        console.error('Fallback preprocessing also failed:', err2);
        throw err2;
      }
    }
  }

  private static getVisionClient() {
    if (!this.visionClient) {
      this.visionClient = new ImageAnnotatorClient();
    }
    return this.visionClient;
  }

  private static async visionRecognize(buffer: Buffer): Promise<string> {
    try {
      const client = this.getVisionClient();
      const [result] = await client.textDetection({ image: { content: buffer } });
      const annotations = (result as any).textAnnotations;
      const text = annotations?.[0]?.description || '';
      console.log('Google Vision OCR text length:', text.length);
      return text;
    } catch (err) {
      console.error('Google Vision OCR error:', err);
      return '';
    }
  }

  private static validateReceiptText(text: string) {
    const priceRegex = /[$£€]?\s*-?\d+\.\d{2}/g;
    const prices = (text.match(priceRegex) || []).length;
    const hasCurrency = /[$£€]/.test(text);
    const hasTotalLabel = /\b(total|balance\s*due|amount\s+due|grand\s+total|subtotal|receipt|vat|change|amount payable)\b/i.test(text);
    const hasDate = /(\d{1,2}:\d{2}(?::\d{2})?)|(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b)|(\b\d{4}-\d{2}-\d{2}\b)/.test(text);
    const merchantHints = /\b(store|supermarket|sainsbury|tesco|waitrose|co-op|morrisons|restaurant|cafe|bar|hotel|booking|amazon)\b/i.test(text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    // Keep an immutable snapshot of original OCR lines for secondary passes
    const origLines = [...lines];
    // length of the raw OCR text (used by weak heuristic)
    const textLen = typeof text === 'string' ? text.length : 0;

    // Heuristics:
    // - strong: explicit total label + at least one price
    // - medium: multiple prices + merchant/store hint
    // - weak: currency present + at least one price + enough text/lines
    const strong = hasTotalLabel && prices >= 1;
    const medium = prices >= 2 && merchantHints;
    const weak = hasCurrency && prices >= 1 && textLen > 120 && lines.length >= 4;

    const isReceipt = strong || medium || weak;
    const score = (strong ? 3 : 0) + (medium ? 2 : 0) + (weak ? 1 : 0);
    return { isReceipt, score, details: { prices, hasCurrency, hasTotalLabel, hasDate, merchantHints, lines: lines.length, textLen } };
  }

  static async processReceiptImage(imagePath: string): Promise<ExtractedReceiptData> {
    try {
      console.log('=== Starting OCR Processing ===');
      console.log('Image input:', typeof imagePath === 'string' ? imagePath : `Buffer (${(imagePath as Buffer).byteLength} bytes)`);
      
      // Preprocess the image for better OCR accuracy
      const preprocessedBuffer = await this.preprocessImage(imagePath as any);
       
       const worker = await this.getWorker();
       
       // Tesseract rotation is now handled in preprocessing; call recognize with the buffer
       const recognitionPromise = worker.recognize(preprocessedBuffer);
       const timeoutPromise = new Promise((_, reject) => 
         setTimeout(() => reject(new Error('OCR timeout after 30 seconds')), 30000)
       );
       
       const result = await Promise.race([recognitionPromise, timeoutPromise]) as any;
       let text = result?.data?.text || '';
        
       // Debug: save OCR text in development
       try {
         if (process.env.NODE_ENV === 'development') {
           const { uploadBufferToGCS } = require('./storage-gcs');
           const key = `debug/ocr_text_${Date.now()}.txt`;
           await uploadBufferToGCS(Buffer.from(text, 'utf8'), key, 'text/plain');
           console.log('Uploaded debug OCR text to GCS key:', key);
         }
       } catch (saveErr) {
         console.warn('Failed to save debug OCR text:', saveErr);
       }
 
        console.log('OCR text length:', text.length);
        console.log('OCR confidence:', Math.round(result?.data?.confidence || 0));
        
        // If Tesseract produced no text or low confidence, fallback to Google Vision
        const confidence = Math.round(result?.data?.confidence || 0);
        if ((!text || text.trim().length === 0) || confidence < 55) {
          console.log('Tesseract returned empty/low-confidence text. Falling back to Google Vision OCR...');
          const visionText = await this.visionRecognize(preprocessedBuffer);
          if (visionText && visionText.trim().length > 0) {
            text = visionText;
            console.log('Using Google Vision text, length:', text.length);
            // Save vision text for debugging
            try {
              if (process.env.NODE_ENV === 'development') {
                const debugDir = path.join(process.cwd(), 'public', 'uploads', 'debug');
                const txtPath2 = path.join(debugDir, `vision_text_${Date.now()}.txt`);
                fs.writeFileSync(txtPath2, text, 'utf8');
                console.log('Saved Google Vision OCR text:', txtPath2);
              }
            } catch (saveErr) {
              console.warn('Failed to save debug Vision OCR text:', saveErr);
            }
          } else {
            console.log('Google Vision returned no text.');
          }
        }
        if (!text || text.trim().length === 0) {
          console.error('OCR returned empty text');
          return this.getDefaultReceiptData();
        }
        
        console.log('=== OCR Extracted Text ===');
        console.log(text);
        console.log('=== End OCR Text ===');

      // quick validation: reject images that don't appear to be receipts
      const validation = this.validateReceiptText(text || '');
      console.log('Receipt validation:', validation);
      if (!validation.isReceipt) {
        // throw a specific error so callers (routes) can return a 4xx and remove uploaded file
        const err: any = new Error('Not a receipt');
        err.code = 'NOT_A_RECEIPT';
        throw err;
      }

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
    // keep an immutable snapshot of original OCR lines for secondary passes
    const origLines = [...lines];
    
    let merchantName = 'Store Receipt';
    let location = 'Unknown Location';
    let total = '0.00';
    let subtotal: string | undefined;
    let tax: string | undefined;
    let receiptNumber = '';
    let paymentMethod = 'Unknown';
    let category: string | undefined = undefined;
    let date: Date | undefined = undefined;
    const items: Array<{ name: string; price: string; quantity?: number }> = [];

    // Helper regexes used by item parsing and line filtering:
    const discountLine = /\b(discount|save|savings|off|minus|reduction|promo|promotion|offer)\b/i;
    // promotional/noise patterns reused across parsing passes
    const promoNoise = /\b(you can win|enter survey|voucher|vouchers|win\s*£|win\s*\$|win|promotion|promotions|offer|free\s*voucher)\b/i;
    // weightPattern captures: [weight] [unit] @ [unitPrice], e.g. "0.404 kg @ £0.99/kg"
    const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|g|kgs|lb|lbs|l|ltr|ml)\s*@\s*[£$€]?\s*(\d+\.\d{2})/i;
    // qtyUnitPattern captures quantity and unit price like "2 x £1.65"
    const qtyUnitPattern = /(\d+)\s*[xX]\s*[£$€]?\s*(\d+\.\d{2})/;
    // nonItemLabels used to avoid treating labels as item names
    const nonItemLabels = /\b(?:total|subtotal|vat|change|balance|amount|tender|card|cash|payment|receipt|order|tax|discount|promo)\b/i;
    // barcodeLike heuristic to detect barcode / long numeric tokens
    const barcodeLike = /\b(?:\d{6,}|[A-Z0-9]{8,})\b/;

    console.log(`Parsing ${lines.length} lines of text`);

    // Extract merchant name - improved filtering for cleaner names
    if (lines.length > 0) {
      const windowSize = Math.min(10, lines.length);
      // include 'nectar' / 'price' as promo noise so lines like "Nectar Price Saving" won't win title-case heuristic
      const promoNoiseLocal = /\b(you can win|enter survey|voucher|vouchers|win\s*£|lidl plus|you saved|promotion|promotions|www\.|http|logo|nectar|price|saving|savings)\b/i;
      const priceLikeLocal = /[$£€]\s*\d|\d+\.\d{2}|\b\d+\s*[xX]\s*[$£€]?\s*\d/;
      const addrHints = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|charterhouse|high\s+street|centre|center|court|place)\b/i;
      const postcodeStrong = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i;
      const knownMerchants = /\b(sainsbury|sainsbury's|tesco|waitrose|co-?op|morrisons|aldi|lidl|spar|asda|marks&spencer|m&s|sainsburys)\b/i;

      const isLogoArtifact = (ln: string) => {
        const cleaned = ln.trim();
        if (!cleaned) return true;
        const special = (cleaned.match(/[^A-Za-z0-9\s&'-]/g) || []).length;
        const specialRatio = cleaned.length ? special / cleaned.length : 1;
        if (specialRatio > 0.35) return true;
        const singleLetterTokens = (cleaned.match(/\b[A-Za-z]\b/g) || []).length;
        const tokenCount = cleaned.split(/\s+/).filter(Boolean).length || 1;
        if (singleLetterTokens / tokenCount > 0.4) return true;
        // reject very short odd lines (likely logo/art)
        if (cleaned.length < 4 && tokenCount <= 2 && /[A-Z]/.test(cleaned)) return true;
        return false;
      };

      // title-case in receipts sometimes indicates promo headings — exclude if contains promo words
      const titleCaseLike = (ln: string) => {
        if (promoNoiseLocal.test(ln)) return false;
        return /^\s*[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+\s*$/.test(ln);
      };

      // 1) quick scan: prefer explicit known merchant tokens or possessive forms in the top 6 lines
      for (let i = 0; i < Math.min(6, lines.length); i++) {
        const l = (lines[i] || '').trim();
        if (!l) continue;
        if (promoNoiseLocal.test(l) || priceLikeLocal.test(l) || isLogoArtifact(l)) continue;
        if (knownMerchants.test(l) || /[’']s\b/i.test(l) || /\b(supermarket|supermarkets|store|co-op|mart)\b/i.test(l)) {
          merchantName = l.replace(/[^\w\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();
          console.log('Found merchant name (top-scan):', merchantName);
          break;
        }
      }

      // 2) fallback scoring inside header window if not already set
      if (!merchantName || merchantName === 'Store Receipt') {
        const candidates: { idx: number; line: string; score: number }[] = [];
        for (let i = 0; i < windowSize; i++) {
          const raw = (lines[i] || '').trim();
          if (!raw) continue;
          if (promoNoiseLocal.test(raw) || priceLikeLocal.test(raw)) continue;
          if (addrHints.test(raw) || postcodeStrong.test(raw)) continue;
          if (isLogoArtifact(raw)) continue;
          const letters = (raw.match(/[A-Za-z]/g) || []).length;
          const words = raw.split(/\s+/).filter(Boolean);
          const digitCount = (raw.match(/\d/g) || []).length;
          const special = (raw.match(/[^A-Za-z0-9\s&'-]/g) || []).length;
          const specialRatio = raw.length ? special / raw.length : 0;
          const digitRatio = raw.length ? digitCount / raw.length : 0;
          let score = letters * 2 + words.filter(w => w.length > 2).length * 3 - specialRatio * 6 - digitRatio * 6;
          if (knownMerchants.test(raw)) score += 60;
          if (/[’']s\b/i.test(raw)) score += 20;
          if (titleCaseLike(raw)) score += 12;
          if (digitRatio > 0.35) continue;
          candidates.push({ idx: i, line: raw, score });
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.score - a.score);
          merchantName = candidates[0].line.replace(/[^\w\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();
          console.log('Found merchant name (scored):', merchantName);
        }
      }

      // 3) final fallback: first reasonably alphabetic top line
      if (!merchantName || merchantName === 'Store Receipt') {
        for (let i = 0; i < Math.min(8, lines.length); i++) {
          const line = (lines[i] || '').trim();
          if (!line) continue;
          if (promoNoiseLocal.test(line) || priceLikeLocal.test(line) || addrHints.test(line) || postcodeStrong.test(line)) continue;
          if (isLogoArtifact(line)) continue;
          const letterCount = (line.match(/[A-Za-z]/g) || []).length;
          if (letterCount < 2) continue;
          merchantName = line.replace(/[^\w\s&'-]/g, ' ').replace(/\s+/g, ' ').trim();
          console.log('Found merchant name (fallback):', merchantName);
          break;
        }
      }
    }

    // --- Payment method detection (scan header/footer for explicit methods / masked cards) ---
    const detectPaymentMethod = () => {
      const maskRe = /(\*{2,}\d{2,4}|\*{4}\d{2,4}|\b\d{4}\b)/;
      const cardTypeMap: Array<[RegExp, string]> = [
        [/\bvisa\b/i, 'Visa'],
        [/\bmaster(card)?\b/i, 'Mastercard'],
        [/\bamex|american express\b/i, 'Amex'],
        [/\bmaestro\b/i, 'Maestro'],
      ];

      // 1) explicit "Gift Card" — do not append masked numbers
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;
        if (/\bgift\s*card\b|\bgiftcard\b|\bgift voucher\b/i.test(l)) {
          return 'Gift Card';
        }
      }

      // 2) masked card numbers (prefer near bottom/header) — detect type only, do NOT return numbers
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!l) continue;
        const m = l.match(maskRe);
        if (m) {
          const ctx = ((lines[i - 1] || '') + ' ' + l + ' ' + (lines[i + 1] || '')).toLowerCase();
          if (/\b(points|nectar|vat|auth code|change|receipt)\b/i.test(ctx) && !/\*/.test(m[0])) {
            continue;
          }
          let type = 'Card';
          for (const [re, name] of cardTypeMap) {
            if (re.test(ctx) || re.test(l)) { type = name; break; }
          }
          return type;
        }
      }

      // 3) explicit literals
      if (/\bcash\b/i.test(text)) return 'Cash';
      if (/\bcard\b/i.test(text) && /\bdebit\b/i.test(text)) return 'Card (Debit)';
      if (/\bcard\b/i.test(text) && /\bcredit\b/i.test(text)) return 'Card (Credit)';

      // fallback: infer from "CHANGE" with non-zero (likely cash)
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*change\b/i.test(lines[i])) {
          const amt = (lines[i].match(/[$£€]?\s*(-?\d+\.\d{2})/) || [])[1];
          if (amt && parseFloat(amt) !== 0) return 'Cash';
        }
      }
      return 'Unknown';
    };
    paymentMethod = detectPaymentMethod();
    console.log('Detected payment method:', paymentMethod);

      // --- Location extraction ---
      // Heuristic address extractor: look near the top / just after merchant name or near the bottom.
      const extractLocationFromLines = (lines: string[], merchantName?: string): string | null => {
        const streetKeywords = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|boulevard|blvd\.?|place|square|court|terrace|charterhouse|high street|center|centre|hall)\b/i;
        const postcodeUK = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i; // strong match for UK postcodes
        const loosePostcode = /[A-Z0-9]{2,4}\s*[0-9][A-Z]{2,4}/i; // looser to tolerate OCR noise
        const cityKeywords = /\b(london|manchester|birmingham|leeds|glasgow|edinburgh|cardiff|bristol|sheffield)\b/i;
        // treat common promotional lines as noise (e.g. "you can win", "enter survey", "Lidl Plus")
        const promoNoise = /\b(you can win|enter survey|voucher|vouchers|win\s*£|lidl plus|you saved|promotion|promotions)\b/i;
        const noiseIgnore = /^\s*(www\.|http|vat|phone|tel|smartshop|thank you|nectar|auth code|gift card|points|promotion)/i;
   
         // compute preferred start index (just after merchant line if found)
         let startIdx = 0;
         if (merchantName) {
           const mn = merchantName.toLowerCase().slice(0, 8);
           const mIdx = lines.findIndex(l => l && l.toLowerCase().includes(mn));
           if (mIdx >= 0) startIdx = mIdx + 1;
         }
   
         const n = lines.length;
         // build prioritized index list: merchant-adjacent window, top window, bottom window
         const makeRange = (s: number, len: number) => Array.from({ length: len }, (_, i) => s + i);
         const merchantWindow = makeRange(startIdx, 8);
         const topWindow = makeRange(0, 8);
         const bottomWindow = makeRange(Math.max(0, n - 8), Math.min(8, n));
         const idxOrder = [...merchantWindow, ...topWindow, ...bottomWindow];
   
         const seen = new Set<number>();
         for (const rawIdx of idxOrder) {
           const idx = Math.floor(rawIdx);
           if (idx < 0 || idx >= n || seen.has(idx)) continue;
           seen.add(idx);
           const rawLine = (lines[idx] || '').trim();
           if (!rawLine) continue;
           // ignore known noise patterns and promos
           if (noiseIgnore.test(rawLine) || promoNoise.test(rawLine)) continue;
   
           // Avoid picking item/product lines as the location:
           // - skip lines that contain currency/price tokens or quantity markers (e.g. "£1.75", "2 x £0.89")
           const priceLike = /[$£€]\s*\d|\d+\.\d{2}|\b\d+\s*[xX]\s*[$£€]?\s*\d/;
           if (priceLike.test(rawLine)) {
             // likely an item/price line — skip as location candidate
             continue;
           }
   
           // Accept short hyphenated locality tokens like "LON-Alperton" as location
           const hyphenatedLoc = /^[A-Za-z]{2,6}[-–—][A-Za-z0-9][A-Za-z0-9\-\s]{1,30}$/;
           if (hyphenatedLoc.test(rawLine)) {
             return rawLine.replace(/\s{2,}/g, ' ').trim();
           }
           // ignore short all-caps tokens (likely noise)
           if (/^[A-Z\s]{2,8}$/.test(rawLine) && rawLine.length < 9) continue;
   
           // prefer lines with postcode, street keyword or city
           if (postcodeUK.test(rawLine) || loosePostcode.test(rawLine) || streetKeywords.test(rawLine) || cityKeywords.test(rawLine)) {
             let out = rawLine.replace(/\s{2,}/g, ' ').trim();
             // try to append next line if it contains complementary address info (postcode/city)
             const next = (lines[idx + 1] || '').trim();
             if (next && !(promoNoise.test(next)) && (postcodeUK.test(next) || cityKeywords.test(next) || /\d{1,4}\s*[A-Z]{2,4}/i.test(next) || /[A-Za-z]+\s+[A-Za-z]+/.test(next))) {
               out = `${out} ${next.replace(/\s{2,}/g, ' ').trim()}`;
             }
             out = out.replace(/\b(www|http)[^\s]*/ig, '').replace(/\bvat number[:\s0-9-A-Za-z-]*/ig, '').trim();
             if (out && out.length > 2) return out;
           }
   
           // fallback: mixed letters+digits and reasonably long -> likely an address line
           // More conservative fallback: only accept mixed alnum lines as location if they
           // contain explicit address cues (postcode/street/city) or look like "number + street"
           const hasDigits = /\d/.test(rawLine);
           const hasLetters = /[A-Za-z]/.test(rawLine);
           const looksLikeStreet = /\b\d{1,4}\s+[A-Za-z]{3,}\b/.test(rawLine); // "33 Charterhouse"
           if ((postcodeUK.test(rawLine) || loosePostcode.test(rawLine) || streetKeywords.test(rawLine) || cityKeywords.test(rawLine) || looksLikeStreet) && !promoNoise.test(rawLine)) {
             const out = rawLine.replace(/\b(www|http)[^\s]*/ig, '').trim();
             if (!noiseIgnore.test(out)) return out;
           }
         }
   
         return null;
       };
 
      // set location from lines if possible (prefer near merchant header)
      const detectedLocation = extractLocationFromLines(lines, merchantName);
      if (detectedLocation) {
        location = detectedLocation;
        console.log('Detected location from OCR:', location);
      }
 
      // --- Date/time extraction ---
      const extractDateFromLines = (lines: string[]): Date | null => {
        const timeRe = /(\d{1,2}:\d{2}(?::\d{2})?)/;
        const dmySlashRe = /(\b\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}\b)/;             // 24/10/2025 or 24-10-2025
        const dmyTextRe = /(\b\d{1,2}\s*[A-Za-z]{3,9}\s*\d{4}\b)/i;                 // 24 Oct 2025
        const gluedRe = /\b(\d{1,2})([A-Za-z]{3,9})(\d{4})\b/;                      // 24OCT2025 or 240CT2025
        const isoRe = /\b\d{4}-\d{2}-\d{2}\b/;

        const parseDMY = (day: number, mon: number, year: number, timeParts?: string) => {
          const now = new Date();
          year = year < 100 ? 2000 + year : year;
          const dateObj = new Date(year, mon - 1, day);
          if (timeParts) {
            const tp = timeParts.split(':').map(n => parseInt(n, 10));
            dateObj.setHours(tp[0] || 0, tp[1] || 0, tp[2] || 0);
          }
          // normalize invalid dates
          if (isNaN(dateObj.getTime())) return null;
          return dateObj;
        };

        // normalize month name -> number (1-12)
        const monthMap: Record<string, number> = {
          jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12
        };

        // scan lines preferring ones with time token, then top, then bottom
        const candidates: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const l = (lines[i] || '').trim();
          if (!l) continue;
          if (timeRe.test(l)) candidates.unshift(l); // prefer lines containing time
          else candidates.push(l);
        }
        // also append bottom lines at end of preference
        const tail = lines.slice(Math.max(0, lines.length - 6));
        for (const t of tail) if (!candidates.includes(t)) candidates.push(t);

        for (const raw of candidates) {
          let line = raw.replace(/\s{2,}/g, ' ').trim();
          if (!line) continue;
          // quick attempt: detect ISO
          const isoMatch = line.match(isoRe);
          if (isoMatch) {
            const d = new Date(isoMatch[0]);
            if (!isNaN(d.getTime())) return d;
          }

          // fused glued forms (e.g. "240CT2025" or "24OCT2025") -> normalize to "24 OCT 2025"
          const gluedMatch = line.match(gluedRe);
          if (gluedMatch) {
            const day = parseInt(gluedMatch[1], 10);
            let monStr = gluedMatch[2].replace(/0/g, 'O'); // tolerate OCR 0/O confusion
            monStr = monStr.toLowerCase();
            const year = parseInt(gluedMatch[3], 10);
            const monNum = monthMap[monStr.slice(0,3)] || NaN;
            if (!isNaN(monNum)) {
              const tmatch = line.match(timeRe);
              const dateObj = parseDMY(day, monNum, year, tmatch?.[1]);
              if (dateObj) return dateObj;
            }
          }

          // date with textual month "24 Oct 2025"
          const dmyTextMatch = line.match(dmyTextRe);
          if (dmyTextMatch) {
            const parts = dmyTextMatch[1].replace(/\s+/g,' ').split(' ');
            if (parts.length >= 3) {
              const day = parseInt(parts[0], 10);
              const monKey = parts[1].toLowerCase().slice(0,3);
              const year = parseInt(parts[2], 10);
              const monNum = monthMap[monKey];
              if (monNum) {
                const tmatch = line.match(timeRe);
                const dateObj = parseDMY(day, monNum, year, tmatch?.[1]);
                if (dateObj) return dateObj;
              }
            }
          }

          // numeric D/M/Y like 24/10/2025 or 24-10-2025
          const dmySlashMatch = line.match(dmySlashRe);
          if (dmySlashMatch) {
            const parts = dmySlashMatch[1].replace(/[-\.]/g, '/').split('/');
            if (parts.length === 3) {
              let d = parseInt(parts[0], 10);
              let m = parseInt(parts[1], 10);
              let y = parseInt(parts[2], 10);
              const tmatch = line.match(timeRe);
              const dateObj = parseDMY(d, m, y, tmatch?.[1]);
              if (dateObj) return dateObj;
            }
          }

          // fallback: if line contains both a time and a 4-digit year, try to extract nearby day/month
          const tmatch = line.match(timeRe);
          const yearMatch = line.match(/\b(20\d{2})\b/);
          if (tmatch && yearMatch) {
            // try to find day and month tokens near the year
            const year = parseInt(yearMatch[1], 10);
            // try find day
            const dayMatch = line.match(/\b([0-3]?\d)\b/);
            // try find textual month
            const monthMatch = line.match(/[A-Za-z]{3,9}/);
            if (dayMatch && monthMatch) {
              const day = parseInt(dayMatch[1], 10);
              const monNum = monthMap[monthMatch[0].toLowerCase().slice(0,3)];
              if (monNum) {
                const dateObj = parseDMY(day, monNum, year, tmatch[1]);
                if (dateObj) return dateObj;
              }
            }
          }
        }
        return null;
      };

      const detectedDate = extractDateFromLines(lines);
      if (detectedDate) {
        // set parsed date (store as Date object)
        console.log('Detected date/time from OCR:', detectedDate.toISOString());
        // assign to date variable used in returned object
        // note: date in ExtractedReceiptData is optional Date
        (date as any) = detectedDate;
      }
      // --- end date/time extraction ---

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
      
      // 1) Try inline regex matches on the whole text first (same-line totals)
      for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
          total = parseFloat(match[1]).toFixed(2);
          console.log('Found total with pattern:', pattern, '=', total);
          break;
        }
      }

      // 2) If not found, scan lines for label keywords and check same line and the next line for prices.
      if (total === '0.00') {
        const labelRegex = /(balance\s*due|amount\s+due|amount\s+payable|to\s+pay|total|grand\s+total|amount payable)/i;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (labelRegex.test(line)) {
            // look for price on same line
            let m = line.match(/[$£€]\s*(\d+\.\d{2})/);
            // if not on same line, check the next non-empty line
            if (!m && i + 1 < lines.length) {
              m = lines[i + 1].match(/[$£€]\s*(\d+\.\d{2})/);
            }
            if (m) {
              total = parseFloat(m[1]).toFixed(2);
              console.log('Found total near label line:', line, '=>', total);
              break;
            }
          }
        }
      }

      // 3) If still not found, pick the largest price but avoid amounts in blacklisted contexts
      if (total === '0.00') {
        const blacklistCtx = ['points', 'savings', 'change', 'voucher', 'discount', 'nectar', 'your points', 'points are worth'];
        const candidates: Array<{ val: number; index: number; context: string }> = [];
        const priceLineRegex = /[$£€]\s*(\d+\.\d{2})/g;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // build a small context window (prev + line + next) to detect blacklisted contexts
          const context = ((lines[i - 1] || '') + ' ' + line + ' ' + (lines[i + 1] || '')).toLowerCase();
          let m: RegExpExecArray | null;
          priceLineRegex.lastIndex = 0;
          while ((m = priceLineRegex.exec(line)) !== null) {
            const val = parseFloat(m[1]);
            const blacklisted = blacklistCtx.some(b => context.includes(b));
            if (!blacklisted) {
              candidates.push({ val, index: i, context });
            } else {
              console.log('Ignored candidate price due to blacklist context:', m[0], 'context:', context);
            }
          }
        }
        if (candidates.length > 0) {
          const best = candidates.reduce((a, b) => (a.val >= b.val ? a : b));
          total = best.val.toFixed(2);
          console.log('Using largest non-blacklisted price as total:', total);
        } else {
          // final fallback: previous behavior across the whole text
          const allPrices = text.match(/[$£€]\s*(\d+\.\d{2})/g);
          if (allPrices && allPrices.length > 0) {
            const prices = allPrices.map(p => parseFloat(p.replace(/[$£€]/g, '')));
            total = Math.max(...prices).toFixed(2);
            console.log('Using largest price (final fallback) as total:', total);
          }
        }
      }
      
      // Extract items - improved parsing logic that handles:
      // - bare prices (no currency symbol)
      // - quantity expressions like "2 x £1.65" (unit price + qty) and totals on following line
      // - price split on adjacent lines (name on prev line, price on current)
      // - ignore discounts, totals, points, VAT, card lines
      // capture optional leading minus (e.g. -4.15, £-4.15) and still match normal positives
      // capture prices (digits with 2 decimals). We'll detect a leading minus/paren
      // that may appear before the currency symbol (e.g. "-£4.15") by inspecting the
      // characters immediately before the match.
      const priceGlobal = /(?:[$£€]\s*)?(-?\d+\.\d{2})(?!\d)/g;

      // Helper: extract price tokens from a line and preserve a preceding minus/paren
      const extractPricesFromLine = (ln: string) => {
        const out: string[] = [];
        priceGlobal.lastIndex = 0;
        let mm: RegExpExecArray | null = null;
        while ((mm = priceGlobal.exec(ln)) !== null) {
          const idx = mm.index;
          // look up to 3 chars before the match for common negative markers: '-' , unicode minus, or '('
          const before = ln.slice(Math.max(0, idx - 3), idx);
          const negative = /[-\u2212(]\s*$/.test(before);
          const rawVal = mm[1];
          out.push((negative ? '-' : '') + rawVal);
        }
        return out;
      };

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // Skip promotional / voucher / survey noise that sometimes gets OCR'd near items
        if (promoNoise.test(line) || /^(\*{3,}|-+|_+|#{2,})$/.test(line)) {
          console.log('Skipped promotional/noise line:', line);
          continue;
        }
        
        // Skip obvious non-item lines early
        if (/^(thank you|please|your points|promotions|check|published|www\.|vat number|receipt image|enter survey)/i.test(line)) continue;
        if (discountLine.test(line)) {
          console.log('Skipped discount/offer line:', line);
          continue;
        }

        // --- Special handling for weighed items ---
        // If this line reports weight and unit price (e.g. "0.404 kg @ £0.99/kg"),
        // then the actual item name is usually the previous non-price line and the total price
        // is often on the next line (e.g. "£0.40"). Prefer explicit total if present.
        const weightMatch = line.match(weightPattern);
        if (weightMatch) {
          const weightVal = parseFloat(weightMatch[1]);
          const unitPrice = parseFloat(weightMatch[3]);
          // Look backwards for the name (previous non-empty line that isn't a price)
          let nameFromPrev = '';
          for (let j = i - 1; j >= 0; j--) {
            const prev = lines[j].trim();
            if (!prev) continue;
            // If prev line has a price token, skip it (we want the name line)
            if (priceGlobal.test(prev)) {
              // reset lastIndex after test
              priceGlobal.lastIndex = 0;
              continue;
            }
            // use this as name candidate
            nameFromPrev = prev;
            break;
          }

          // Look ahead for explicit total price on next non-empty line
          let explicitTotal: string | null = null;
          if (i + 1 < lines.length) {
            const next = lines[i + 1].trim();
            const nextPriceMatch = next.match(/(?:[$£€]\s*)?(\d+\.\d{2})/);
            if (nextPriceMatch) {
              explicitTotal = nextPriceMatch[1];
              // consume the explicit price line
              i++;
            }
          }

          const computedTotal = +(weightVal * unitPrice).toFixed(2);
          const finalPriceStr = explicitTotal || computedTotal.toFixed(2);

          // Build clean name from nameFromPrev (fallback to "Weighed item" if missing)
          let nameCandidate = (nameFromPrev || 'Weighed item').replace(/[^\w\s&'()-]/g, ' ').replace(/\s+/g, ' ').trim();
          // Post-filters similar to other items
          const digits = (nameCandidate.match(/\d/g) || []).length;
          if (!nameCandidate || nameCandidate.length < 2 || digits / nameCandidate.length > 0.7) {
            console.log('Skipped weighed item due to poor name candidate:', nameCandidate);
          } else if (parseFloat(finalPriceStr) > 0) {
            // determine quantity = weight (use kg as quantity to keep info) and append unit to name
            const quantity = weightVal;
            const unit = weightMatch[2].toLowerCase();
            // append weight info to the name to preserve details
            nameCandidate = `${nameCandidate} (${weightVal}${unit} @ ${unitPrice.toFixed(2)}/kg)`.trim();
            items.push({ name: nameCandidate, price: parseFloat(finalPriceStr).toFixed(2), quantity });
            console.log('Found weighed item:', nameCandidate, 'Price:', finalPriceStr, 'Quantity(kg):', quantity);
          }
          // continue to next line
          continue;
        }

        // Quantity + unit price on same line
        const qtyMatch = line.match(qtyUnitPattern);
        let detectedQty: number | null = null;
        let detectedUnitPrice: number | null = null;
        if (qtyMatch) {
          detectedQty = parseInt(qtyMatch[1], 10);
          detectedUnitPrice = parseFloat(qtyMatch[2]);
        }

        // Extract prices on this line (preserving a leading minus that may appear before currency)
        const pricesOnLine = extractPricesFromLine(line);

        // Normalize a single detected price into finalPriceStr (null if none or ambiguous multiple prices)
        let finalPriceStr: string | null = null;
        if (pricesOnLine.length === 1) {
          let fp = String(pricesOnLine[0] || '').trim();
          fp = fp.replace(/\u2212/g, '-');
          // remove any currency or stray characters, keep leading minus and dot
          fp = fp.replace(/[^0-9.\-]/g, '');
          const num = parseFloat(fp);
          if (!isNaN(num)) {
            finalPriceStr = num.toFixed(2);
          }
        }

        // --- Handle multi-line / multi-price block mapping ---
        // Collect prices from current line + following contiguous lines that contain price tokens.
        const priceBlockTokens: string[] = [...pricesOnLine];
        let blockStart = i;
        let blockEnd = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextPrices = extractPricesFromLine(lines[j]);
          if (!nextPrices || nextPrices.length === 0) break;
          // include the next line's tokens and extend the block
          priceBlockTokens.push(...nextPrices);
          blockEnd = j;
        }

        if (priceBlockTokens.length > 1) {
          // gather contiguous previous lines that look like product names (no price, not promo/non-item)
          const nameCandidates: { idx: number; raw: string }[] = [];
          for (let j = blockStart - 1; j >= 0 && nameCandidates.length < priceBlockTokens.length; j--) {
            const prevRaw = lines[j].trim();
            if (!prevRaw) continue;
            // stop if previous line itself contains prices (we don't cross price blocks)
            if (extractPricesFromLine(prevRaw).length > 0) break;
            if (promoNoise.test(prevRaw) || nonItemLabels.test(prevRaw)) continue;
            if (barcodeLike.test(prevRaw) || /^[\s\d\W]+$/.test(prevRaw)) continue;
            nameCandidates.unshift({ idx: j, raw: prevRaw });
          }

          if (nameCandidates.length > 0) {
            // Map tokens -> numeric values, drop zeros and totals
            const candidatePrices = priceBlockTokens
              .map(p => {
                const v = parseFloat(String(p).replace(/[^0-9.\-]/g, ''));
                return { raw: p, val: isNaN(v) ? null : v };
              })
              .filter(p => p.val !== null && !Number.isNaN(p.val));

            // drop zero-valued tokens and tokens equal to the detected total
            const availablePrices = candidatePrices
              .filter(p => Math.abs((p.val as number)) > 0.0001)
              .filter(p => Math.abs((p.val as number) - parseFloat(total || '0')) > 0.0001);

            const mapCount = Math.min(nameCandidates.length, availablePrices.length);
            if (mapCount > 0) {
              // prefer the last N names -> last N prices (keep original ordering)
              const priceSlice = availablePrices.slice(-mapCount);
              const nameSlice = nameCandidates.slice(-mapCount);
              for (let k = 0; k < mapCount; k++) {
                const nameRaw = nameSlice[k].raw;
                let nameCandidate = nameRaw
                  .replace(/@.*$/i, '')
                  .replace(/\b\d+(\.\d+)?\s*(kg|g|ltr|l|ml)\b/gi, '')
                  .replace(/\bwith Lidl Plus\b/ig, '')
                  .replace(/\b[A-Z]\b$/g, '')
                  .replace(/[^\w\s&'()-]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (!nameCandidate || /^[\s\-\u2212$£€0-9.,()\/]+$/.test(nameCandidate) || (nameCandidate.match(/[A-Za-z]/g) || []).length < 2) {
                  continue;
                }
                const rawPrice = String(priceSlice[k].raw);
                let fp = rawPrice.trim();
                fp = fp.replace(/\u2212/g, '-').replace(/[^0-9.\-]/g, '');
                const normalizedPrice = parseFloat(fp).toFixed(2);
                if (parseFloat(normalizedPrice) === 0) continue;
                items.push({ name: nameCandidate, price: normalizedPrice, quantity: 1 });
                console.log('Mapped multi-line price block -> Found item:', nameCandidate, 'Price:', normalizedPrice);
                // blank out consumed name lines so main loop won't pick them later
                lines[nameSlice[k].idx] = '';
              }
              // advance main loop past the entire price block
              i = blockEnd;
              continue;
            }
          }
        }

        if (detectedQty && detectedUnitPrice !== null) {
          const computedTotal = +(detectedQty * detectedUnitPrice).toFixed(2);
          if (finalPriceStr) {
            const explicitTotal = parseFloat(finalPriceStr);
            finalPriceStr = (!isNaN(explicitTotal)) ? explicitTotal.toFixed(2) : computedTotal.toFixed(2);
          } else {
            finalPriceStr = computedTotal.toFixed(2);
          }
        }

        if (!finalPriceStr) continue;

        // Build name candidate (strip trailing price tokens and trailing single-letter markers)
        const priceTokenRegex = new RegExp(`\\s*(?:[$£€]\\s*)?${finalPriceStr.replace('.', '\\.')}(?:\\s*[A-Za-z])?\\s*$`);
        let namePartRaw = line.replace(priceTokenRegex, '').trim();

        // If name is empty/short, try previous line
        let nameCandidate = namePartRaw;
        if ((!nameCandidate || nameCandidate.length < 2) && i > 0) {
          const prev = lines[i - 1].trim();
          if (prev && !priceGlobal.test(prev) && prev.length > 2 && !nonItemLabels.test(prev)) {
            nameCandidate = (prev + ' ' + nameCandidate).trim();
          }
        }

        // Clean name
        nameCandidate = nameCandidate
          .replace(/@.*$/i, '')
          .replace(/\b\d+(\.\d+)?\s*(kg|g|ltr|l|ml)\b/gi, '')
          .replace(/\bwith Lidl Plus\b/ig, '')
          .replace(/\b[A-Z]\b$/g, '')
          .replace(/[^\w\s&'()-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Skip obvious price-only / noise lines (e.g. "- £4.15", "£0.00", "- 4 15")
        const priceOnlyPattern = /^[\s\-\u2212$£€0-9.,()\/]+$/;
        const letterCount = (nameCandidate.match(/[A-Za-z]/g) || []).length;
        if (!nameCandidate || priceOnlyPattern.test(nameCandidate) || letterCount < 2) {
          console.log('Skipped price-only or non-descriptive name candidate:', JSON.stringify(nameCandidate));
          continue;
        }
        // Post-filters to remove OCR junk / barcodes / numeric lines
        const digitChars = (nameCandidate.match(/\d/g) || []).length;
        const charCount = Math.max(1, nameCandidate.length);
        const digitRatio = digitChars / charCount;
        if (!nameCandidate || nameCandidate.length < 2) {
          console.log('Skipped short name candidate:', JSON.stringify(nameCandidate));
          continue;
        }
        if (/^\d+(\.\d+)?$/.test(nameCandidate) || barcodeLike.test(nameCandidate) || digitRatio > 0.6) {
          console.log('Skipped numeric/barcode-like name candidate:', nameCandidate);
          continue;
        }
        if (nonItemLabels.test(nameCandidate) || /^total$/i.test(nameCandidate) || /^card$/i.test(nameCandidate)) {
          console.log('Ignored non-item label after cleanup:', nameCandidate);
          continue;
        }

        // Determine quantity
        let quantity = 1;
        const qPrefix = nameCandidate.match(/^(\d+)\s*[xX]\s*(.+)$/);
        if (qPrefix) {
          quantity = parseInt(qPrefix[1], 10);
          nameCandidate = qPrefix[2].trim();
        } else if (detectedQty) {
          quantity = detectedQty;
        }

        // Normalize common OCR artifacts:
        // - parentheses indicate negative values e.g. "(4.15)" -> "-4.15"
        // - tolerate Unicode minus (U+2212) and convert to ASCII hyphen
        // - remove currency symbols / non-numeric chars except leading minus and dot
        let fp = String(finalPriceStr).trim();
        let negativeParen = false;
        if (/^\(.*\)$/.test(fp)) {
          negativeParen = true;
          fp = fp.replace(/[()]/g, '');
        }
        // normalize Unicode minus to ASCII hyphen (common OCR artifact)
        fp = fp.replace(/\u2212/g, '-');
        fp = fp.replace(/[^0-9.\-]/g, '');
        if (negativeParen && fp.indexOf('-') === -1) fp = '-' + fp;
        const normalizedPrice = parseFloat(fp).toFixed(2);
        // keep negative prices (discounts/refunds). Only ignore exact zero values.
        if (parseFloat(normalizedPrice) === 0) {
          console.log('Ignored zero-priced line:', nameCandidate, normalizedPrice);
          continue;
        }

        items.push({ name: nameCandidate, price: normalizedPrice, quantity });
        console.log('Found item:', nameCandidate, 'Price:', normalizedPrice, 'Quantity:', quantity);
      }

      // --- Secondary pass: attach price-only lines to preceding name lines ---
      // Find lines that look like price-only (or almost price-only) in the original OCR.
      // For each such price-only line, attempt to pair it with the nearest preceding
      // non-price, non-promo, product-like line and create an item if that name hasn't
      // already been added.
      try {
        const isPromoLine = (ln: string) => promoNoise.test(ln) || nonItemLabels.test(ln) || /^\s*(\*+|-{3,}|_+|#{2,})\s*$/.test(ln);
        const urlLike = /\b(https?:\/\/|www\.)/i;
        const phoneLike = /(?:\+?\d[\d\s\-\(\)]{6,}\d)/;
        const starsLike = /^[\*\-]{3,}$/;
        const savingsKeywords = /\b(save|saving|nectar|price saving|your savings|promotion|discount)\b/i;
        const addressLike = /\b(street|road|rd\.?|ave|avenue|charterhouse|lane|centre|center|EC|WC|W1|E1|N\d)\b/i;

        for (let idx = 0; idx < origLines.length; idx++) {
          const ln = origLines[idx];
          // price tokens (preserves leading minus)
          const priceTokens = extractPricesFromLine(ln);
          if (!priceTokens || priceTokens.length === 0) continue;
          // skip if this price-line contains descriptive alpha text (not price-only)
          const alphaCount = (ln.match(/[A-Za-z]/g) || []).length;
          if (alphaCount >= 3) continue;

          // find previous candidate name line
          let j = idx - 1;
          while (j >= 0) {
            const prevRaw = origLines[j];
            if (!prevRaw || prevRaw.trim().length === 0) { j--; continue; }
            // don't cross other price lines / price blocks
            if (extractPricesFromLine(prevRaw).length > 0) { j--; continue; }
            // skip obvious non-item lines
            if (isPromoLine(prevRaw) || urlLike.test(prevRaw) || phoneLike.test(prevRaw) || barcodeLike.test(prevRaw) || starsLike.test(prevRaw) || addressLike.test(prevRaw)) { j--; continue; }
            // avoid mapping merchant/location lines
            if (merchantName && prevRaw.toLowerCase().includes(String(merchantName).toLowerCase())) { j--; continue; }
            if (location && prevRaw.toLowerCase().includes(String(location).toLowerCase())) { j--; continue; }
            break;
          }
          if (j < 0) continue;

          const nameLine = origLines[j].trim();
          // basic name sanity checks: must have at least 2 alphabetic chars and at least one word > 2 chars
          const nameAlpha = (nameLine.match(/[A-Za-z]/g) || []).length;
          const longWord = (nameLine.match(/\b[A-Za-z]{3,}\b/) || []).length > 0;
          if (nameAlpha < 2 || !longWord) {
            // treat as non-item (e.g. "020 8566 9393" or "WWW.SITE")
            continue;
          }
          // avoid URL/phone/address/merchant being mapped
          if (urlLike.test(nameLine) || phoneLike.test(nameLine) || addressLike.test(nameLine) || isPromoLine(nameLine)) continue;

          // prefer to attach negative prices only to discount-like names
          const token = priceTokens[0];
          let fp = String(token).replace(/\u2212/g, '-').replace(/[^0-9.\-]/g, '');
          const parsed = parseFloat(fp);
          if (!isFinite(parsed) || Math.abs(parsed) < 0.0001) continue;

          // skip mapping totals/summary rows: price roughly equal to detected total or absurdly large
          const totalNum = parseFloat(total || '0');
          if (!isNaN(totalNum) && Math.abs(parsed - totalNum) < 0.01) continue;
          if (Math.abs(parsed) > Math.max(999, Math.abs(totalNum) * 10)) continue;

          if (parsed < 0 && !savingsKeywords.test(nameLine)) {
            // negative price but name doesn't look like a discount -> skip mapping
            continue;
          }

          // all checks passed -> attach
          const normalizedPrice = parsed.toFixed(2);
          items.push({ name: nameLine, price: normalizedPrice, quantity: 1 });
          console.log('Secondary-pass mapped ->', nameLine, normalizedPrice);
          // mark consumed
          origLines[j] = '';
          origLines[idx] = '';
        }
      } catch (err) {
        console.warn('Secondary pass error:', err);
      }

    return { merchantName, location, total, subtotal, tax, date, receiptNumber, paymentMethod, category, items };
  }
}