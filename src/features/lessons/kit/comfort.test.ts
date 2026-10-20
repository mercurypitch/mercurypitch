// ============================================================
// Comfort tests — the singer's report decides what comes next
// ============================================================

import { describe, expect, it } from 'vitest'
import { afterFeeling, FEELINGS, mountFeelings, VisitEnding } from './comfort'

describe('afterFeeling', () => {
  it('after "Uncomfortable" shows no count and offers no retry, only rest and the doctor lines', () => {
    // Act
    const after = afterFeeling('uncomfortable')

    // Assert
    expect(after).toEqual({
      count: false,
      tricky: false,
      again: false,
      closing: 'enough',
      doctor: true,
      rest: true,
    })
  })

  it('after "Effortful" keeps the count but offers no retry and no encouragement to go again', () => {
    // Act
    const after = afterFeeling('effortful')

    // Assert
    expect([after.count, after.again, after.tricky]).toEqual([
      true,
      false,
      false,
    ])
    expect(after.closing).toBe('gentle')
    expect(after.rest).toBe(false)
  })

  it('after "Easy" or "Workable" shows the count and may offer the run once more', () => {
    // Act
    const answers = (['easy', 'workable'] as const).map(afterFeeling)

    // Assert
    for (const after of answers) {
      expect([after.count, after.again, after.tricky]).toEqual([
        true,
        true,
        true,
      ])
      expect([after.closing, after.doctor, after.rest]).toEqual([
        null,
        false,
        false,
      ])
    }
  })

  it('never offers a retry for any answer that reports effort or discomfort', () => {
    // Act
    const retries = FEELINGS.filter((f) => afterFeeling(f).again)

    // Assert
    expect(retries).toEqual(['easy', 'workable'])
  })
})

describe('mountFeelings', () => {
  it('takes one answer, marks it pressed and locks the other three', () => {
    // Arrange
    const root = document.createElement('div')
    root.innerHTML = FEELINGS.map(
      (f) =>
        `<button type="button" data-feel="${f}" aria-pressed="false">${f}</button>`,
    ).join('')
    const heard: string[] = []
    mountFeelings(root, (f) => heard.push(f))

    // Act
    root.querySelector<HTMLButtonElement>('[data-feel="effortful"]')?.click()

    // Assert
    expect(heard).toEqual(['effortful'])
    const pressed = Array.from(root.querySelectorAll('button')).map((b) => [
      b.dataset.feel,
      b.getAttribute('aria-pressed'),
      b.disabled,
    ])
    expect(pressed).toEqual([
      ['easy', 'false', true],
      ['workable', 'false', true],
      ['effortful', 'true', true],
      ['uncomfortable', 'false', true],
    ])
  })

  it('when changeable, keeps every answer open and moves the press to a later tap', () => {
    // Arrange
    const root = document.createElement('div')
    root.innerHTML = FEELINGS.map(
      (f) =>
        `<button type="button" data-feel="${f}" aria-pressed="false">${f}</button>`,
    ).join('')
    const heard: string[] = []
    mountFeelings(root, (f) => heard.push(f), { changeable: true })

    // Act
    root.querySelector<HTMLButtonElement>('[data-feel="easy"]')?.click()
    root.querySelector<HTMLButtonElement>('[data-feel="workable"]')?.click()

    // Assert
    expect(heard).toEqual(['easy', 'workable'])
    const pressed = Array.from(root.querySelectorAll('button')).map((b) => [
      b.dataset.feel,
      b.getAttribute('aria-pressed'),
      b.disabled,
    ])
    expect(pressed).toEqual([
      ['easy', 'false', false],
      ['workable', 'true', false],
      ['effortful', 'false', false],
      ['uncomfortable', 'false', false],
    ])
  })
})

describe('VisitEnding', () => {
  it('opens on the practise card and tells its listeners when rest replaces it', () => {
    // Arrange
    const seen: string[] = []
    VisitEnding.subscribe((e) => seen.push(e))

    // Act
    VisitEnding.set('rest')

    // Assert
    expect(seen).toEqual(['practise', 'rest'])
    VisitEnding.set('practise')
  })
})
