// ============================================================
// LegalLinks — the in-app legal row, and the sign-up line
// ============================================================
//
// One row for every place the app lists its legal documents: Privacy, Terms
// and Imprint from LEGAL_DOCUMENT_LINKS, then Cookie settings. The entry
// documents carry the same three links as raw HTML (render-entry-page.ts), but
// that prelude hides itself once the app boots, so the booted app needs this.
//
// Cookie settings shows only where the page mounted the consent banner
// (canReopenConsent): a button that opens nothing is worse than no button.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { canReopenConsent, openConsentSettings } from '@/lib/consent'
import { LEGAL_DOCUMENT_LINKS, PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import styles from './LegalLinks.module.css'

export interface LegalLinksProps {
  /** Extra class for the row, so a host can place it. */
  class?: string
}

export function LegalLinks(props: LegalLinksProps): JSX.Element {
  return (
    <nav
      class={`${styles.row} ${props.class ?? ''}`}
      aria-label="Legal"
      data-testid="legal-links"
    >
      <For each={LEGAL_DOCUMENT_LINKS}>
        {(link) => (
          <a
            class={styles.item}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        )}
      </For>
      <Show when={canReopenConsent()}>
        <button
          type="button"
          class={styles.item}
          data-testid="legal-cookie-settings"
          onClick={() => openConsentSettings()}
        >
          Cookie settings
        </button>
      </Show>
    </nav>
  )
}

export interface SignUpLegalLineProps {
  /** Extra class, so a host with its own palette can restyle the line. */
  class?: string
}

/** Under a create-account button: what the new account agrees to. */
export function SignUpLegalLine(props: SignUpLegalLineProps): JSX.Element {
  return (
    <p
      class={`${styles.signUpLine} ${props.class ?? ''}`}
      data-testid="signup-legal-line"
    >
      By creating an account you accept our{' '}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
        Terms
      </a>
      . Our{' '}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
        Privacy&nbsp;Notice
      </a>{' '}
      explains what we keep and why.
    </p>
  )
}
