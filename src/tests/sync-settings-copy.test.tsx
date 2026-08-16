// ============================================================
// The sync panel names only routes that exist (CLAUDE-JOURNEY-024)
// ============================================================
//
// The "Your library" note told users to "export a song here and import
// it there" — but no export-to-file or import-from-file control exists
// anywhere in the app (the portable-bundle machinery serves the Drive
// backup and the Karaoke tab's device-to-device send, not a file the
// user can hold). The note now names exactly the two real routes.

import { render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/durable-write', () => ({
  storageEstimate: async () => null,
}))
vi.mock('@/db/persistent-storage', () => ({
  isStoragePersisted: async () => false,
  requestPersistentStorage: async () => false,
}))
vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => false,
  takeDriveConnectResult: () => null,
}))
vi.mock('@/db/services/song-manifest-service', () => ({
  readLibraryManifests: async () => [],
  syncLibraryList: async () => ({ here: 0, known: 0 }),
}))

const { SyncSettings } = await import('@/components/SyncSettings')

describe('SyncSettings copy', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('offers only the routes the app actually has', () => {
    const { container } = render(() => <SyncSettings />)
    const text = container.textContent ?? ''
    // The phantom third route is gone...
    expect(text).not.toContain('export a song here')
    // ...and the two real ones are still named.
    expect(text).toContain('Google Drive')
    expect(text).toContain('Karaoke tab')
  })
})
