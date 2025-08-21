import { parseEmailMessage } from '../utils/parser.js';

// Sample Amazon HTML payload for testing
const sampleAmazonHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Your Amazon Order Receipt</title>
  <meta property="og:site_name" content="Amazon.com" />
</head>
<body>
  <div class="receipt">
    <h1>Amazon.com</h1>
    <p>Order #123-4567890-1234567</p>
    <p>Order Date: December 15, 2023</p>
    
    <table class="order-items">
      <tr>
        <th>Item</th>
        <th>Price</th>
      </tr>
      <tr>
        <td>Echo Dot (4th Gen) - Smart Speaker with Alexa</td>
        <td>$29.99</td>
      </tr>
      <tr>
        <td>Shipping & Handling</td>
        <td>$5.99</td>
      </tr>
      <tr>
        <td><strong>Total</strong></td>
        <td><strong>$35.98</strong></td>
      </tr>
    </table>
    
    <p>Thank you for shopping with Amazon!</p>
    
    <div class="billing-address">
      <h3>Billing Address:</h3>
      <p>John Doe<br>123 Main St<br>Anytown, CA 12345</p>
    </div>
  </div>
</body>
</html>
`;

// Test suite for parseEmailMessage function
describe('parseEmailMessage', () => {
  test('should extract merchant and amount from Amazon HTML', () => {
    const input = {
      html: sampleAmazonHTML,
      subject: 'Your Amazon Order Receipt #123-4567890-1234567',
      sender: 'auto-confirm@amazon.com',
      messageId: 'test_message_001',
      attachments: ['receipt-amazon-123456.pdf']
    };
    
    const result = parseEmailMessage(input);
    
    // Assert merchant contains "Amazon"
    expect(result.merchant.toLowerCase()).toContain('amazon');
    
    // Assert amount is approximately 35.98
    expect(parseFloat(result.amount)).toBeCloseTo(35.98, 2);
    
    // Assert currency is USD
    expect(result.currency).toBe('USD');
    
    // Assert confidence is reasonable
    expect(result.confidence).toBeGreaterThan(0.8);
    
    // Assert line items were extracted
    expect(result.lineItems.length).toBeGreaterThan(0);
    expect(result.lineItems[0].name).toContain('Echo Dot');
    expect(parseFloat(result.lineItems[0].price)).toBeCloseTo(29.99, 2);
    
    // Assert attachments were processed
    expect(result.attachments.length).toBe(1);
    expect(result.attachments[0].filename).toBe('receipt-amazon-123456.pdf');
  });
  
  test('should handle string input format', () => {
    const result = parseEmailMessage(sampleAmazonHTML);
    
    expect(result.merchant.toLowerCase()).toContain('amazon');
    expect(parseFloat(result.amount)).toBeCloseTo(35.98, 2);
  });
  
  test('should extract merchant from different HTML structures', () => {
    const starbucksHTML = `
      <html>
        <body>
          <h1>Starbucks Coffee Company</h1>
          <p>Store #12345</p>
          <p>Total: $5.45</p>
        </body>
      </html>
    `;
    
    const result = parseEmailMessage({
      html: starbucksHTML,
      sender: 'receipts@starbucks.com'
    });
    
    expect(result.merchant.toLowerCase()).toContain('starbucks');
    expect(parseFloat(result.amount)).toBeCloseTo(5.45, 2);
  });
  
  test('should handle missing or invalid data gracefully', () => {
    const result = parseEmailMessage({
      html: '<html><body><p>No receipt data here</p></body></html>',
      subject: 'Random email',
      sender: 'someone@example.com'
    });
    
    expect(result.merchant).toBe('Unknown');
    expect(result.amount).toBe('0.00');
    expect(result.confidence).toBeLessThan(0.5);
  });
  
  test('should extract line items from table structures', () => {
    const tableHTML = `
      <html>
        <body>
          <h1>Test Store</h1>
          <table>
            <tr><th>Item</th><th>Price</th></tr>
            <tr><td>Product A</td><td>$10.00</td></tr>
            <tr><td>Product B</td><td>$15.50</td></tr>
            <tr><td>Total</td><td>$25.50</td></tr>
          </table>
        </body>
      </html>
    `;
    
    const result = parseEmailMessage(tableHTML);
    
    expect(result.lineItems.length).toBe(2);
    expect(result.lineItems[0].name).toBe('Product A');
    expect(parseFloat(result.lineItems[0].price)).toBeCloseTo(10.00, 2);
    expect(result.lineItems[1].name).toBe('Product B');
    expect(parseFloat(result.lineItems[1].price)).toBeCloseTo(15.50, 2);
    expect(parseFloat(result.amount)).toBeCloseTo(25.50, 2);
  });
});

// Mock test runner if jest is not available
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => {
    console.log(`\n=== ${name} ===`);
    fn();
  };
  
  global.test = (name, fn) => {
    try {
      console.log(`Running: ${name}`);
      fn();
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.error(error.message);
    }
  };
  
  global.expect = (actual) => ({
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected "${actual}" to be "${expected}"`);
      }
    },
    toBeCloseTo: (expected, precision = 2) => {
      const diff = Math.abs(actual - expected);
      const tolerance = Math.pow(10, -precision);
      if (diff > tolerance) {
        throw new Error(`Expected ${actual} to be close to ${expected} (within ${tolerance})`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  });
}