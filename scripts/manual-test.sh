#!/bin/bash

echo "=== Email Receipt Import API Tests ==="
echo

echo "1. Testing OAuth authorization URL generation..."
curl -s -X GET "http://localhost:5000/api/email/authorize?provider=gmail" | jq .
echo

echo "2. Testing OAuth callback..."
curl -s -X GET "http://localhost:5000/api/email/callback?provider=gmail&code=test_code_123&state=test_state" | jq .
echo

echo "3. Testing webhook endpoint..."
curl -s -X POST "http://localhost:5000/api/email/webhook" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"test_msg_123","integrationId":"test-integration","subject":"Test Receipt Email","sender":"receipts@store.com","attachments":["receipt.pdf"]}' | jq .
echo

echo "4. Testing forwarding address generation..."
curl -s -X GET "http://localhost:5000/api/email/forwarding-address" | jq .
echo

echo "5. Testing pending receipts..."
curl -s -X GET "http://localhost:5000/api/email/pending" | jq .
echo

echo "=== All tests completed ==="