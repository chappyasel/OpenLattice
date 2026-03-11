#!/usr/bin/env bash
# Superset workspace teardown: delete Neon branch
set -euo pipefail

# Source env vars (NEON_PROJECT_ID, NEON_ORG_ID)
set -a
source .env 2>/dev/null || true
set +a

BRANCH_NAME="$SUPERSET_WORKSPACE_NAME"
echo "==> Deleting Neon branch: worktree/${BRANCH_NAME}..."
neonctl branches delete "worktree/${BRANCH_NAME}" \
  --project-id "$NEON_PROJECT_ID" \
  --org-id "$NEON_ORG_ID" \
  2>&1 || echo "WARN: Could not delete Neon branch (may not exist)"

echo "==> Teardown complete."
