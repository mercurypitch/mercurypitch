// ============================================================
// UI copy — locale parity, interpolation and reactive context coverage
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from './context'
import type { AppLocale } from './locale'
import { AVAILABLE_LOCALES } from './locale'
import { UI_COPY_CATALOGS, useCopy } from './ui-copy'

describe('UI copy', () => {
  it('keeps the same complete source catalog in every released locale', () => {
    const englishKeys = Object.keys(UI_COPY_CATALOGS.en).sort()
    for (const locale of AVAILABLE_LOCALES) {
      expect(Object.keys(UI_COPY_CATALOGS[locale]).sort()).toEqual(englishKeys)
      expect(Object.values(UI_COPY_CATALOGS[locale])).not.toContain('')
    }
  })

  it('reacts to a provider locale change without a global singleton', () => {
    const [locale, setLocale] = createSignal<AppLocale>('en')

    function Probe() {
      const copy = useCopy()
      return (
        <button type="button" onClick={() => setLocale('de')}>
          {copy.t('Choose interface language')}
        </button>
      )
    }

    render(() => (
      <LocaleProvider locale={locale()} onLocaleChange={setLocale}>
        <Probe />
      </LocaleProvider>
    ))

    const button = screen.getByRole('button', {
      name: 'Choose interface language',
    })
    button.click()
    expect(
      screen.getByRole('button', {
        name: 'Sprache der Benutzeroberfläche wählen',
      }),
    ).toBeInTheDocument()
  })
})
