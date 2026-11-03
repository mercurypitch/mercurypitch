#!/bin/bash
# ============================================================
# SessionStart: commit as the owner in the owner's cloud sessions
# ============================================================
#
# A cloud session's container commits as its own default identity,
# "Claude <noreply@anthropic.com>", unless told otherwise, and AGENTS.md
# rule 5 has the user as the sole author of every commit. In the owner's
# own cloud sessions (their claude.ai account, CLAUDE_CODE_ACCOUNT_UUID),
# this sets the repo's git identity to theirs, as their merges already carry
# it on main. Anyone else's session, and every local one, is left alone:
# their own git config stands.
#
# Synchronous and instant: two git config writes, nothing installed.
# Idempotent: the same values every time.
set -euo pipefail

OWNER_ACCOUNT='1638f0ae-e5b5-4ba2-a2a2-92732f8578a8'

[ "${CLAUDE_CODE_REMOTE:-}" = 'true' ] || exit 0
[ "${CLAUDE_CODE_ACCOUNT_UUID:-}" = "$OWNER_ACCOUNT" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}"
git config user.name 'aetheris007'
git config user.email 'viki.petrunic@gmail.com'
