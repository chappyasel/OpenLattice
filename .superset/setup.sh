#!/usr/bin/env bash
# Superset workspace setup: install deps + create Neon branch
set -euo pipefail

echo "==> Copying env from root..."
cp "$SUPERSET_ROOT_PATH/.env" .env 2>/dev/null || true

# Source env vars (NEON_PROJECT_ID, NEON_ORG_ID)
set -a
source .env 2>/dev/null || true
set +a

NEON_PARENT_BRANCH="production"

echo "==> Installing dependencies..."
yarn install --frozen-lockfile 2>&1 || yarn install 2>&1

BRANCH_NAME="$SUPERSET_WORKSPACE_NAME"
echo "==> Creating Neon branch: worktree/${BRANCH_NAME}..."
OUTPUT=$(neonctl branches create \
  --project-id "$NEON_PROJECT_ID" \
  --org-id "$NEON_ORG_ID" \
  --parent "$NEON_PARENT_BRANCH" \
  --name "worktree/${BRANCH_NAME}" \
  --output json 2>&1)

# Extract connection string and write to .env.local
DB_URL=$(echo "$OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
uris = data.get('connection_uris', [])
for u in uris:
    if u.get('connection_parameters', {}).get('database') == 'neondb':
        print(u['connection_uri'])
        break
" 2>/dev/null || echo "")

if [ -n "$DB_URL" ]; then
  echo "DATABASE_URL=\"${DB_URL}\"" > .env.local
  echo "==> Neon branch 'worktree/${BRANCH_NAME}' ready. DATABASE_URL written to .env.local"
else
  echo "WARN: Could not extract DATABASE_URL from Neon output. Set it manually."
  echo "$OUTPUT"
fi
