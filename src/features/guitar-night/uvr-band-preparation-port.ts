// Guitar Night UVR band preparation preserves its factory over the shared split port.
// ============================================================

import { GUITAR_PLAY_ALONG_POLICY } from '@/features/play-along/song-port'
import { createUvrPlayAlongBandPreparationPort } from '@/features/play-along/uvr-band-preparation-port'
import type { GuitarNightBandPreparationPort } from './band-preparation-port'

export function createUvrGuitarNightBandPreparationPort(): GuitarNightBandPreparationPort {
  return createUvrPlayAlongBandPreparationPort(GUITAR_PLAY_ALONG_POLICY)
}
