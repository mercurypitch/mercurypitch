// What build is this, exactly.
// ============================================================
//
// "version 0.1" was hard-coded into two screens, so every build ever made
// claimed to be the same one. On a device that is worse than no version
// at all: a test result cannot be attached to a commit, and "it still
// does the thing" cannot be distinguished from "I am running yesterday's
// APK".
//
// These values are baked in by `vite.config.ts` at build time, so the
// running app carries its own provenance and nothing has to be looked up.

declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_DIRTY__: boolean
declare const __APP_CHANNEL__: 'dev' | 'ci' | 'release'

export interface BuildInfo {
  /** From package.json. */
  version: string
  /** Short git sha, or 'unknown' when built outside a checkout. */
  commit: string
  /** The working tree had uncommitted changes when this was built. */
  dirty: boolean
  /** dev = someone's laptop, ci = a branch/PR build, release = a tag. */
  channel: 'dev' | 'ci' | 'release'
}

export const BUILD: BuildInfo = {
  version: __APP_VERSION__,
  commit: __APP_COMMIT__,
  dirty: __APP_DIRTY__,
  channel: __APP_CHANNEL__,
}

/**
 * The stamp as one line.
 *
 * A release says only what it is — `0.1.0`. Anything else leads with the
 * channel and carries the sha, because that is the build where the
 * question "which one is this?" actually gets asked. A trailing asterisk
 * means the tree was dirty, i.e. the sha alone will not reproduce it.
 */
export const buildLabel = (): string => {
  const sha = `${BUILD.commit}${BUILD.dirty ? '*' : ''}`
  return BUILD.channel === 'release'
    ? BUILD.version
    : `${BUILD.channel} · ${BUILD.version} · ${sha}`
}
