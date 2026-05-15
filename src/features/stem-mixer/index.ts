// ============================================================
// StemMixer feature barrel
// ============================================================

export { useStemMixerAudioController } from './useStemMixerAudioController'
export { useStemMixerCanvasController } from './useStemMixerCanvasController'
export { useStemMixerLayoutController } from './useStemMixerLayoutController'
export { useStemMixerLyricsController } from './useStemMixerLyricsController'
export { useStemMixerMicController } from './useStemMixerMicController'
export { PITCH_FFT_SIZE } from './useStemMixerMicController'

export type {
  LyricsBlock,
  BlockInfo,
  BlockStartsInfo,
  GenViewLine,
  WordTimingsMap,
  BlockInstancesMap,
} from './types'

export type {
  StemMixerAudioDeps,
  StemMixerAudioController,
} from './useStemMixerAudioController'
export type {
  StemMixerCanvasDeps,
  StemMixerCanvasController,
} from './useStemMixerCanvasController'
export type {
  StemMixerLayoutDeps,
  StemMixerLayoutController,
  WorkspacePanel,
  WorkspaceLayout,
} from './useStemMixerLayoutController'
export type {
  StemMixerLyricsDeps,
  StemMixerLyricsController,
} from './useStemMixerLyricsController'
export type {
  StemMixerMicDeps,
  StemMixerMicController,
} from './useStemMixerMicController'
