// ============================================================
// Lesson telemetry tests — what one answer sends, and when it sends nothing
// ============================================================

import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnswerSent } from './telemetry'
import { lessonConsent, sendLessonAnswer } from './telemetry'

const CONSENT_KEY = 'mp.consent.v1'

/** Lesson 1's question 4, answered right, asked on Lesson 2's page. */
const ANSWER: AnswerSent = { id: 'l01-q4', correct: true, k: 3, visit: 2 }

let fetchMock: Mock<typeof fetch>

/** The page as the site worker serves it: its state tag in the head. */
function stateTag(): void {
  const tag = document.createElement('script')
  tag.type = 'application/json'
  tag.id = 'lesson-state'
  tag.textContent = '{"version":1,"updatedAt":null,"lessons":{},"drafts":false}'
  document.head.append(tag)
}

const consentRecord = (status: string, implicit = false): void =>
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ status, at: 1_760_000_000_000, implicit }),
  )

/** The one request's body, parsed. */
function sentBody(): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const init = fetchMock.mock.calls[0][1]
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test')
  window.history.replaceState(null, '', '/learn/02')
  stateTag()
  fetchMock = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 201 }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.getElementById('lesson-state')?.remove()
  window.history.replaceState(null, '', '/')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendLessonAnswer', () => {
  it("posts the lesson pages' one client id, the event and its seven numbers, and no source", () => {
    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    const body = sentBody()
    expect(Object.keys(body)).toEqual(['clientId', 'event', 'metrics'])
    expect(body).toEqual({
      clientId: 'lesson-anonymous',
      event: 'lesson_answer',
      metrics: {
        page: 2,
        qLesson: 1,
        q: 4,
        firstTry: 1,
        k: 3,
        visit: 2,
        consent: 2,
      },
    })
  })

  it('sends a wrong first answer as firstTry 0', () => {
    // Act
    sendLessonAnswer({ ...ANSWER, correct: false })

    // Assert
    expect(sentBody().metrics).toMatchObject({ firstTry: 0 })
  })

  it('posts JSON to the event route with keepalive and no credentials', () => {
    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/api/mirror/event')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    })
  })

  it('sends nothing from a build with no API base', () => {
    // Arrange
    vi.stubEnv('VITE_API_BASE_URL', '')

    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing from a page no site worker served', () => {
    // Arrange: no state tag, as under pnpm dev or the e2e server
    document.getElementById('lesson-state')?.remove()

    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing for a visitor who declined consent', () => {
    // Arrange
    consentRecord('denied')

    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends consent 1 for a visitor who accepted', () => {
    // Arrange
    consentRecord('granted')

    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    expect(sentBody().metrics).toMatchObject({ consent: 1 })
  })

  it('sends consent 2 for a visitor with no consent record', () => {
    // Act
    sendLessonAnswer(ANSWER)

    // Assert
    expect(sentBody().metrics).toMatchObject({ consent: 2 })
  })

  it('throws nothing when the request is refused', async () => {
    // Arrange
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    // Act
    const send = (): void => sendLessonAnswer(ANSWER)

    // Assert
    expect(send).not.toThrow()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws nothing when fetch itself throws', () => {
    // Arrange
    fetchMock.mockImplementation(() => {
      throw new TypeError('fetch is not allowed here')
    })

    // Act
    const send = (): void => sendLessonAnswer(ANSWER)

    // Assert
    expect(send).not.toThrow()
  })
})

describe('lessonConsent', () => {
  it('reads a choice, and anything else as never asked', () => {
    // Arrange, act and assert, one record at a time
    expect(lessonConsent()).toBe(2)
    consentRecord('granted')
    expect(lessonConsent()).toBe(1)
    consentRecord('denied')
    expect(lessonConsent()).toBeNull()
    // a silent grant from before October 2026 is no choice (consent.ts)
    consentRecord('granted', true)
    expect(lessonConsent()).toBe(2)
    localStorage.setItem(CONSENT_KEY, '{not json')
    expect(lessonConsent()).toBe(2)
  })
})
