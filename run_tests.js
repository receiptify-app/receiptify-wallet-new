// Simple test runner for the parser
import { parseEmailMessage } from './utils/parser.js';

console.log('=== Running Parser Tests ===\n');

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
  </div>
</body>
</html>
`;

function runTest(name, testFn) {
  try {
    console.log(`Running: ${name}`);
    testFn();
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

function expect(actual) {
  return {
    toContain: (expected) => {
      if (!actual.toLowerCase().includes(expected.toLowerCase())) {
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
    }
  };
}

// Test 1: Extract merchant and amount from Amazon HTML
runTest('should extract merchant and amount from Amazon HTML', () => {
  const input = {
    html: sampleAmazonHTML,
    subject: 'Your Amazon Order Receipt #123-4567890-1234567',
    sender: 'auto-confirm@amazon.com',
    messageId: 'test_message_001',
    attachments: ['receipt-amazon-123456.pdf']
  };
  
  const result = parseEmailMessage(input);
  console.log('   Parsed result:', JSON.stringify(result, null, 2));
  
  // Assert merchant contains "Amazon"
  expect(result.merchant).toContain('amazon');
  
  // Assert amount is approximately 35.98
  expect(parseFloat(result.amount)).toBeCloseTo(35.98, 2);
  
  // Assert currency is USD
  expect(result.currency).toBe('USD');
  
  // Assert confidence is reasonable
  expect(result.confidence).toBeGreaterThan(0.8);
  
  // Assert line items were extracted
  if (result.lineItems.length === 0) {
    throw new Error('Expected line items to be extracted');
  }
});

// Test 2: Handle string input format
runTest('should handle string input format', () => {
  const result = parseEmailMessage(sampleAmazonHTML);
  
  expect(result.merchant).toContain('amazon');
  expect(parseFloat(result.amount)).toBeCloseTo(35.98, 2);
});

// Test 3: Extract from Starbucks format
runTest('should extract merchant from different HTML structures', () => {
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
  
  expect(result.merchant).toContain('starbucks');
  expect(parseFloat(result.amount)).toBeCloseTo(5.45, 2);
});

console.log('\n=== Test Results Summary ===');
console.log('Parser implementation verification completed.');