#!/bin/bash
ACCOUNT_ID="772870a2-900f-4b18-a15b-66fb5c331d48"
APP_KEY="dbf74eef-9923-a9bc-d5d2-762ada472124"

echo "=== TESTING STOCK ENDPOINT ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "api-auth-accountid: $ACCOUNT_ID" \
  -H "api-auth-applicationkey: $APP_KEY" \
  "https://inventory.dearsystems.com/ExternalApi/v2/product?limit=1&includeDeprecated=false&page=1"

echo ""
echo "=== TESTING INVENTORY ENDPOINT ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "api-auth-accountid: $ACCOUNT_ID" \
  -H "api-auth-applicationkey: $APP_KEY" \
  "https://inventory.dearsystems.com/ExternalApi/v2/ref/productavailability"

echo ""
echo "=== TESTING STOCK ON HAND ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "api-auth-accountid: $ACCOUNT_ID" \
  -H "api-auth-applicationkey: $APP_KEY" \
  "https://inventory.dearsystems.com/ExternalApi/v2/stocktake?limit=1"