// Local database gives standalone rooms a narrow device-only Dexie lifetime.
// ============================================================

import { DexieAdapter } from './adapters/dexie-adapter'

let localDatabase: DexieAdapter | null = null

/** Device-only adapter; standalone route changes create a new document lifetime. */
export function getLocalDatabase(): DexieAdapter {
  localDatabase ??= new DexieAdapter()
  return localDatabase
}

/**
 * Close this second connection to the same on-device database. Piano Night
 * and the karaoke read path open it; left open, it kept deleteDatabase
 * waiting forever during a factory reset.
 */
export function closeLocalDatabase(): void {
  localDatabase?.close()
  localDatabase = null
}
