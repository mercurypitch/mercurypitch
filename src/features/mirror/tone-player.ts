// ============================================================
// Voice Mirror tone-player compatibility entrypoint
// ============================================================
//
// Existing Mirror imports remain stable while the authored reference tone is
// shared with other local microphone tasks.

export {
  closeGuideToneBus,
  createGuideToneBus,
  playReferenceTone,
} from '@/lib/reference-tone'
