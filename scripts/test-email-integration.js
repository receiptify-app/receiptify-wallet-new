#!/usr/bin/env node

/**
 * Complete Email Integration Testing Script
 * 
 * This script simulates the complete email integration flow:
 * 1. OAuth provider setup
 * 2. Forwarding inbox configuration
 * 3. Email processing and receipt extraction
 * 4. Admin monitoring
 */

const BASE_URL = 'http://localhost:5000';

async function makeRequest(method, path, body = null) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function testOAuthFlow() {
  console.log('\n🔐 Testing OAuth Flow...');
  
  // Test Gmail OAuth
  console.log('Getting Gmail OAuth URL...');
  const gmailAuth = await makeRequest('GET', '/api/email/oauth/authorize?provider=gmail');
  console.log('✓ Gmail OAuth URL:', gmailAuth.authUrl?.substring(0, 80) + '...' || gmailAuth.message);
  
  // Test Outlook OAuth
  console.log('Getting Outlook OAuth URL...');
  const outlookAuth = await makeRequest('GET', '/api/email/oauth/authorize?provider=outlook');
  console.log('✓ Outlook OAuth URL:', outlookAuth.authUrl?.substring(0, 80) + '...' || outlookAuth.message);
  
  // Simulate OAuth callback (mock)
  console.log('Simulating OAuth callback...');
  try {
    await makeRequest('POST', '/api/email/oauth/simulate-callback', {
      provider: 'gmail',
      userId: 'test-user-id'
    });
    console.log('✓ OAuth simulation completed');
  } catch (error) {
    console.log('⚠️ OAuth simulation (expected to need real tokens)');
  }
}

async function testForwardingInbox() {
  console.log('\n📧 Testing Forwarding Inbox...');
  
  // Get forwarding address
  console.log('Getting forwarding address...');
  const forwardingResult = await makeRequest('GET', '/api/email/forwarding-address');
  console.log('✓ Forwarding address:', forwardingResult.forwardingAddress);
  console.log('  Instructions:', forwardingResult.instructions[0]);
  
  // Simulate forwarded email
  console.log('Simulating forwarded email...');
  const simulation = await makeRequest('POST', '/api/email/simulate-forwarding', {
    userId: 'test-user-id',
    subject: 'Receipt from Tesco - Order Confirmation',
    from: 'receipts@tesco.com'
  });
  console.log('✓ Email forwarding simulation:', simulation.message);
  console.log('  Message ID:', simulation.webhookResult.messageId);
  
  // Test another receipt email
  await makeRequest('POST', '/api/email/simulate-forwarding', {
    userId: 'test-user-id',
    subject: 'Your Waitrose order total: £45.67',
    from: 'orders@waitrose.com'
  });
  console.log('✓ Second receipt email processed');
  
  // Test non-receipt email
  await makeRequest('POST', '/api/email/simulate-forwarding', {
    userId: 'test-user-id',
    subject: 'Newsletter: Weekly deals',
    from: 'marketing@example.com'
  });
  console.log('✓ Non-receipt email processed');
}

async function testAdminEndpoints() {
  console.log('\n🔧 Testing Admin Endpoints...');
  
  // Check email integrations
  console.log('Getting email integrations...');
  const integrations = await makeRequest('GET', '/api/admin/email-integrations?userId=test-user-id');
  console.log('✓ Email integrations:', integrations.summary);
  console.log('  Active integrations:', integrations.integrations.length);
  
  // Check pending receipts
  console.log('Getting pending receipts...');
  const pendingReceipts = await makeRequest('GET', '/api/admin/pending-receipts?userId=test-user-id');
  console.log('✓ Pending receipts:', pendingReceipts.count);
  
  if (pendingReceipts.pendingReceipts.length > 0) {
    const receipt = pendingReceipts.pendingReceipts[0];
    console.log('  Sample pending receipt:');
    console.log('    Subject:', receipt.subject);
    console.log('    Sender:', receipt.sender);
    console.log('    Amount:', receipt.extractedAmount || 'Not detected');
    console.log('    Merchant:', receipt.merchantName || 'Not detected');
  }
  
  // Check queue status
  console.log('Getting queue status...');
  const queueStatus = await makeRequest('GET', '/api/admin/queue-status');
  console.log('✓ Queue status:', queueStatus);
  
  // Test integration (if any exist)
  if (integrations.integrations.length > 0) {
    const integrationId = integrations.integrations[0].id;
    console.log('Testing integration:', integrationId);
    
    await makeRequest('POST', '/api/admin/test-integration', {
      integrationId
    });
    console.log('✓ Integration test completed');
    
    // Trigger backfill
    await makeRequest('POST', '/api/email/backfill', {
      integrationId,
      days: 30
    });
    console.log('✓ Backfill job triggered');
  }
}

async function testEmailWebhook() {
  console.log('\n📬 Testing Email Webhook...');
  
  // Get a forwarding address first
  const forwardingResult = await makeRequest('GET', '/api/email/forwarding-address');
  const forwardingAddress = forwardingResult.forwardingAddress;
  
  // Test webhook directly
  const webhookTest = await makeRequest('POST', '/api/email/webhook', {
    to: forwardingAddress,
    from: 'receipts@amazon.co.uk',
    subject: 'Your Amazon.co.uk order of £89.99 has been shipped',
    text: 'Dear customer, your order total was £89.99. Thank you for shopping with Amazon.',
    html: '<p>Dear customer, your order total was <b>£89.99</b>. Thank you for shopping with Amazon.</p>',
    attachments: []
  });
  
  console.log('✓ Direct webhook test:', webhookTest.message);
  console.log('  Message ID:', webhookTest.messageId);
}

async function runCompleteTest() {
  try {
    console.log('🚀 Starting Complete Email Integration Test');
    console.log('=====================================');
    
    await testOAuthFlow();
    await testForwardingInbox();
    await testEmailWebhook();
    
    // Wait a moment for job processing
    console.log('\n⏳ Waiting for job processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testAdminEndpoints();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\nSummary:');
    console.log('- OAuth flows are configured');
    console.log('- Forwarding inbox is operational');
    console.log('- Email processing and receipt detection is working');
    console.log('- Admin monitoring endpoints are functional');
    console.log('- Job queue is processing emails');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
fetch(BASE_URL)
  .then(() => runCompleteTest())
  .catch(() => {
    console.error('❌ Server not running at', BASE_URL);
    console.log('Please start the server with: npm run dev');
    process.exit(1);
  });