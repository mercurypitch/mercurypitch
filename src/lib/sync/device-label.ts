// ── Device label ─────────────────────────────────────────────────────
// What one device calls itself to another during a sync.
//
// Shown on the far side ("Connected: Android phone"), so the person
// standing between two of their own devices can tell which one just
// connected. A user-agent sniff is exactly wrong for feature decisions
// and exactly right for a friendly name: being wrong here mislabels a
// chip, nothing more.

import { isTvDevice } from '@/lib/device-tier'

export function syncDeviceLabel(): string {
  if (isTvDevice()) return 'TV'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  // Modern iPadOS reports itself as macOS; the touch check catches it.
  if (
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return 'iPad'
  }
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet'
  }
  return 'Computer'
}
