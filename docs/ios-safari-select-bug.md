# iOS Safari: CSS `transform` breaks native `<select>` pickers

## The Bug

On iOS Safari (all versions as of 2026), a native `<select>` element
rendered inside an ancestor that has a CSS `transform` property will
**fail to open the native picker wheel, render a blank picker, or
crash the page**.

This is a well-known WebKit bug:
- https://bugs.webkit.org/show_bug.cgi?id=172510

The issue occurs with **any** `transform` value other than `none`,
including `translateX`, `translateY`, `scale`, `rotate`, etc.

## Rules

1. **Never** use `transform` on a container that wraps a `<select>`.

2. **For slide-in panels** (sidebars, drawers, sheets), animate using
   `left` / `right` / `top` / `bottom` instead of `transform: translateX()`.
   Add `will-change: left` for GPU compositing.

   ```css
   /* BAD -- breaks <select> on iOS */
   .sidebar {
     transform: translateX(-100%);
     transition: transform 0.3s;
   }
   .sidebar.open {
     transform: translateX(0);
   }

   /* GOOD -- works on iOS */
   .sidebar {
     left: -270px;
     will-change: left;
     transition: left 0.22s ease;
   }
   .sidebar.open {
     left: 0;
   }
   ```

3. **For modals/dialogs**, center using flexbox or grid on the overlay,
   not `transform: translate(-50%, -50%)`.

   ```css
   /* BAD -- breaks <select> on iOS */
   .modal {
     position: fixed;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
   }

   /* GOOD -- works on iOS */
   .modal-overlay {
     position: fixed;
     inset: 0;
     display: flex;
     align-items: center;
     justify-content: center;
   }
   ```

4. **Transient transforms** on `:hover` / `:active` are generally safe
   because the picker isn't open during those states. But avoid them on
   the **direct parent** of a `<select>` to be safe.

5. **Use `<SafeSelect>`** instead of raw `<select>` when possible. It
   warns in dev mode if a transform-ed ancestor is detected.

   ```tsx
   import { SafeSelect } from '@/components/shared/SafeSelect'

   <SafeSelect class="my-dropdown" onChange={handleChange}>
     <option value="a">A</option>
   </SafeSelect>
   ```

## CSS Module Load Order

A related issue: Vite loads CSS modules **after** global CSS files. If
a CSS module defines a base rule (e.g. `width: 300px`) and a global CSS
file uses a `@media` query to override it, the module's base rule wins
because it comes later in the cascade with equal specificity.

**Rule**: If a CSS module uses `:global(.class)` to define base styles
for a class, any responsive overrides for that class must live **in the
same module file**, not in `app.css` or other global files.

```css
/* In MyComponent.module.css */
:global(.my-panel) {
  width: 300px;
  position: relative;
}

/* GOOD: override in the same file */
@media (max-width: 768px) {
  :global(.my-panel) {
    width: 100%;
    position: fixed;
  }
}
```

## Files Where This Was Fixed

- `AppSidebar.module.css` -- sidebar mobile positioning
- `NoteList.module.css` -- note list hiding on phones
- `app.css` -- removed duplicate rules that lost to module cascade
