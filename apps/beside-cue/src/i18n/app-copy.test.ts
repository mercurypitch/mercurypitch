// ============================================================
// App copy contract — complete languages with identical interpolation fields
// ============================================================

import { describe, expect, it } from 'vitest'
import { APP_COPY_CATALOGS } from './app-copy'

function placeholders(value: string): readonly string[] {
  return [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/gu)]
    .map((match) => match[1]!)
    .sort()
}

describe('App orchestration copy', () => {
  it('preserves exact English source templates', () => {
    expect(Object.keys(APP_COPY_CATALOGS.en)).toHaveLength(51)
    for (const [source, text] of Object.entries(APP_COPY_CATALOGS.en)) {
      expect(text).toBe(source)
    }
  })

  it.each(['es', 'de'] as const)(
    'covers every %s message and keeps dynamic values separate',
    (locale) => {
      const catalog = APP_COPY_CATALOGS[locale]
      expect(Object.keys(catalog)).toEqual(Object.keys(APP_COPY_CATALOGS.en))
      for (const [source, text] of Object.entries(catalog)) {
        expect(text.length).toBeGreaterThan(0)
        expect(text).not.toBe(source)
        expect(text).toBe(text.normalize('NFC'))
        expect(placeholders(text)).toEqual(placeholders(source))
      }
    },
  )

  it('keeps reminder times and validation subjects as placeholders, not translated personal text', () => {
    for (const locale of ['en', 'es', 'de'] as const) {
      expect(
        placeholders(
          APP_COPY_CATALOGS[locale][
            'Reminder set for {time}. You can change it in Settings.'
          ],
        ),
      ).toEqual(['time'])
      expect(
        placeholders(
          APP_COPY_CATALOGS[locale][
            '{subject} needs between 1 and 120 characters.'
          ],
        ),
      ).toEqual(['subject'])
    }
  })
})
