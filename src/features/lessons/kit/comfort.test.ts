// ============================================================
// Comfort tests — the singer's report decides what comes next
// ============================================================

import { describe, expect, it } from 'vitest'
import { afterFeeling, FEELINGS, mountFeelings, mountPractiseCard, VisitEnding, } from './comfort'

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
    const answers = (['easy', 'workable'] as const).map((f) => afterFeeling(f))

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

  it('sends "Effortful" to the rest card when the page asks, its answer otherwise the same', () => {
    // Act
    const after = afterFeeling('effortful', { restAfterEffort: true })

    // Assert
    expect(after).toEqual({ ...afterFeeling('effortful'), rest: true })
  })

  it('leaves every other answer as it was when the page sends effort to the rest card', () => {
    // Act
    const others = (['easy', 'workable', 'uncomfortable'] as const).map((f) => [
      afterFeeling(f, { restAfterEffort: true }),
      afterFeeling(f),
    ])

    // Assert
    for (const [asked, plain] of others) expect(asked).toEqual(plain)
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

describe('mountPractiseCard', () => {
  /** Lesson 3's card: one link to Voice Mirror, its body in two versions and its address. */
  function card(): HTMLAnchorElement {
    const a = document.createElement('a')
    a.id = 'practiseCard'
    a.href = '/mirror?lesson=03'
    a.target = '_blank'
    a.innerHTML =
      '<p class="eyebrow"><span class="fig">Practise it</span> in MercuryPitch</p><div data-ending="practise">Sing along</div><div data-ending="rest" hidden>Voice Mirror will be here.</div><span class="addr">mercurypitch.com/mirror</span>'
    document.body.appendChild(a)
    return a
  }

  it('after discomfort is no link, says "Rest today", and shows only the rest version', () => {
    // Arrange
    const a = card()
    mountPractiseCard(a)

    // Act
    VisitEnding.set('rest')

    // Assert
    const shown = Array.from(a.querySelectorAll<HTMLElement>('[data-ending]'))
      .filter((el) => !el.hidden)
      .map((el) => el.textContent)
    expect(a.hasAttribute('href')).toBe(false)
    expect(a.hasAttribute('target')).toBe(false)
    expect(a.querySelector('.eyebrow')?.textContent).toBe('Rest today')
    expect(shown).toEqual(['Voice Mirror will be here.'])
    expect(a.querySelector<HTMLElement>('.addr')?.hidden).toBe(true)
    VisitEnding.set('practise')
    document.body.textContent = ''
  })

  it('opens as the link to the room, and is that link again for the practise ending', () => {
    // Arrange
    const a = card()
    mountPractiseCard(a)
    VisitEnding.set('rest')

    // Act
    VisitEnding.set('practise')

    // Assert
    expect(a.getAttribute('href')).toBe('/mirror?lesson=03')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.querySelector('.eyebrow')?.textContent).toBe(
      'Practise it in MercuryPitch',
    )
    expect(a.querySelector<HTMLElement>('.addr')?.hidden).toBe(false)
    document.body.textContent = ''
  })
})
