// ============================================================
// Selection policy — native controls retain their own interaction
// ============================================================
import { describe, expect, it } from 'vitest'
import { isNativeInteractionTarget } from './selection'

describe('native interaction boundary', () => {
  it.each(['input', 'textarea', 'select', 'option', 'button', 'a', 'summary'])(
    'recognizes a nested %s target',
    (tag) => {
      const parent = document.createElement(tag)
      const child = document.createElement('span')
      parent.append(child)
      document.body.append(parent)
      let native = false
      parent.addEventListener('keydown', (event) => {
        native = isNativeInteractionTarget(event)
      })
      child.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      )
      expect(native).toBe(true)
      parent.remove()
    },
  )

  it('uses the composed path for a native input inside a shadow root', () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    root.append(input)
    document.body.append(host)
    let native = false
    host.addEventListener('keydown', (event) => {
      native = isNativeInteractionTarget(event)
    })
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }),
    )
    expect(native).toBe(true)
    host.remove()
  })

  it('does not suppress the game surface', () => {
    const canvas = document.createElement('canvas')
    let native = true
    canvas.addEventListener('keydown', (event) => {
      native = isNativeInteractionTarget(event)
    })
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(native).toBe(false)
  })
})
