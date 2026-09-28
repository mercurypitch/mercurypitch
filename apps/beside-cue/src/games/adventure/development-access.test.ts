// Build-channel unlock tests — production-mode branch builds are still owner previews.
import { describe, expect, it } from 'vitest'
import { hasDevelopmentGalleryAccess } from './development-access'

describe('development gallery access', () => {
  it('unlocks local and native branch previews without depending on Vite DEV', () => {
    expect(hasDevelopmentGalleryAccess('dev')).toBe(true)
    expect(hasDevelopmentGalleryAccess('ci')).toBe(true)
  })
  it('can preview earned progression without granting release access', () => {
    expect(hasDevelopmentGalleryAccess('dev', '?progression=earned')).toBe(
      false,
    )
    expect(hasDevelopmentGalleryAccess('ci', '?progression=earned')).toBe(false)
    expect(
      hasDevelopmentGalleryAccess('release', '?progression=unlocked'),
    ).toBe(false)
  })
  it('enforces the normal journey on tagged user releases', () => {
    expect(hasDevelopmentGalleryAccess('release')).toBe(false)
  })
})
