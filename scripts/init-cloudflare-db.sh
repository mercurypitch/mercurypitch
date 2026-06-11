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
#   ./scripts/init-cloudflare-db.sh [mode] [env]
#     mode: --local | --remote | all   (default: all)
#     env:  dev | prod                 (default: prod)
#
#   pnpm db:init           # prod DB (mercurypitch-db), remote + local
#   pnpm db:init:dev       # dev DB (mercurypitch-db-dev), remote + local
#   pnpm db:init:local     # local only (no CF account needed)
#
# Requires: wrangler authenticated (`pnpm exec wrangler login`) for remote.
# =====================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-all}"
DEPLOY_ENV="${2:-prod}"

CONFIG="workers/db-worker/wrangler.jsonc"
SCHEMA="workers/db-worker/schema.sql"
WRANGLER="pnpm exec wrangler"

if [ "$DEPLOY_ENV" = "dev" ]; then
  DB_NAME="mercurypitch-db-dev"
  ID_PLACEHOLDER="REPLACE_WITH_DEV_DATABASE_ID"
  ENV_FLAG=(--env dev)
else
  DB_NAME="mercurypitch-db"
  ID_PLACEHOLDER="REPLACE_WITH_DATABASE_ID"
  ENV_FLAG=(--env prod)
fi

apply_local() {
  # Local D1 state is shared via the top-level binding (no --env), so
  # `pnpm dev:db` always finds it.
  echo "→ Applying schema to LOCAL D1 (.wrangler/state)..."
  $WRANGLER d1 execute mercurypitch-db --local --file="$SCHEMA" --config "$CONFIG"
}

apply_remote() {
  # 1. Create the database if it doesn't exist yet
  if $WRANGLER d1 list --json | grep -q "\"name\": *\"$DB_NAME\""; then
    echo "→ D1 database '$DB_NAME' already exists."
  else
    echo "→ Creating D1 database '$DB_NAME'..."
    # --config keeps wrangler from injecting a d1 binding into the
    # root wrangler.jsonc (the main app worker doesn't use D1)
    $WRANGLER d1 create "$DB_NAME" --config "$CONFIG" "${ENV_FLAG[@]}" || true
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

  if grep -q "$ID_PLACEHOLDER" "$CONFIG"; then
    sed -i "s/$ID_PLACEHOLDER/$DB_ID/" "$CONFIG"
    echo "→ Wrote database_id into $CONFIG"
  fi

  # 3. Apply the schema remotely (idempotent: CREATE IF NOT EXISTS)
  echo "→ Applying schema to REMOTE D1 ($DB_NAME)..."
  $WRANGLER d1 execute "$DB_NAME" --remote --file="$SCHEMA" --config "$CONFIG" "${ENV_FLAG[@]}"
}

case "$MODE" in
  --local) apply_local ;;
  --remote) apply_remote ;;
  all)
    apply_remote
    apply_local
    ;;
  *)
    echo "Unknown mode: $MODE (use --local, --remote, or all)" >&2
    exit 1
    ;;
esac

echo "✓ Done ($DEPLOY_ENV). Next steps:"
echo "  1. Deploy: pnpm deploy:db:$DEPLOY_ENV"
echo "  2. Set secrets (once per env):"
echo "       pnpm exec wrangler secret put JWT_SECRET --config $CONFIG --env $DEPLOY_ENV"
echo "       pnpm exec wrangler secret put ADMIN_KEY  --config $CONFIG --env $DEPLOY_ENV"
echo "  3. Point the build at the worker URL via VITE_API_BASE_URL"