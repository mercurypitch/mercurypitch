// ============================================================
// Karaoke Settings Store — the preferences the Karaoke tab actually honours
// ============================================================
//
// These used to live behind the cogwheel in the Karaoke tab header, mixed in
// with four controls that were wired to nothing (`applyUvrSettings`, the only
// consumer of the separation mode / vocal intensity / instrumental intensity /
// smoothing signals, was never called from the app). Moving the real ones here
// puts them next to every other persisted preference and lets Settings own the
// surface, so the cogwheel does not have to grow a second settings system.
//
// Every signal here changes behaviour that exists today. Nothing is added
// speculatively — a switch that does nothing is worse than no switch.

import { createPersistedSignal } from '@/lib/storage'

/**
 * Index each separated song's vocal stem for Shazam & Sing.
 *
 * On by default and on since the feature shipped — this exposes the existing
 * behaviour rather than changing it. Turning it off skips fingerprint
 * extraction after separation, which is roughly a second of work per song and
 * the only reason a finished song keeps the CPU busy.
 */
export const [karaokeAutoIndexShazam, setKaraokeAutoIndexShazam] =
  createPersistedSignal<boolean>('pitchperfect_karaoke_auto_index_shazam', true)

/**
 * Run the shared denoise pipeline over a vocal stem before fingerprinting it.
 *
 * Cleaner fingerprints match better on noisy stems and worse on already-clean
 * ones. Key and default are inherited from the old cogwheel toggle so nobody's
 * preference is reset by the move.
 */
export const [karaokeStemDenoise, setKaraokeStemDenoise] =
  createPersistedSignal<boolean>('pitchperfect_stem_denoise', true, {
    // The old toggle wrote the bare strings 'true'/'false', not JSON.
    deserializer: (raw) => raw !== 'false',
    serializer: (value) => (value ? 'true' : 'false'),
  })
