import { afterEach, describe, expect, it } from 'vitest'
import { adminHashForPath, normalizeAdminEntryRoute, } from '@/lib/admin-entry-route'

describe('admin entry routes', () => {
  afterEach(() => history.replaceState(null, '', '/'))

  it.each([
    ['/admin', '#/admin/exercises'],
    ['/admin/', '#/admin/exercises'],
    ['/admin/exercises', '#/admin/exercises'],
    ['/admin/weekly', '#/admin/weekly'],
    ['/ADMIN/WEEKLY/', '#/admin/weekly'],
  ])('maps %s to %s', (pathname, hash) => {
    expect(adminHashForPath(pathname)).toBe(hash)
  })

  it('ignores paths outside the studio', () => {
    expect(adminHashForPath('/singing')).toBeNull()
    expect(adminHashForPath('/administrator')).toBeNull()
  })

  it('replaces a legacy hash without adding a history entry', () => {
    history.replaceState(null, '', '/admin/weekly/#home')

    expect(normalizeAdminEntryRoute()).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('#/admin/weekly')
  })

  it('preserves query parameters while canonicalizing', () => {
    history.replaceState(null, '', '/admin?source=bookmark')

    normalizeAdminEntryRoute()

    expect(window.location.href).toContain('/?source=bookmark#/admin/exercises')
  })
})
