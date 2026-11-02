// ============================================================
// CommunityContact — the contact form, at the foot of Community
// ============================================================
//
// App Store guideline 1.2 asks an app whose singers post for published
// contact information, beside the report and block a "..." offers. As the
// singer sheet's contact line does (slice 4b), this opens the contact form
// on its support topic, the first line naming where it came from: a link
// to a new window, which the phone hands to its browser.

import type { JSX } from 'solid-js'
import { contactFormUrl } from '@/lib/contact-links'
import { CONTACT_LEAD, CONTACT_MESSAGE } from './community-lines'

export function CommunityContact(): JSX.Element {
  return (
    <div class="mp-community-contact" data-testid="community-contact">
      <p class="mp-set__caption">{CONTACT_LEAD}</p>
      <a
        class="mp-set-button mp-set-button--secondary mp-set-button--small"
        href={contactFormUrl('support', CONTACT_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Contact us
      </a>
    </div>
  )
}
