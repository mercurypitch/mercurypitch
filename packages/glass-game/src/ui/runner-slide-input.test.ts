// Held slide input — keyboard, pointer and accessible toggle share one cancellable stance.
import { describe, expect, it, vi } from 'vitest'
import { createRunnerContinuousInput } from './runner-continuous-input'
import type { RunnerKeyboardEdgeEvent } from './runner-input'
import { createRunnerInputEdges } from './runner-input'

function key(
  code: string,
  patch: Partial<RunnerKeyboardEdgeEvent> = {},
): RunnerKeyboardEdgeEvent {
  return {
    code,
    repeat: false,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...patch,
  }
}

for (const mode of ['lanes', 'steering'])
  describe(`${mode} held slide`, () => {
    function setup() {
      const slide = vi.fn(() => true)
      const edge = vi.fn(() => true)
      const input =
        mode === 'lanes'
          ? createRunnerInputEdges(edge, slide)
          : createRunnerContinuousInput(edge, () => true, slide)
      input.setEnabled(true)
      return { input, slide, edge }
    }
    it('keeps slide held until the final keyboard alias and pointer release', () => {
      const { input, slide, edge } = setup()
      input.key(key('ArrowDown'), true)
      input.key(key('KeyS'), true)
      input.key(key('KeyS', { repeat: true }), true)
      expect(input.pointerDown('slide', 7)).toBe(true)
      input.key(key('ArrowDown'), false)
      input.key(key('KeyS'), false)
      expect(slide.mock.calls).toEqual([[true]])
      expect(input.pointerEnd('slide', 8)).toBe(false)
      input.pointerEnd('slide', 7)
      expect(slide.mock.calls).toEqual([[true], [false]])
      expect(edge).not.toHaveBeenCalled()
    })
    it('toggles accessible activation without releasing an independent pointer hold', () => {
      const { input, slide } = setup()
      expect(input.activate('slide')).toBe(true)
      input.pointerDown('slide', 7)
      expect(input.activate('slide')).toBe(true)
      expect(slide.mock.calls).toEqual([[true]])
      input.pointerEnd('slide', 7)
      expect(slide.mock.calls).toEqual([[true], [false]])
    })
    it.each(['clear', 'disable'] as const)(
      'releases on %s and requires a fresh key press',
      (mode) => {
        const { input, slide } = setup()
        input.key(key('ArrowDown'), true)
        input.pointerDown('slide', 7)
        if (mode === 'clear') input.clear()
        else input.setEnabled(false)
        input.setEnabled(true)
        input.key(key('ArrowDown', { repeat: true }), true)
        input.pointerEnd('slide', 7)
        expect(slide.mock.calls).toEqual([[true], [false]])
        input.key(key('ArrowDown'), false)
        input.key(key('ArrowDown'), true)
        expect(slide.mock.calls).toEqual([[true], [false], [true]])
      },
    )
    it('does not steal editing or modifier shortcuts', () => {
      const { input, slide } = setup()
      const target = {
        isContentEditable: true,
        closest: () => null,
      } as unknown as EventTarget
      expect(input.key(key('KeyS', { target }), true)).toBe(false)
      expect(input.key(key('KeyS', { ctrlKey: true }), true)).toBe(false)
      expect(slide).not.toHaveBeenCalled()
    })
    it('lets Down and S keep working when a course button has focus', () => {
      const { input, slide } = setup()
      const target = {
        closest: (selector: string) =>
          selector.includes('Course controls') || selector.includes('button')
            ? {}
            : null,
      } as unknown as EventTarget
      input.key(key('ArrowDown', { target }), true)
      input.key(key('ArrowDown', { target }), false)
      expect(slide.mock.calls).toEqual([[true], [false]])
    })
    it('lets a synchronous recovery clear win over the triggering slide contact', () => {
      const held: boolean[] = []
      const slide = (value: boolean) => {
        held.push(value)
        if (value) input.setEnabled(false)
        return true
      }
      const input =
        mode === 'lanes'
          ? createRunnerInputEdges(() => true, slide)
          : createRunnerContinuousInput(
              () => true,
              () => true,
              slide,
            )
      input.setEnabled(true)
      expect(input.pointerDown('slide', 8)).toBe(false)
      expect(held).toEqual([true, false])
      input.setEnabled(true)
      expect(input.pointerEnd('slide', 8)).toBe(false)
      expect(held).toEqual([true, false])
    })
    it('forgets rejected airborne starts so a fresh accessible or physical press works', () => {
      let grounded = false
      const slide = vi.fn((held: boolean) => !held || grounded)
      const input =
        mode === 'lanes'
          ? createRunnerInputEdges(() => true, slide)
          : createRunnerContinuousInput(
              () => true,
              () => true,
              slide,
            )
      input.setEnabled(true)
      expect(input.activate('slide')).toBe(false)
      expect(input.pointerDown('slide', 7)).toBe(false)
      input.key(key('KeyS'), true)
      grounded = true
      input.key(key('KeyS', { repeat: true }), true)
      expect(slide.mock.calls).toEqual([[true], [true], [true]])
      expect(input.activate('slide')).toBe(true)
      expect(input.activate('slide')).toBe(true)
      expect(input.pointerDown('slide', 7)).toBe(true)
      expect(input.pointerEnd('slide', 7)).toBe(true)
      expect(slide.mock.calls.slice(3)).toEqual([
        [true],
        [false],
        [true],
        [false],
      ])
    })
  })

it('separates slide, jump and steering contacts without pointer reuse', () => {
  const slide = vi.fn(() => true)
  const input = createRunnerContinuousInput(
    () => true,
    () => true,
    slide,
  )
  input.setEnabled(true)
  expect(input.steeringDown(1, 100, 40)).toBe(true)
  expect(input.pointerDown('slide', 1)).toBe(false)
  expect(input.pointerDown('slide', 2)).toBe(true)
  expect(input.steeringDown(2, 100, 40)).toBe(false)
  expect(input.pointerDown('jump', 3)).toBe(true)
  input.pointerEnd('jump', 3)
  input.steeringEnd(1)
  expect(slide.mock.calls).toEqual([[true]])
  input.pointerEnd('slide', 2)
  expect(slide.mock.calls).toEqual([[true], [false]])
})

it('leaves slide keys and contacts untouched when the course has no slide action', () => {
  const input = createRunnerInputEdges(() => true)
  input.setEnabled(true)
  expect(input.key(key('ArrowDown'), true)).toBe(false)
  expect(input.pointerDown('slide', 1)).toBe(false)
  expect(input.activate('slide')).toBe(false)
})
