#!/usr/bin/env bash
# Compile and run the bounded native diagnostic contract on the macOS CI host.
set -euo pipefail
app_root="$(cd "$(dirname "$0")/.." && pwd)"
probe_directory="$(mktemp -d)"
trap 'rm -rf "$probe_directory"' EXIT
xcrun --sdk macosx swiftc -swift-version 5 -parse-as-library \
  "$app_root/App/GameDiagnosticStore.swift" \
  "$app_root/App/GameDiagnosticNavigationDelegate.swift" \
  "$app_root/Tests/GameDiagnosticsProbe.swift" \
  -o "$probe_directory/game-diagnostics-probe"
"$probe_directory/game-diagnostics-probe"
