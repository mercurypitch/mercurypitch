// ============================================================
// Glass Take Recorder — compatibility re-export
// ============================================================

// Voice capture is shared with repeatable exercises. Keeping this module
// avoids widening the Glass feature diff and preserves existing imports.
export { createTakeRecorder, pickRecorderMime } from '@/lib/voice-capture'
export type { TakeRecorder } from '@/lib/voice-capture'
