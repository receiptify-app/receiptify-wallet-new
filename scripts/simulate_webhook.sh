#!/bin/bash

echo "=== Email Receipt Import Webhook Simulation ==="
echo

# Load sample data
SAMPLE_DATA='{"messageId":"sample_receipt_webhook_001","integrationId":"test-integration","subject":"Your Amazon Order Receipt #123-4567890-1234567","sender":"auto-confirm@amazon.com","body":"<html><head><title>Your Amazon Order Receipt</title></head><body><h1>Amazon.com</h1><p>Order #123-4567890-1234567</p><p>Order Date: December 15, 2023</p><table><tr><td>Echo Dot (4th Gen)</td><td>$29.99</td></tr><tr><td>Shipping</td><td>$5.99</td></tr><tr><td><strong>Total</strong></td><td><strong>$35.98</strong></td></tr></table></body></html>","attachments":["receipt-amazon-123456.pdf"]}'

echo "1. Sending webhook with sample Amazon receipt..."
echo "Payload: $SAMPLE_DATA"
echo

RESPONSE=$(curl -s -X POST "http://localhost:5000/api/email/webhook" \
  -H "Content-Type: application/json" \
  -d "$SAMPLE_DATA")

echo "Response: $RESPONSE"
echo

# Extract job ID for tracking
JOB_ID=$(echo $RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$JOB_ID" ]; then
  echo "✅ Webhook accepted successfully"
  echo "📋 Job ID: $JOB_ID"
  echo
  
  echo "2. Waiting 3 seconds for processing..."
  sleep 3
  
  echo "3. Checking pending receipts..."
  PENDING=$(curl -s -X GET "http://localhost:5000/api/email/pending")
  echo "Pending receipts: $PENDING"
  echo
  
  # Check if receipt was created
  RECEIPT_COUNT=$(echo $PENDING | grep -o '"count":[0-9]*' | cut -d':' -f2)
  if [ "$RECEIPT_COUNT" -gt 0 ]; then
    echo "✅ Receipt created and is pending review"
  else
    echo "⚠️  No pending receipts found - check processing logs"
  fi
else
  echo "❌ Webhook failed"
  echo "Response: $RESPONSE"
fi

echo
echo "=== Simulation completed ==="