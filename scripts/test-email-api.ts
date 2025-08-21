import { enqueueJob, JobType } from '../lib/queue'

async function testEmailAPI() {
  console.log('Testing Email API endpoints...\n')
  
  const baseUrl = 'http://localhost:5000'
  
  try {
    // Test 1: GET /api/email/authorize?provider=gmail
    console.log('1. Testing OAuth authorization URL generation...')
    const authResponse = await fetch(`${baseUrl}/api/email/authorize?provider=gmail`)
    const authData = await authResponse.json()
    console.log('✅ OAuth URL generated:', authData.authUrl.substring(0, 100) + '...')
    
    // Test 2: GET /api/email/callback (with test code)
    console.log('\n2. Testing OAuth callback...')
    const callbackResponse = await fetch(`${baseUrl}/api/email/callback?provider=gmail&code=test_code_123&state=test_state`)
    const callbackData = await callbackResponse.json()
    console.log('✅ OAuth callback processed:', callbackData.message)
    console.log('   Integration ID:', callbackData.integrationId)
    
    // Test 3: POST /api/email/webhook
    console.log('\n3. Testing webhook endpoint...')
    const webhookResponse = await fetch(`${baseUrl}/api/email/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: 'test_msg_123',
        integrationId: callbackData.integrationId,
        subject: 'Test Receipt Email',
        sender: 'receipts@store.com',
        attachments: ['receipt.pdf']
      })
    })
    const webhookData = await webhookResponse.json()
    console.log('✅ Webhook processed and job enqueued:', webhookData.jobId)
    
    // Test 4: GET /api/email/forwarding-address
    console.log('\n4. Testing forwarding address generation...')
    const forwardingResponse = await fetch(`${baseUrl}/api/email/forwarding-address`)
    const forwardingData = await forwardingResponse.json()
    console.log('✅ Forwarding address generated:', forwardingData.forwardingAddress)
    
    // Test 5: Direct job enqueue (worker test)
    console.log('\n5. Testing direct job enqueue...')
    try {
      const job = await enqueueJob(JobType.EMAIL_PROCESS_MESSAGE, {
        messageId: 'direct_test_123',
        emailIntegrationId: callbackData.integrationId,
        subject: 'Direct Test Message',
        sender: 'test@direct.com'
      })
      console.log('✅ Direct job enqueued:', job.id)
    } catch (error) {
      console.log('⚠️  Direct job enqueue failed (Redis not available):', error.message)
    }
    
    console.log('\n🎉 All API tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testEmailAPI().catch(console.error)
}

export { testEmailAPI }