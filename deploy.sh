#!/bin/bash
#==============================================================================
# PitchPerfect Deploy Script
# Usage: ./deploy.sh [--check-only]
#
# --check-only : Run syntax checks and verify public files, but don't pull.
# Without flags : pull latest main + syntax check + verify + deploy.
#
# The Apache DocumentRoot points to pitch-perfect-repo/public/, so files are
# served immediately after git pull. No extra copy step needed.
#==============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$REPO_DIR/public"
LOG_FILE="$REPO_DIR/.deploy.log"

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy] WARNING:${NC} $*"; }
err() { echo -e "${RED}[deploy] ERROR:${NC} $*" >&2; }
info() { echo -e "${CYAN}[deploy]${NC} $*"; }

#-------------------------------------------------------------------------------
# Step 0: Guard — must be on main branch
#-------------------------------------------------------------------------------
check_branch() {
    cd "$REPO_DIR"
    local branch
    branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)

    if [[ "$branch" != "main" ]]; then
        err "Not on main branch (current: $branch). Deploy only from main."
        err "Switch with: git checkout main"
        exit 1
    fi

    # Verify git remote is set
    if ! git remote get-url origin >/dev/null 2>&1; then
        err "No remote 'origin' configured."
        exit 1
    fi

    log "Branch check passed (on main)"
}

#-------------------------------------------------------------------------------
# Step 1: Syntax check all JS files
#-------------------------------------------------------------------------------
run_syntax_check() {
    info "Running syntax checks..."

    local js_files=(
        "$WEB_DIR/assets/"*.js
    )

    local failed=0
    for file in $js_files; do
        if [[ -f "$file" ]]; then
            if node --check "$file" 2>/dev/null; then
                info "  ✓ $(basename "$file")"
            else
                err "  ✗ $(basename "$file") — syntax error"
                failed=1
            fi
        fi
    done

    if [[ $failed -eq 1 ]]; then
        err "Syntax check failed. Not deploying."
        exit 1
    fi

    log "Syntax checks passed"
}

#-------------------------------------------------------------------------------
# Step 2: Rebuild SolidJS app and deploy to public/
#-------------------------------------------------------------------------------
rebuild_solidjs() {
    info "Rebuilding SolidJS app..."

    if [[ -f "$REPO_DIR/App/package.json" ]]; then
        cd "$REPO_DIR/App"
        if npm run build >/dev/null 2>&1; then
            info "  ✓ SolidJS app built"
        else
            warn "  ! SolidJS build failed"
        fi
        cd "$REPO_DIR"
    fi

    # Copy built files from App/dist to public/
    if [[ -d "$REPO_DIR/App/dist" ]]; then
        info "Deploying SolidJS build to public/..."
        mkdir -p "$WEB_DIR/assets"
        rm -f "$WEB_DIR/assets/"*.js "$WEB_DIR/assets/"*.css
        cp "$REPO_DIR/App/dist/index.html" "$WEB_DIR/index.html"
        cp "$REPO_DIR/App/dist/assets/"*.css "$WEB_DIR/assets/" 2>/dev/null || true
        cp "$REPO_DIR/App/dist/assets/"*.js "$WEB_DIR/assets/" 2>/dev/null || true
        info "  ✓ Files deployed to public/"
    fi
}

#-------------------------------------------------------------------------------
# Step 3: Verify required files exist
#-------------------------------------------------------------------------------
verify_files() {
    info "Verifying required files..."

    # Verify required files exist
    if [[ ! -f "$WEB_DIR/index.html" ]]; then
        err "  ✗ index.html — MISSING"
        exit 1
    fi
    if [[ ! -d "$WEB_DIR/assets" ]]; then
        err "  ✗ assets/ — MISSING"
        exit 1
    fi
    local js_count=$(ls "$WEB_DIR/assets/"*.js 2>/dev/null | wc -l)
    local css_count=$(ls "$WEB_DIR/assets/"*.css 2>/dev/null | wc -l)
    info "  ✓ index.html ($(wc -c < "$WEB_DIR/index.html")B)"
    info "  ✓ assets/ ($js_count JS files, $css_count CSS files)"
    log "File verification passed"
}

#-------------------------------------------------------------------------------
# Step 3: Pull latest main
#-------------------------------------------------------------------------------
pull_latest() {
    info "Fetching and pulling origin/main..."

    local before
    before=$(git rev-parse --short HEAD)

    # Fetch first to check if there are updates
    git fetch origin main

    local status
    status=$(git rev-parse --short origin/main 2>/dev/null)

    if [[ "$before" == "$status" ]]; then
        info "Already up-to-date at ${before}. Nothing to pull."
        return 0
    fi

    # Inspect incoming changes
    local changed_files
    changed_files=$(git diff --name-only "$before" "$status" 2>/dev/null | grep -E '\.(js|html|css)$' || true)
    if [[ -n "$changed_files" ]]; then
        info "Changed files:"
        echo "$changed_files" | while read -r f; do
            info "  $f"
        done
    fi

    git pull --ff origin main

    local after
    after=$(git rev-parse --short HEAD)

    log "Updated: ${before} → ${after}"
    return 0
}

#-------------------------------------------------------------------------------
# Step 4: Write deploy marker
#-------------------------------------------------------------------------------
write_deploy_marker() {
    local commit
    commit=$(git rev-parse --short HEAD)
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    local user
    user=$(git log -1 --format='%an' HEAD 2>/dev/null || echo "unknown")

    echo "[$timestamp] Deployed $commit by $user" >> "$LOG_FILE"
    log "Deploy logged to .deploy.log"
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    echo ""
    info "============================================"
    info " PitchPerfect Deploy"
    info "============================================"
    echo ""

    check_branch

    if [[ "${1:-}" == "--check-only" ]]; then
        info "CHECK-ONLY MODE — skipping pull"
        echo ""
    else
        pull_latest
    fi

    rebuild_solidjs
    run_syntax_check
    verify_files

    if [[ "${1:-}" != "--check-only" ]]; then
        write_deploy_marker
    fi

    echo ""
    log "Done."
    echo ""
}

main "$@"
