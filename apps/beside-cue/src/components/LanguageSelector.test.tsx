// ============================================================
// Language selector — reactive labels and locale changes
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n/context'
import type { AppLocale } from '@/i18n/locale'
import { LanguageSelector } from './LanguageSelector'

describe('LanguageSelector', () => {
  it('offers all released languages and changes the surrounding locale', () => {
    const [locale, setLocale] = createSignal<AppLocale>('en')
    const changed = vi.fn((next: AppLocale) => setLocale(next))
    render(() => (
      <LocaleProvider locale={locale()} onLocaleChange={changed}>
        <LanguageSelector showVoiceNote />
      </LocaleProvider>
    ))

    const select = screen.getByRole('combobox', {
      name: 'Choose interface language',
    })
    expect(screen.getAllByRole('option')).toHaveLength(3)
    fireEvent.change(select, { target: { value: 'de' } })

    expect(changed).toHaveBeenCalledWith('de')
    expect(
      screen.getByRole('combobox', {
        name: 'Sprache der Benutzeroberfläche wählen',
      }),
    ).toHaveValue('de')
    expect(screen.getByText(/übersetzte Untertitel/iu)).toBeInTheDocument()
  })
})
