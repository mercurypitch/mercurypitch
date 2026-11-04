// ============================================================
// useEditorController — Share when the clipboard says no
// ============================================================
//
// The share handler wrote the URL with a success handler and nothing else.
// A clipboard that refuses (a page that is not a secure context, a denied
// permission, Safari outside a gesture) rejected unhandled: no word to the
// singer, and the app's error boundary raised the crash screen. The handler
// has no button wired to it today, which is why this was filed low; it would
// ship the day the editor toolbar gains one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import { notifications, resetNotifications } from '@/stores/notifications-store'
import { useEditorController } from './useEditorController'

const unhandled: unknown[] = []
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason)
}

beforeEach(() => {
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandled)
  resetNotifications()
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandled)
  vi.unstubAllGlobals()
  resetNotifications()
})

describe('useEditorController.handleShare', () => {
  it('says the link was not copied when the clipboard refuses, and nothing escapes', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: () =>
          Promise.reject(new DOMException('Write denied', 'NotAllowedError')),
      },
    })
    const editor = useEditorController({ audioEngine: {} as AudioEngine })

    editor.handleShare()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(unhandled).toEqual([])
    expect(notifications().map((n) => [n.type, n.message])).toEqual([
      ['error', 'Could not copy the share link'],
    ])
  })
})
