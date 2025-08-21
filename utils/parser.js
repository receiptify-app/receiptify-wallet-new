const { parseString } = require('xml2js');
const cheerio = require('cheerio');

// Merchant-specific templates for common receipt formats
const MERCHANT_TEMPLATES = {
  'Amazon': {
    patterns: {
      merchant: /Amazon|amazon\.com/i,
      amount: /Total[:\s]+\$?([\d,]+\.?\d*)/i,
      date: /Order Date[:\s]+([\w\s,]+\d{4})/i,
      orderNumber: /Order #[:\s]*([A-Z0-9-]+)/i
    },
    itemSelectors: [
      'table[role="presentation"] tr',
      '.order-info tr',
      '.item-row'
    ]
  },
  'Starbucks': {
    patterns: {
      merchant: /Starbucks|sbux/i,
      amount: /Total[:\s]+\$?([\d,]+\.?\d*)/i,
      date: /Date[:\s]+([\d\/\-]+)/i,
      store: /Store[:\s]*#?(\d+)/i
    },
    itemSelectors: [
      '.receipt-item',
      'tr.item',
      '.line-item'
    ]
  },
  'Uber': {
    patterns: {
      merchant: /Uber|uber\.com/i,
      amount: /Total[:\s]+\$?([\d,]+\.?\d*)/i,
      date: /Trip on[:\s]+([\w\s,]+)/i,
      tripId: /Trip ID[:\s]*([A-Z0-9-]+)/i
    },
    itemSelectors: [
      '.trip-details tr',
      '.fare-breakdown tr'
    ]
  }
};

// Generic patterns for fallback extraction
const GENERIC_PATTERNS = {
  amount: [
    /Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Amount[:\s]+\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)/g
  ],
  date: [
    /Date[:\s]+([\d\/\-]+)/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i
  ],
  merchant: [
    /From[:\s]+([^<\n]+)/i,
    /Receipt from[:\s]+([^<\n]+)/i,
    /<title>([^<]+)/i
  ]
};

function detectMerchant(content) {
  const lowerContent = content.toLowerCase();
  
  for (const [merchant, template] of Object.entries(MERCHANT_TEMPLATES)) {
    if (template.patterns.merchant.test(content)) {
      return merchant;
    }
  }
  
  return 'Unknown';
}

function extractWithPatterns(content, patterns) {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

function parseSchemaOrgMarkup(html) {
  const $ = cheerio.load(html);
  const result = {};
  
  // Look for schema.org markup
  const invoiceScript = $('script[type="application/ld+json"]').first();
  if (invoiceScript.length) {
    try {
      const data = JSON.parse(invoiceScript.html());
      if (data['@type'] === 'Invoice' || data['@type'] === 'Order') {
        result.merchant = data.seller?.name || data.merchant?.name;
        result.amount = data.totalPaymentDue?.value || data.total;
        result.date = data.dateCreated || data.orderDate;
        result.currency = data.totalPaymentDue?.currency || 'USD';
        
        if (data.orderedItem || data.lineItems) {
          result.lineItems = (data.orderedItem || data.lineItems).map(item => ({
            name: item.name || item.description,
            price: item.offers?.price || item.price,
            quantity: item.orderQuantity || 1
          }));
        }
      }
    } catch (e) {
      console.log('Failed to parse schema.org JSON:', e.message);
    }
  }
  
  // Look for microdata
  $('[itemtype*="schema.org/Invoice"], [itemtype*="schema.org/Order"]').each((i, el) => {
    const $el = $(el);
    if (!result.merchant) {
      result.merchant = $el.find('[itemprop="seller"], [itemprop="merchant"]').text().trim();
    }
    if (!result.amount) {
      result.amount = $el.find('[itemprop="totalPaymentDue"], [itemprop="total"]').text().trim();
    }
    if (!result.date) {
      result.date = $el.find('[itemprop="dateCreated"], [itemprop="orderDate"]').text().trim();
    }
  });
  
  return result;
}

function extractLineItems(html, merchant) {
  const $ = cheerio.load(html);
  const lineItems = [];
  
  // Use merchant-specific selectors first
  if (MERCHANT_TEMPLATES[merchant]) {
    const selectors = MERCHANT_TEMPLATES[merchant].itemSelectors;
    
    for (const selector of selectors) {
      $(selector).each((i, row) => {
        const $row = $(row);
        const text = $row.text().trim();
        
        if (text && text.length > 5) {
          // Extract item name and price from row
          const priceMatch = text.match(/\$?([\d,]+\.?\d*)/);
          const price = priceMatch ? priceMatch[1] : null;
          
          // Clean item name (remove price and common words)
          let name = text.replace(/\$?[\d,]+\.?\d*/, '').trim();
          name = name.replace(/^(qty|quantity|item|product)[:\s]*/i, '').trim();
          
          if (name && name.length > 2) {
            lineItems.push({
              name: name.substring(0, 100), // Limit length
              price: price || '0.00',
              quantity: 1
            });
          }
        }
      });
      
      if (lineItems.length > 0) break; // Use first successful selector
    }
  }
  
  // Generic table extraction as fallback
  if (lineItems.length === 0) {
    $('table tr, .item, .line-item, .product').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      
      if (text && text.includes('$') && text.length > 5) {
        const priceMatch = text.match(/\$?([\d,]+\.?\d*)/);
        const price = priceMatch ? priceMatch[1] : null;
        
        if (price) {
          let name = text.replace(/\$?[\d,]+\.?\d*/, '').trim();
          name = name.substring(0, 100);
          
          if (name.length > 2) {
            lineItems.push({
              name,
              price,
              quantity: 1
            });
          }
        }
      }
    });
  }
  
  return lineItems.slice(0, 20); // Limit to 20 items
}

function calculateConfidence(extracted) {
  let confidence = 0;
  
  if (extracted.merchant && extracted.merchant !== 'Unknown') confidence += 0.3;
  if (extracted.amount && parseFloat(extracted.amount) > 0) confidence += 0.3;
  if (extracted.date) confidence += 0.2;
  if (extracted.lineItems && extracted.lineItems.length > 0) confidence += 0.2;
  
  return Math.min(confidence, 1.0);
}

function parseEmailMessage(emailData) {
  try {
    // Handle different input formats
    let htmlContent = '';
    let textContent = '';
    let subject = '';
    let attachments = [];
    
    if (typeof emailData === 'string') {
      // Raw HTML or text
      htmlContent = emailData;
      textContent = emailData;
    } else if (emailData.body) {
      // Parsed email object
      htmlContent = emailData.body.html || emailData.body || '';
      textContent = emailData.body.text || emailData.body || '';
      subject = emailData.subject || '';
      attachments = emailData.attachments || [];
    } else {
      // Direct properties
      htmlContent = emailData.html || emailData.content || '';
      textContent = emailData.text || emailData.content || '';
      subject = emailData.subject || '';
      attachments = emailData.attachments || [];
    }
    
    const content = htmlContent || textContent || '';
    
    // Extract basic information
    const extracted = {
      messageId: emailData.messageId || `msg_${Date.now()}`,
      threadId: emailData.threadId || null,
      merchant: 'Unknown',
      date: null,
      amount: null,
      currency: 'USD',
      lineItems: [],
      confidence: 0,
      attachments: attachments.map(att => ({
        filename: att.filename || att.name || 'attachment',
        url: att.url || att.path || null,
        mime: att.contentType || att.mime || 'application/octet-stream'
      }))
    };
    
    // Try schema.org extraction first
    if (htmlContent) {
      const schemaData = parseSchemaOrgMarkup(htmlContent);
      Object.assign(extracted, schemaData);
    }
    
    // Detect merchant
    extracted.merchant = detectMerchant(content);
    
    // Extract using patterns if not found in schema
    if (!extracted.amount) {
      extracted.amount = extractWithPatterns(content, GENERIC_PATTERNS.amount);
    }
    
    if (!extracted.date) {
      extracted.date = extractWithPatterns(content, GENERIC_PATTERNS.date);
    }
    
    if (!extracted.merchant || extracted.merchant === 'Unknown') {
      const merchantMatch = extractWithPatterns(content, GENERIC_PATTERNS.merchant);
      if (merchantMatch) {
        extracted.merchant = merchantMatch.trim();
      }
    }
    
    // Extract line items
    if (htmlContent && extracted.lineItems.length === 0) {
      extracted.lineItems = extractLineItems(htmlContent, extracted.merchant);
    }
    
    // Clean and validate data
    if (extracted.amount) {
      extracted.amount = extracted.amount.replace(/[,$]/g, '');
      if (isNaN(parseFloat(extracted.amount))) {
        extracted.amount = null;
      }
    }
    
    if (extracted.date) {
      try {
        const parsedDate = new Date(extracted.date);
        if (parsedDate.getTime()) {
          extracted.date = parsedDate.toISOString();
        } else {
          extracted.date = null;
        }
      } catch (e) {
        extracted.date = null;
      }
    }
    
    // Calculate confidence score
    extracted.confidence = calculateConfidence(extracted);
    
    console.log(`Parsed email: merchant=${extracted.merchant}, amount=${extracted.amount}, confidence=${extracted.confidence}`);
    
    return extracted;
    
  } catch (error) {
    console.error('Error parsing email message:', error);
    return {
      messageId: emailData.messageId || `msg_${Date.now()}`,
      threadId: null,
      merchant: 'Unknown',
      date: null,
      amount: null,
      currency: 'USD',
      lineItems: [],
      confidence: 0,
      attachments: [],
      error: error.message
    };
  }
}

module.exports = {
  parseEmailMessage,
  MERCHANT_TEMPLATES,
  detectMerchant
};