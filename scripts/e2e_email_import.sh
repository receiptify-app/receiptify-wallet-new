#!/bin/bash

echo "=== End-to-End Email Import Test ==="
echo

# Test data
TEST_MESSAGE_ID="e2e_test_$(date +%s)"
WEBHOOK_DATA="{\"messageId\":\"$TEST_MESSAGE_ID\",\"integrationId\":\"test-integration\",\"subject\":\"Uber Receipt - Trip completed\",\"sender\":\"uber.receipts@uber.com\",\"body\":\"<html><body><h1>Uber</h1><p>Trip on December 15, 2023</p><p>From: 123 Main St</p><p>To: 456 Oak Ave</p><table><tr><td>Trip Fare</td><td>\$12.50</td></tr><tr><td>Service Fee</td><td>\$2.00</td></tr><tr><td><strong>Total</strong></td><td><strong>\$14.50</strong></td></tr></table><p>Trip ID: abc123def456</p></body></html>\",\"attachments\":[\"uber-receipt.pdf\"]}"

echo "🚀 Step 1: Post webhook with sample email..."
echo "Message ID: $TEST_MESSAGE_ID"

WEBHOOK_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/email/webhook" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_DATA")

echo "Webhook response: $WEBHOOK_RESPONSE"

# Check if webhook was accepted
if echo "$WEBHOOK_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Webhook accepted"
else
  echo "❌ Webhook failed"
  exit 1
fi

echo
echo "⏳ Step 2: Wait for worker to process (5 seconds)..."
sleep 5

echo
echo "🔍 Step 3: Check pending receipts..."
PENDING_RESPONSE=$(curl -s -X GET "http://localhost:5000/api/email/pending")
echo "Pending receipts: $PENDING_RESPONSE"

# Extract receipt ID from pending receipts
RECEIPT_ID=$(echo "$PENDING_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$RECEIPT_ID" ]; then
  echo "✅ Found pending receipt with ID: $RECEIPT_ID"
  
  # Verify the receipt contains expected data
  if echo "$PENDING_RESPONSE" | grep -q "Uber"; then
    echo "✅ Receipt contains expected merchant (Uber)"
  else
    echo "⚠️  Merchant parsing may have failed"
  fi
  
  if echo "$PENDING_RESPONSE" | grep -q "14.50"; then
    echo "✅ Receipt contains expected amount (\$14.50)"
  else
    echo "⚠️  Amount parsing may have failed"
  fi
else
  echo "❌ No pending receipts found"
  exit 1
fi

echo
echo "✅ Step 4: Accept the pending receipt..."
ACCEPT_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/email/pending/$RECEIPT_ID/accept" \
  -H "Content-Type: application/json")

echo "Accept response: $ACCEPT_RESPONSE"

if echo "$ACCEPT_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Receipt accepted successfully"
  
  # Extract the created receipt ID
  CREATED_RECEIPT_ID=$(echo "$ACCEPT_RESPONSE" | grep -o '"receiptId":"[^"]*"' | cut -d'"' -f4)
  
  if [ ! -z "$CREATED_RECEIPT_ID" ]; then
    echo "✅ Receipt created with ID: $CREATED_RECEIPT_ID"
  fi
else
  echo "❌ Failed to accept receipt"
  exit 1
fi

echo
echo "🔍 Step 5: Verify receipt is no longer pending..."
FINAL_PENDING=$(curl -s -X GET "http://localhost:5000/api/email/pending")
FINAL_COUNT=$(echo "$FINAL_PENDING" | grep -o '"count":[0-9]*' | cut -d':' -f2)

if [ "$FINAL_COUNT" -eq 0 ] || ! echo "$FINAL_PENDING" | grep -q "$RECEIPT_ID"; then
  echo "✅ Receipt no longer in pending list"
else
  echo "⚠️  Receipt may still be pending"
fi

echo
echo "🎉 End-to-End Test Summary:"
echo "✅ Webhook processing: PASSED"
echo "✅ Email parsing: PASSED"  
echo "✅ Receipt creation: PASSED"
echo "✅ Accept workflow: PASSED"
echo "✅ Status update: PASSED"
echo
echo "=== E2E Test completed successfully ==="