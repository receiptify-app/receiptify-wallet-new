import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import vision from '@google-cloud/vision';
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
}

export class OCRProcessor {
  private static worker: any = null;
  private static visionClient: any = null;

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
      this.visionClient = new vision.ImageAnnotatorClient();
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
           const debugDir = path.join(process.cwd(), 'public', 'uploads', 'debug');
           fs.mkdirSync(debugDir, { recursive: true });
           const txtPath = path.join(debugDir, `ocr_text_${Date.now()}.txt`);
           fs.writeFileSync(txtPath, text, 'utf8');
           console.log('Saved debug OCR text:', txtPath);
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
    const priceGlobal = /(?:[$£€]\s*)?(\d+\.\d{2})(?!\d)/g;
    const nonItemLabels = /(gift\s*card|balance\s*due|change|voucher|points|your points|total|subtotal|tax|amount due|auth code|nectar|savings|voucher|card|amount|vat|contactless)/i;
    const discountLine = /(?:discount|% off|saving|price saving|-\d+\.\d{2})/i;
    const qtyUnitPattern = /(\d+)\s*[xX]\s*(?:[$£€]\s*)?(\d+\.\d{2})/i;
    const barcodeLike = /^(\d[\d\s-]{5,}\d)$/; // long digit sequences with spaces/dashes

    // Weight pattern: "0.404 kg @ £0.99/kg" (captures weight, unit and unit price)
    const weightPattern = /(\d+\.\d+)\s*(kg|g|lb|oz)\s*@\s*[£$€]?\s*(\d+\.\d{2})\s*\/\s*(kg|g|lb|oz)/i;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line || line.length === 0) continue;

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

      // Extract prices on this line
      priceGlobal.lastIndex = 0;
      let m: RegExpExecArray | null = null;
      const pricesOnLine: string[] = [];
      while ((m = priceGlobal.exec(line)) !== null) pricesOnLine.push(m[1]);

      // If no price on this line, check the next line (name + price on next)
      let finalPriceStr: string | null = null;
      if (pricesOnLine.length === 0 && i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        const nextPriceMatch = next.match(/(?:[$£€]\s*)?(\d+\.\d{2})(?:\s*[A-Za-z])?$/);
        if (nextPriceMatch) {
          finalPriceStr = nextPriceMatch[1];
          i++; // consume the price line
        }
      } else if (pricesOnLine.length > 0) {
        finalPriceStr = pricesOnLine[pricesOnLine.length - 1];
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

      const normalizedPrice = parseFloat(finalPriceStr).toFixed(2);
      if (parseFloat(normalizedPrice) <= 0) {
        console.log('Ignored non-positive priced line:', nameCandidate, normalizedPrice);
        continue;
      }

      items.push({ name: nameCandidate, price: normalizedPrice, quantity });
      console.log('Found item:', nameCandidate, 'Price:', normalizedPrice, 'Quantity:', quantity);
    }

    // Post-processing: remove leftover labels / numeric junk and detect payment method lines
    const filtered: typeof items = [];
    for (const it of items) {
      const lower = it.name.toLowerCase();
      // If this looks like a payment line (e.g., "card", "contactless") and price equals total, treat as paymentMethod
      if (/(card|contactless|visa|mastercard|amex|payment)/i.test(it.name) && parseFloat(it.price) === parseFloat(total)) {
        paymentMethod = it.name;
        console.log('Detected payment method from item line:', it.name);
        continue;
      }
      // Drop items that are clearly totals/amounts or barcode-like / numeric-only
      if (/^(total|amount|change|subtotal|vat|balance)$/i.test(it.name)) {
        console.log('Dropping label-like item:', it.name);
        continue;
      }
      if (/^\d[\d\s-]{4,}\d$/.test(it.name) || /^\d+(\.\d+)?$/.test(it.name)) {
        console.log('Dropping numeric-only/barcode-like item:', it.name);
        continue;
      }
      // If name is too short or mostly digits, drop
      const digits = (it.name.match(/\d/g) || []).length;
      if (it.name.length < 2 || digits / it.name.length > 0.6) {
        console.log('Dropping short or digit-heavy item:', it.name);
        continue;
      }
      filtered.push(it);
    }

    // Optional: merge obvious duplicates (same name+price)
    const merged: Array<{ name: string; price: string; quantity?: number }> = [];
    for (const it of filtered) {
      const last = merged.length ? merged[merged.length - 1] : null;
      if (last && last.name === it.name && last.price === it.price) {
        last.quantity = (last.quantity || 1) + (it.quantity || 1);
      } else {
        merged.push({ ...it });
      }
    }
    // replace items with merged result
    items.length = 0;
    items.push(...merged);

    // (Optional) further heuristics could be applied here per store format.
 
    return {
      merchantName,
      location,
      total,
      subtotal,
      tax,
      items,
      date: undefined, // Date extraction not implemented
      receiptNumber,
      paymentMethod,
    };
  }

  private static getDefaultReceiptData(): ExtractedReceiptData {
    return {
      merchantName: 'Unknown Merchant',
      location: 'Unknown Location',
      total: '0.00',
      items: [],
      date: undefined,
      receiptNumber: '',
      paymentMethod: 'Unknown',
    };
  }
}