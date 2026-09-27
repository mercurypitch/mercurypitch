// ============================================================
// AboutScreen — the app's own About
// ============================================================
//
// S6 step 9 (8b). The mark, the name, the version with its build, the two
// policies and a way to write to us, then the privacy line. The web's About
// carries a GitHub link, a third-party badge loaded from another site and
// pills for rooms the app does not have (audit D3 to D7); those stay on the
// web.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { CONTACT_FORM_URL } from '@/lib/contact-links'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { DocIcon, LockIcon, MailIcon, ShieldIcon } from '../icons'
import { loadDeviceFacts } from './device-facts'
import { SettingsGroup, SettingsLinkRow } from './SettingsList'

export function AboutScreen(): JSX.Element {
  const [version, setVersion] = createSignal<string | null>(null)
  let live = true
  onCleanup(() => {
    live = false
  })

  onMount(() => {
    void loadDeviceFacts().then((read) => {
      if (live) setVersion(read.version)
    })
  })

  return (
    <div class="mp-set" data-testid="about-screen">
      <div class="mp-about">
        <img class="mp-about__mark" src="/brand-mark.svg" alt="" />
        <strong class="mp-about__name">MercuryPitch</strong>
        <span class="mp-about__version">
          {version() === null
            ? 'Version not available'
            : `Version ${version()}`}
        </span>
      </div>
      <SettingsGroup>
        <SettingsLinkRow
          id="about-privacy"
          icon={<ShieldIcon />}
          label="Privacy policy"
          href={PRIVACY_URL}
        />
        <SettingsLinkRow
          id="about-terms"
          icon={<DocIcon />}
          label="Terms of use"
          href={TERMS_URL}
        />
        <SettingsLinkRow
          id="about-contact"
          icon={<MailIcon />}
          label="Contact us"
          href={CONTACT_FORM_URL}
        />
      </SettingsGroup>
      <p class="mp-set__privacy">
        <LockIcon size={14} /> Only you can hear you.
      </p>
    </div>
  )
}
