// Play-along song-port loaders preserve a dynamic boundary around durable UVR state.
// ============================================================

import type { PlayAlongSongSourcePort, PlayAlongTargetPolicy, PlayAlongTargetStemKind, } from './song-port'

/** Load the IndexedDB-backed UVR adapter only after a song surface asks. */
export async function loadUvrPlayAlongSongPort<
  TTarget extends PlayAlongTargetStemKind,
>(
  policy: PlayAlongTargetPolicy<TTarget>,
): Promise<PlayAlongSongSourcePort<TTarget>> {
  const module = await import('./uvr-song-port')
  return module.createUvrPlayAlongSongPort(policy)
}
