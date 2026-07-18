#!/usr/bin/env bash
# ============================================================
# spike-capacitor.sh — throwaway iOS WKWebView smoke test (Phase S)
# ============================================================
#
# Wraps the built web app in Capacitor and opens Xcode so you can run
# the smoke tests in docs/plans/mobile-native/capacitor-readiness.md §B
# on a real device / simulator. This is a SPIKE: it is meant to be
# discarded. It installs @capacitor/* dev deps and creates ios/ +
# capacitor.config.ts — none of which should be committed to the mobile
# PR (the native project lands in Phase 5). Run it on a throwaway branch:
#
#   git switch -c spike/capacitor
#   ./scripts/spike-capacitor.sh
#   # ...run the §B smoke tests, write findings into capacitor-readiness.md...
#   git switch feat/mobile-first-redesign   # then delete the spike branch
#
# Requirements (macOS): Xcode + command line tools, CocoaPods, a signing
# team in Xcode. getUserMedia/WebRTC on a device needs the app served over
# HTTPS — for live reload use the VITE_DEV_HTTPS section at the bottom.
set -euo pipefail

APP_ID="${CAP_APP_ID:-com.mercurypitch.spike}"
APP_NAME="${CAP_APP_NAME:-MercuryPitch Spike}"

echo "==> This is a throwaway spike. It will:"
echo "    - add @capacitor/{core,cli,ios,haptics,keep-awake,share,status-bar} (dev)"
echo "    - write capacitor.config.ts and create ios/"
echo "    - NOT be committed (discard the spike branch afterwards)"
echo "    appId=$APP_ID  appName=$APP_NAME"
read -r -p "Continue? [y/N] " ok
[ "$ok" = "y" ] || { echo "aborted"; exit 1; }

# 1. Build the app in LOCAL mode (empty API base → Dexie adapter, like the
#    tour/audit builds). A prod-API bundle would create junk anon users.
echo "==> Building local-mode bundle (build:tours)…"
pnpm run build:tours

# 2. Capacitor deps (into the throwaway working tree only).
echo "==> Installing Capacitor deps…"
pnpm add -D @capacitor/core @capacitor/cli @capacitor/ios \
  @capacitor/haptics @capacitor/keep-awake @capacitor/share @capacitor/status-bar

# 3. capacitor.config.ts (webDir = dist; the SPA uses hash routes so no
#    server.androidScheme/history gotchas — see readiness §A7).
echo "==> Writing capacitor.config.ts…"
cat > capacitor.config.ts <<EOF
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: '$APP_ID',
  appName: '$APP_NAME',
  webDir: 'dist',
  ios: { contentInset: 'always' },
  // Live reload: uncomment + set to your Mac's LAN IP over HTTPS
  // (getUserMedia needs a secure context on-device — mkcert a cert).
  // server: { url: 'https://192.168.1.42:3000', cleartext: false },
}

export default config
EOF

# 4. Add iOS + sync the web assets/plugins in.
echo "==> Adding iOS platform + syncing…"
npx cap add ios || true
npx cap sync ios

# 5. Info.plist: mic permission string (required or getUserMedia is denied
#    silently). Patch it if not already present.
PLIST="ios/App/App/Info.plist"
if [ -f "$PLIST" ] && ! grep -q NSMicrophoneUsageDescription "$PLIST"; then
  echo "==> Adding NSMicrophoneUsageDescription to Info.plist…"
  /usr/libexec/PlistBuddy -c \
    "Add :NSMicrophoneUsageDescription string 'MercuryPitch listens to your voice to score your pitch in real time.'" \
    "$PLIST" || echo "   (add NSMicrophoneUsageDescription manually in Xcode)"
fi

echo "==> Opening Xcode. Set a signing team, pick a device, Run."
npx cap open ios

cat <<'NEXT'

==> Smoke tests to run (fill findings into
    docs/plans/mobile-native/capacitor-readiness.md §B):
  B1 mic permission prompt (Singing → mic)      — prompts? denied-state OK?
  B2 earpiece routing (play melody, toggle mic) — output stays on speaker?
  B3 cold audio session (cold launch → play)    — first-play stutter?
  B4 pitch latency vs iOS Safari                — acceptable?
  B5 threaded ONNX (karaoke local separation)   — crossOriginIsolated? fallback?
  B6 IndexedDB persistence (fill DB, relaunch)  — navigator.storage.persist()?
  B7 background audio (lock mid-run)            — pauses cleanly?
  B8 live-reload over HTTPS (server.url)        — getUserMedia works on device?
  B9 R2 model fetch inside shell               — loads + caches?

To discard the spike:
  rm -rf ios capacitor.config.ts
  git checkout package.json pnpm-lock.yaml   # drop the capacitor deps
NEXT
