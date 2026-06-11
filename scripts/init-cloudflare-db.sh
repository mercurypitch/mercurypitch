#!/usr/bin/env bash
# =====================================================================
# init-cloudflare-db.sh — create & initialize the MercuryPitch D1 DB
#
# Creates the D1 database (if missing), writes its database_id into
# workers/db-worker/wrangler.jsonc, and applies schema.sql locally
# and remotely.
#
# The cloud DB holds ONLY user/social data (users, profiles, session
# scores, challenges, badges, leaderboard, settings, shared content).
# Karaoke/UVR sessions and audio blobs stay local in IndexedDB and are
# never synced — see docs/plans/db-migration-plan.md.
#
# Usage:
#   ./scripts/init-cloudflare-db.sh            # local + remote
#   ./scripts/init-cloudflare-db.sh --local    # local only (no CF account needed)
#   ./scripts/init-cloudflare-db.sh --remote   # remote only
#
# Requires: wrangler authenticated (`pnpm exec wrangler login`) for remote.
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="mercurypitch-db"
CONFIG="workers/db-worker/wrangler.jsonc"
SCHEMA="workers/db-worker/schema.sql"
WRANGLER="pnpm exec wrangler"

MODE="${1:-all}"

apply_local() {
  echo "→ Applying schema to LOCAL D1 (.wrangler/state)..."
  $WRANGLER d1 execute "$DB_NAME" --local --file="$SCHEMA" --config "$CONFIG"
}

apply_remote() {
  # 1. Create the database if it doesn't exist yet
  if $WRANGLER d1 list --json | grep -q "\"name\": *\"$DB_NAME\""; then
    echo "→ D1 database '$DB_NAME' already exists."
  else
    echo "→ Creating D1 database '$DB_NAME'..."
    $WRANGLER d1 create "$DB_NAME"
  fi

  # 2. Resolve database_id and write it into the worker config
  DB_ID=$($WRANGLER d1 list --json | node -e "
    let s = '';
    process.stdin.on('data', (c) => (s += c));
    process.stdin.on('end', () => {
      const db = JSON.parse(s).find((d) => d.name === '$DB_NAME');
      if (!db) process.exit(1);
      process.stdout.write(db.uuid);
    });
  ")
  echo "→ database_id: $DB_ID"

  if grep -q 'REPLACE_WITH_DATABASE_ID' "$CONFIG"; then
    sed -i "s/REPLACE_WITH_DATABASE_ID/$DB_ID/" "$CONFIG"
    echo "→ Wrote database_id into $CONFIG"
  fi

  # 3. Apply the schema remotely (idempotent: CREATE IF NOT EXISTS)
  echo "→ Applying schema to REMOTE D1..."
  $WRANGLER d1 execute "$DB_NAME" --remote --file="$SCHEMA" --config "$CONFIG"
}

case "$MODE" in
  --local) apply_local ;;
  --remote) apply_remote ;;
  all)
    apply_remote
    apply_local
    ;;
  *)
    echo "Unknown option: $MODE (use --local, --remote, or no arg for both)" >&2
    exit 1
    ;;
esac

echo "✓ Done. Next steps:"
echo "  1. Implement the CRUD worker in workers/db-worker/src/index.ts"
echo "  2. Seed base data (challenges/badges/achievements) via the worker"
echo "  3. Point the app at it: VITE_API_BASE_URL=<worker-url> pnpm dev"
