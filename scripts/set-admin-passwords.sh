#!/bin/bash
SUPABASE_URL="https://hvvswxogayjzxjxvpbdh.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dnN3eG9nYXlqenhqeHZwYmRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQxOTIxMSwiZXhwIjoyMDk1OTk1MjExfQ.vDYcuqzEu5PYmlmnyhTN3jVyBD33FAke3cTHM0-I_ok"
NEW_PASSWORD="EdelGolf2026!"

EMAILS=(
  "nedel@edelgolf.com"
  "abard@edelgolf.com"
  "acalzada@edelgolf.com"
  "accounting@edelgolf.com"
  "alex@pinsandaces.com"
  "edeldev@edelgolf.com"
)

# Get all users
ALL_USERS=$(curl -s \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/auth/v1/admin/users?per_page=100")

for EMAIL in "${EMAILS[@]}"; do
  echo "Setting password for $EMAIL..."
  
  USER_ID=$(echo "$ALL_USERS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
users = data.get('users', [])
match = [u['id'] for u in users if u.get('email','').lower() == '$EMAIL'.lower()]
print(match[0] if match else '')
" 2>/dev/null)
  
  if [ -z "$USER_ID" ]; then
    echo "  ✗ User not found: $EMAIL"
    continue
  fi
  
  RESULT=$(curl -s -X PUT \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"password\": \"$NEW_PASSWORD\"}" \
    "$SUPABASE_URL/auth/v1/admin/users/$USER_ID")
  
  if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('id') else 1)" 2>/dev/null; then
    echo "  ✓ Password set for $EMAIL"
  else
    echo "  ✗ Failed: $RESULT"
  fi
done