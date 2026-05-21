import type { Component, JSX } from 'solid-js'
import { splitProps } from 'solid-js'

/**
 * SafeSelect — Drop-in replacement for native `<select>` that documents
 * and guards against the iOS Safari / WebKit `transform` bug.
 *
 * ## The bug
 * On iOS Safari, a native `<select>` element inside an ancestor with a CSS
 * `transform` property (e.g. `transform: translateX(...)`, `transform:
 * scale(...)`, or any value other than `none`) will either:
 *   - fail to open the native picker wheel,
 *   - render a blank picker, or
 *   - crash the page entirely.
 *
 * This is a long-standing WebKit bug. See:
 *   https://bugs.webkit.org/show_bug.cgi?id=172510
 *
 * ## What this component does
 * 1. In development mode, it logs a console warning if a `<select>` is
 *    rendered inside a `transform`-ed ancestor, helping catch the bug early.
 * 2. Serves as a single place to document the issue so every developer
 *    doesn't have to rediscover it.
 * 3. Provides a natural refactoring point if we ever need a non-native
 *    dropdown to work around the bug globally.
 *
 * ## Usage
 * Replace `<select>` with `<SafeSelect>`. All props are forwarded.
 *
 * ```tsx
 * import { SafeSelect } from '@/components/shared/SafeSelect'
 *
 * <SafeSelect class="my-dropdown" onChange={handleChange}>
 *   <option value="a">A</option>
 *   <option value="b">B</option>
 * </SafeSelect>
 * ```
 *
 * ## CSS guidelines for ancestors
 * - NEVER use `transform` on a container that wraps a `<select>`.
 * - For slide-in panels (sidebars, drawers), animate `left` / `right`
 *   instead of `transform: translateX(...)`.
 * - For modals, use `position: fixed` centering with flexbox/grid,
 *   not `transform: translate(-50%, -50%)`.
 * - Transient transforms on `:hover` / `:active` pseudo-states are
 *   generally safe because the picker is not open during those states,
 *   but avoid them on the direct parent of a `<select>` to be safe.
 */
export const SafeSelect: Component<
  JSX.SelectHTMLAttributes<HTMLSelectElement>
> = (props) => {
  const [local, selectProps] = splitProps(props, ['ref'])

  const checkAncestorTransform = (el: HTMLSelectElement) => {
    // Forward the ref if provided
    if (typeof local.ref === 'function') {
      local.ref(el)
    }

    // Dev-only: walk up the DOM tree and warn if any ancestor has transform
    if (import.meta.env.DEV) {
      const checkFn = () => {
        let current: HTMLElement | null = el.parentElement
        while (current) {
          const style = window.getComputedStyle(current)
          if (style.transform && style.transform !== 'none') {
            console.warn(
              `[SafeSelect] iOS Safari bug: <select> is inside a ` +
                `transform-ed ancestor.\n` +
                `  Ancestor: <${current.tagName.toLowerCase()}` +
                `${current.id ? ` id="${current.id}"` : ''}` +
                `${current.className ? ` class="${String(current.className).slice(0, 60)}"` : ''}>\n` +
                `  Transform: ${style.transform}\n` +
                `  Fix: use position/left/right animation instead of transform, ` +
                `or move the <select> outside the transformed container.`,
              el,
            )
            break
          }
          current = current.parentElement
        }
      }

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(checkFn)
      } else {
        setTimeout(checkFn, 100)
      }
    }
  }

  return <select ref={(el) => checkAncestorTransform(el)} {...selectProps} />
}
