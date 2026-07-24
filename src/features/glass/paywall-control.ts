// Paywall visibility — a tiny shared signal so any part of the game (level
// select, premium level tap, "unlock all" CTA) can request the paywall without
// prop-drilling. Pure Solid state, no native deps, so it is safe to import from
// shared components; on web (no GameShell mounted) opening it is simply inert.

import { createSignal } from 'solid-js'

export const [paywallOpen, setPaywallOpen] = createSignal(false)
export const openPaywall = (): void => {
  setPaywallOpen(true)
}
export const closePaywall = (): void => {
  setPaywallOpen(false)
}
