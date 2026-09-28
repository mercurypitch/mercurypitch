// Glassworks preview access — branch APK/TestFlight and local builds never require earned unlocks.
import type { BuildInfo } from '@/build-info'

/** The earned-progression preview can only remove development access, never grant it. */
export function hasDevelopmentGalleryAccess(
  channel: BuildInfo['channel'],
  search = '',
): boolean {
  return (
    (channel === 'dev' || channel === 'ci') &&
    new URLSearchParams(search).get('progression') !== 'earned'
  )
}
