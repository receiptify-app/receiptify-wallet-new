import * as cheerio from 'cheerio';

/**
 * Robust HTML email parser for receipt data extraction
 * @param {string|object} input - Raw HTML string or object with {html, text, messageId, threadId, date, attachments}
 * @returns {object} Parsed receipt data with merchant, amount, line items, etc.
 */
export function parseEmailMessage(input) {
  let html, text, messageId, threadId, date, attachments;
  
  // Handle both string and object inputs
  if (typeof input === 'string') {
    html = input;
    text = '';
    messageId = '';
    threadId = '';
    date = new Date().toISOString();
    attachments = [];
  } else {
    html = input.html || input.body || '';
    text = input.text || '';
    messageId = input.messageId || '';
    threadId = input.threadId || '';
    date = input.date || new Date().toISOString();
    attachments = input.attachments || [];
  }

  const $ = cheerio.load(html);
  
  // Initialize result object
  const result = {
    messageId,
    threadId,
    merchant: 'Unknown',
    date: date,
    amount: '0.00',
    currency: 'USD',
    lineItems: [],
    confidence: 0.3,
    attachments: attachments.map(att => ({
      filename: att.filename || att,
      url: att.url || `/uploads/${att.filename || att}`
    }))
  };

  // Extract merchant name
  result.merchant = extractMerchant($, html, input);
  
  // Extract line items from tables
  result.lineItems = extractLineItems($);
  
  // Extract total amount and currency
  const { amount, currency } = extractTotal($, html, text);
  result.amount = amount;
  result.currency = currency;
  
  // Calculate confidence based on extraction quality
  result.confidence = calculateConfidence(result, html);
  
  return result;
}

/**
 * Extract merchant name using multiple strategies
 */
function extractMerchant($, html, input) {
  // Strategy 1: Check for merchant-specific templates
  const merchantTemplates = {
    amazon: /amazon/i,
    starbucks: /starbucks/i,
    uber: /uber/i,
    tesco: /tesco/i,
    sainsbury: /sainsbury/i,
    asda: /asda/i
  };
  
  const subject = input?.subject || '';
  const sender = input?.sender || '';
  const bodyText = html.toLowerCase();
  
  for (const [merchant, pattern] of Object.entries(merchantTemplates)) {
    if (pattern.test(subject) || pattern.test(sender) || pattern.test(bodyText)) {
      return merchant.charAt(0).toUpperCase() + merchant.slice(1);
    }
  }
  
  // Strategy 2: Look for h1 tags
  const h1Text = $('h1').first().text().trim();
  if (h1Text && h1Text.length > 0 && h1Text.length < 50) {
    return cleanMerchantName(h1Text);
  }
  
  // Strategy 3: Look for h2 tags
  const h2Text = $('h2').first().text().trim();
  if (h2Text && h2Text.length > 0 && h2Text.length < 50) {
    return cleanMerchantName(h2Text);
  }
  
  // Strategy 4: Check meta og:site_name
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName && ogSiteName.length < 50) {
    return cleanMerchantName(ogSiteName);
  }
  
  // Strategy 5: Look for first bold/strong text
  const strongText = $('strong, b').first().text().trim();
  if (strongText && strongText.length > 0 && strongText.length < 50 && !strongText.match(/\d+[\d.,]*|\$|£|€/)) {
    return cleanMerchantName(strongText);
  }
  
  // Strategy 6: Extract from sender email domain
  if (sender) {
    const domain = sender.split('@')[1];
    if (domain) {
      const merchantFromDomain = domain.split('.')[0];
      if (merchantFromDomain.length > 2) {
        return merchantFromDomain.charAt(0).toUpperCase() + merchantFromDomain.slice(1);
      }
    }
  }
  
  return 'Unknown';
}

/**
 * Clean and normalize merchant name
 */
function cleanMerchantName(name) {
  return name
    .replace(/\.com|\.co\.uk|\.org/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract line items from table structures
 */
function extractLineItems($) {
  const lineItems = [];
  
  // Find all tables and extract line items
  $('table').each((_, table) => {
    const $table = $(table);
    
    $table.find('tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td, th').toArray();
      
      if (cells.length >= 2) {
        const nameCell = $(cells[0]).text().trim();
        const priceCell = $(cells[cells.length - 1]).text().trim();
        
        // Skip header rows and total rows
        if (nameCell.toLowerCase().includes('total') || 
            nameCell.toLowerCase().includes('subtotal') ||
            nameCell.toLowerCase().includes('tax') ||
            nameCell.toLowerCase().includes('shipping') ||
            priceCell.toLowerCase().includes('total')) {
          return;
        }
        
        const priceMatch = extractCurrencyAmount(priceCell);
        if (priceMatch && nameCell.length > 0) {
          lineItems.push({
            name: nameCell,
            price: priceMatch.amount,
            rawPrice: priceCell
          });
        }
      }
    });
  });
  
  return lineItems;
}

/**
 * Extract total amount and currency from various sources
 */
function extractTotal($, html, text) {
  let amount = '0.00';
  let currency = 'USD';
  
  // Strategy 1: Look for total in table rows
  $('table tr').each((_, row) => {
    const $row = $(row);
    const rowText = $row.text().toLowerCase();
    
    if (rowText.includes('total') && !rowText.includes('subtotal')) {
      const cells = $row.find('td, th').toArray();
      if (cells.length >= 2) {
        const priceCell = $(cells[cells.length - 1]).text().trim();
        const match = extractCurrencyAmount(priceCell);
        if (match) {
          amount = match.amount;
          currency = match.currency;
          return false; // Break out of loop
        }
      }
    }
  });
  
  // Strategy 2: Look for total in any element containing "total"
  if (amount === '0.00') {
    $('*').each((_, element) => {
      const $el = $(element);
      const text = $el.text().toLowerCase();
      
      if (text.includes('total') && !text.includes('subtotal')) {
        const match = extractCurrencyAmount($el.text());
        if (match) {
          amount = match.amount;
          currency = match.currency;
          return false;
        }
      }
    });
  }
  
  // Strategy 3: Search entire HTML for currency patterns
  if (amount === '0.00') {
    const allText = html + ' ' + text;
    const match = extractCurrencyAmount(allText);
    if (match) {
      amount = match.amount;
      currency = match.currency;
    }
  }
  
  return { amount, currency };
}

/**
 * Extract currency amount from text using comprehensive regex patterns
 */
function extractCurrencyAmount(text) {
  if (!text) return null;
  
  // Currency patterns with symbols and codes
  const patterns = [
    // £12.34, $12.34, €12.34
    /([£$€])(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    // 12.34 GBP, 12.34 USD, 12.34 EUR
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(GBP|USD|EUR|£|$|€)/gi,
    // Just numbers with decimal (fallback)
    /(\d{1,3}(?:,\d{3})*\.\d{2})/g
  ];
  
  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[matches.length - 1]; // Take the last/largest match
      
      let amount, currency;
      
      if (match[1] && match[2]) {
        // Pattern: £12.34 or 12.34 GBP
        if (match[1].match(/[£$€]/)) {
          currency = match[1] === '£' ? 'GBP' : match[1] === '$' ? 'USD' : 'EUR';
          amount = match[2].replace(/,/g, '');
        } else {
          amount = match[1].replace(/,/g, '');
          currency = match[2].toUpperCase();
          if (currency === '£') currency = 'GBP';
          if (currency === '$') currency = 'USD';
          if (currency === '€') currency = 'EUR';
        }
      } else {
        // Pattern: just number
        amount = match[1].replace(/,/g, '');
        currency = 'USD'; // Default
      }
      
      // Validate amount
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        return {
          amount: numAmount.toFixed(2),
          currency: currency
        };
      }
    }
  }
  
  return null;
}

/**
 * Calculate confidence score based on extraction quality
 */
function calculateConfidence(result, html) {
  let confidence = 0.3; // Base confidence
  
  // Increase confidence for explicit total found
  if (result.amount !== '0.00' && parseFloat(result.amount) > 0) {
    if (html.toLowerCase().includes('total')) {
      confidence = 0.9; // High confidence for explicit total
    } else {
      confidence = 0.7; // Good confidence for found amount
    }
  }
  
  // Increase confidence for line items
  if (result.lineItems.length > 0) {
    confidence = Math.max(confidence, 0.6);
  }
  
  // Increase confidence for known merchant
  if (result.merchant !== 'Unknown') {
    confidence = Math.min(confidence + 0.1, 1.0);
  }
  
  // Decrease confidence for very low amounts
  if (parseFloat(result.amount) < 1.0) {
    confidence *= 0.8;
  }
  
  return Math.round(confidence * 100) / 100; // Round to 2 decimal places
}

// For backward compatibility with CommonJS require
export default { parseEmailMessage };