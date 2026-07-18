import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useConfirm } from '@/lib/use-confirm'

describe('useConfirm', () => {
  it('starts closed', () => {
    createRoot((dispose) => {
      const c = useConfirm()
      expect(c.pending()).toBeNull()
      dispose()
    })
  })

  it('opens on request and runs onConfirm on accept', () => {
    createRoot((dispose) => {
      const onConfirm = vi.fn()
      const c = useConfirm()
      c.request({ title: 'T', message: 'M', onConfirm })
      expect(c.pending()?.title).toBe('T')
      c.accept()
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(c.pending()).toBeNull()
      dispose()
    })
  })

  it('does not run onConfirm on cancel', () => {
    createRoot((dispose) => {
      const onConfirm = vi.fn()
      const c = useConfirm()
      c.request({ title: 'T', message: 'M', onConfirm })
      c.cancel()
      expect(onConfirm).not.toHaveBeenCalled()
      expect(c.pending()).toBeNull()
      dispose()
    })
  })

  it('the latest request wins', () => {
    createRoot((dispose) => {
      const first = vi.fn()
      const second = vi.fn()
      const c = useConfirm()
      c.request({ title: 'first', message: 'M', onConfirm: first })
      c.request({ title: 'second', message: 'M', onConfirm: second })
      expect(c.pending()?.title).toBe('second')
      c.accept()
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledOnce()
      dispose()
    })
  })
})
