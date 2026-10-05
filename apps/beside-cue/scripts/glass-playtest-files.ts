// ============================================================
// Playtest mounts — allow only the private galleries explicitly linked into .cache
// ============================================================

import fs, { type Dirent } from 'node:fs'
import { join } from 'node:path'
import { searchForWorkspaceRoot } from 'vite'

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function directoryRealpath(path: string): string | undefined {
  try {
    const realpath = fs.realpathSync(path)
    return fs.statSync(realpath).isDirectory() ? realpath : undefined
  } catch (error) {
    if (isMissing(error)) return undefined
    throw error
  }
}

export function glassPlaytestFileRoots(appRoot: string): string[] {
  const roots = new Set([searchForWorkspaceRoot(appRoot)])
  const cache = join(appRoot, '.cache')
  let entries: Dirent[]
  try {
    entries = fs.readdirSync(cache, { withFileTypes: true })
  } catch (error) {
    if (isMissing(error)) return [...roots]
    throw error
  }

  // Vite resolves module symlinks before checking its allow list. HTML/static
  // requests can appear to work while a fresh module transform rejects the
  // same gallery. Do not grant its parent directory or walk arbitrary links.
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const gallery = directoryRealpath(join(cache, entry.name))
    if (!gallery) continue
    roots.add(gallery)
    const assets = directoryRealpath(join(gallery, 'assets'))
    if (assets) roots.add(assets)
  }
  return [...roots]
}
