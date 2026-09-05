// ============================================================
// Selection policy — semantic attributes, never global event cancellation
// ============================================================

export const NoSelect = { 'data-selection': 'none' } as const
export const Selectable = { 'data-selection': 'text', dir: 'auto' } as const
export const NonCopyableArt = {
  ...NoSelect,
  'data-callout': 'none',
  draggable: false,
} as const

/** Global game handlers must leave native controls and editing hosts alone. */
export function isNativeInteractionTarget(event: Event): boolean {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.closest(
          'input, textarea, select, option, button, a, summary, [contenteditable]:not([contenteditable="false"]), [data-native-interaction]',
        ) !== null,
    )
}
