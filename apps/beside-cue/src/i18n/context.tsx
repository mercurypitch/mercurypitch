// ============================================================
// Locale context — per-app reactive language without global mutable state
// ============================================================

import type { Accessor, JSX } from 'solid-js'
import { createContext, useContext } from 'solid-js'
import type { AppLocale } from './locale'

interface LocaleContextValue {
  readonly locale: Accessor<AppLocale>
  readonly changeDisabled: Accessor<boolean>
  readonly changeLocale: (locale: AppLocale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: (): AppLocale => 'en',
  changeDisabled: () => false,
  changeLocale: () => undefined,
})

/** A per-app context; tests and embedded screens remain English by default. */
export function LocaleProvider(props: {
  readonly locale: AppLocale
  readonly onLocaleChange: (locale: AppLocale) => void
  readonly changeDisabled?: boolean
  readonly children: JSX.Element
}) {
  const value: LocaleContextValue = {
    locale: () => props.locale,
    changeDisabled: () => props.changeDisabled === true,
    changeLocale: (locale) => {
      if (props.changeDisabled !== true) props.onLocaleChange(locale)
    },
  }
  return (
    <LocaleContext.Provider value={value}>
      {props.children}
    </LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
