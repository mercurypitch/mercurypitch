// ============================================================
// Lesson step parts tests — each step shows its own parts, and only those
// ============================================================
//
// A part's list names the steps it shows on, spaces and all, and an empty
// list names none (the cases Lessons 9, 10 and 12 each held for their own
// copy). Moving to a step shows every part that lists it, a part the
// markup hid included, and hides every other; an element with no list,
// and a part outside the stage, are left as they are.

import { afterEach, describe, expect, it } from 'vitest'
import { partSteps, showParts } from './step-parts'

afterEach(() => {
  document.body.textContent = ''
})

/** A stage of parts, each with its `data-part` list, the markup's hidden ones hidden. */
function stage(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

/** Whether each element `selector` finds is hidden, in page order. */
const hiddenOf = (root: ParentNode, selector: string): boolean[] =>
  Array.from(root.querySelectorAll<HTMLElement>(selector), (e) => e.hidden)

describe("a part's steps", () => {
  it.each([
    [' 1  2 ', [1, 2]],
    [' 1  3 ', [1, 3]],
    [' 3  5 ', [3, 5]],
    ['4', [4]],
  ])('reads "%s" as steps %j', (list, steps) => {
    // Arrange
    const el = document.createElement('p')
    el.setAttribute('data-part', list)

    // Act
    const read = partSteps(el)

    // Assert
    expect(read).toEqual(steps)
  })

  it('reads nothing from an empty list, or from an element with none', () => {
    // Arrange
    const empty = document.createElement('p')
    empty.setAttribute('data-part', '')
    const none = document.createElement('p')

    // Act
    const read = [partSteps(empty), partSteps(none)]

    // Assert
    expect(read).toEqual([[], []])
  })
})

describe("a step's parts", () => {
  it('shows every part that lists the step and hides every other', () => {
    // Arrange
    const root = stage(`
      <button data-part="1" id="one"></button>
      <button data-part="2" id="two" hidden></button>
      <div data-part="2 3" id="row" hidden><button data-part="3" id="slow" hidden></button></div>
    `)

    // Act
    showParts(root, 2)

    // Assert
    expect(hiddenOf(root, '[data-part]')).toEqual([true, false, false, true])
  })

  it('shows a part again, the markup having hidden it, once its step comes back', () => {
    // Arrange
    const root = stage(`
      <button data-part="1" id="one"></button>
      <button data-part="3 4" id="slow" hidden></button>
    `)
    showParts(root, 2)

    // Act
    showParts(root, 4)

    // Assert
    expect(hiddenOf(root, '[data-part]')).toEqual([true, false])
  })

  it('leaves an element with no list, and a part outside the stage, as they are', () => {
    // Arrange
    const root = stage(`
      <p id="plain" hidden></p>
      <button id="nav"></button>
      <button data-part="1"></button>
    `)
    const outside = document.createElement('button')
    outside.setAttribute('data-part', '5')
    outside.hidden = true
    document.body.append(outside)

    // Act
    showParts(root, 5)

    // Assert
    expect(hiddenOf(root, '#plain, #nav')).toEqual([true, false])
    expect(outside.hidden).toBe(true)
  })
})
