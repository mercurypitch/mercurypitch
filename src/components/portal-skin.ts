// ============================================================
// Portal skin bridge — carry a caller's resolved theme into body portals
// ============================================================
//
// A Portal leaves the DOM subtree that supplied its custom properties and
// color-scheme. Sampling a hidden anchor at the call site and applying that
// resolved skin to the portalled root keeps dialogs, menus, and sheets in the
// originating surface without changing document.body or the app-wide theme.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'

export type PortalSkin = Record<string, string>

export interface PortalSkinBridge {
  anchorRef: (element: HTMLElement) => void
  style: Accessor<PortalSkin>
}

/** Resolve the caller's complete custom-property cascade. The nearest
 * declaration wins, matching CSS inheritance. Walking outward also keeps the
 * bridge useful in DOM implementations that enumerate only locally declared
 * custom properties. */
function resolvePortalSkin(anchor: HTMLElement): PortalSkin {
  const resolved: PortalSkin = {}
  let colorScheme = ''
  let node: Element | null = anchor

  while (node !== null) {
    const computed = window.getComputedStyle(node)
    if (colorScheme === '') colorScheme = computed.colorScheme.trim()
    for (let index = 0; index < computed.length; index += 1) {
      const name = computed.item(index)
      if (!name.startsWith('--') || name in resolved) continue
      const value = computed.getPropertyValue(name).trim()
      if (value !== '') resolved[name] = value
    }
    node = node.parentElement
  }

  if (colorScheme !== '') resolved['color-scheme'] = colorScheme

  return resolved
}

/** Create a call-site anchor and a reactive style for a portalled root.
 * Resampling on each open mirrors the existing Sheet behavior and picks up a
 * theme change made while the portal was closed. */
export function createPortalSkinBridge(
  active: Accessor<boolean>,
): PortalSkinBridge {
  const [anchor, setAnchor] = createSignal<HTMLElement>()
  const [style, setStyle] = createSignal<PortalSkin>({})

  createEffect(() => {
    if (!active()) return
    const source = anchor()
    if (
      source === undefined ||
      typeof window === 'undefined' ||
      typeof window.getComputedStyle !== 'function'
    ) {
      return
    }
    setStyle(resolvePortalSkin(source))
  })

  return {
    anchorRef: (element) => {
      setAnchor(element)
    },
    style,
  }
}
