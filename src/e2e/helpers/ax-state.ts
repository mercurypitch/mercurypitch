// ============================================================
// What Chromium tells a screen reader about one element
// ============================================================
//
// Playwright's own role and state checks compute ARIA from the DOM. This
// reads the browser's accessibility tree over the DevTools protocol, which
// is what a screen reader is handed: a control at its end is said to be
// unavailable only if the tree marks it disabled, and it keeps the
// keyboard's place only if the tree still has it focusable and focused.
// Chromium only.

import type { Page } from '@playwright/test'

/** One element as the accessibility tree gives it. */
export interface AxState {
  readonly role: string
  readonly name: string
  /** Said to be unavailable: `disabled`, or `aria-disabled="true"`. */
  readonly disabled: boolean
  readonly focusable: boolean
  readonly focused: boolean
}

/** The accessibility tree's role, name and states for the first element `selector` finds. */
export async function axState(page: Page, selector: string): Promise<AxState> {
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('Accessibility.enable')
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
    })
    if (result.objectId === undefined) throw new Error(`no ${selector}`)
    const { node } = await cdp.send('DOM.describeNode', {
      objectId: result.objectId,
    })
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
      backendNodeId: node.backendNodeId,
      fetchRelatives: false,
    })
    const ax = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId)
    if (ax === undefined)
      throw new Error(`no accessibility node for ${selector}`)
    const state = (name: string): boolean =>
      ax.properties?.find((p) => p.name === name)?.value.value === true
    return {
      role: String(ax.role?.value ?? ''),
      name: String(ax.name?.value ?? ''),
      disabled: state('disabled'),
      focusable: state('focusable'),
      focused: state('focused'),
    }
  } finally {
    await cdp.detach()
  }
}
