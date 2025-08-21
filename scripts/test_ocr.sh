#!/bin/bash

echo "=== OCR Processing Test ==="
echo

# Create a test receipt
echo "1. Creating a test receipt with attachment..."

# First create a webhook that will generate a receipt with attachment
WEBHOOK_DATA='{"messageId":"ocr_test_001","integrationId":"test-integration","subject":"Starbucks Receipt","sender":"receipts@starbucks.com","body":"<html><body><h1>Starbucks Coffee</h1><p>Store #12345</p><p>Date: December 15, 2023</p><p>Grande Latte - $5.45</p><p>Total: $5.45</p></body></html>","attachments":["starbucks-receipt.jpg"]}'

WEBHOOK_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/email/webhook" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_DATA")

echo "Webhook response: $WEBHOOK_RESPONSE"
echo

# Extract job ID
JOB_ID=$(echo $WEBHOOK_RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$JOB_ID" ]; then
  echo "✅ Receipt created with job ID: $JOB_ID"
  echo
  
  echo "2. Waiting 5 seconds for processing (including OCR)..."
  sleep 5
  
  echo "3. Checking for receipts with OCR data..."
  
  # Get all receipts to find the one we just created
  RECEIPTS=$(curl -s -X GET "http://localhost:5000/api/receipts")
  echo "Receipts response: $RECEIPTS"
  echo
  
  # Check if OCR data is present in metadata
  if echo "$RECEIPTS" | grep -q "ocrResults"; then
    echo "✅ OCR processing completed - receipt contains OCR data"
    echo
    echo "4. OCR Results found in receipt metadata:"
    echo "$RECEIPTS" | grep -o '"ocrResults":[^}]*}' | head -1
  else
    echo "⚠️  OCR data not found in receipt - check OCR processing"
  fi
else
  echo "❌ Failed to create test receipt"
fi

echo
echo "=== OCR Test completed ==="