const fs = require('fs');
const path = 'src/styles/daily-routine.css';
let css = fs.readFileSync(path, 'utf8');

// Replacements to standardize the color palette to the app's root variables

// Surfaces
css = css.replace(/var\(--surface-2,\s*#[0-9a-fA-F]+\)/g, 'var(--bg-card)');
css = css.replace(/var\(--surface-3,\s*#[0-9a-fA-F]+\)/g, 'var(--bg-tertiary)');
css = css.replace(/var\(--surface-1,\s*#[0-9a-fA-F]+\)/g, 'var(--bg-primary)');

// Text
css = css.replace(/var\(--text,\s*#eee\)/g, 'var(--text-primary)');
css = css.replace(/var\(--text,\s*#ddd\)/g, 'var(--text-primary)');
css = css.replace(/var\(--text-muted,\s*#888\)/g, 'var(--text-secondary)');
css = css.replace(/var\(--text-muted,\s*#777\)/g, 'var(--text-muted)');
css = css.replace(/var\(--text-muted,\s*#666\)/g, 'var(--text-muted)');
css = css.replace(/var\(--text-muted,\s*#aaa\)/g, 'var(--text-secondary)');

// Accents and semantic colors
css = css.replace(/var\(--accent,\s*#7c4dff\)/g, 'var(--accent)');
css = css.replace(/var\(--success,\s*#4caf50\)/g, 'var(--green)');
css = css.replace(/var\(--warning,\s*#ff9800\)/g, 'var(--yellow)');
css = css.replace(/var\(--danger,\s*#f44336\)/g, 'var(--red)');
css = css.replace(/var\(--border,\s*#333\)/g, 'var(--border)');
css = css.replace(/var\(--border,\s*#444\)/g, 'var(--border)');
css = css.replace(/var\(--border,\s*#555\)/g, 'var(--border)');

// Streak Calendar (convert purple to GitHub green)
css = css.replace(/rgba\(124,\s*77,\s*255,\s*0\.2\)/g, 'rgba(63, 185, 80, 0.2)');
css = css.replace(/rgba\(124,\s*77,\s*255,\s*0\.45\)/g, 'rgba(63, 185, 80, 0.45)');
css = css.replace(/rgba\(124,\s*77,\s*255,\s*0\.7\)/g, 'rgba(63, 185, 80, 0.7)');
css = css.replace(/rgba\(124,\s*77,\s*255,\s*1\)/g, 'var(--green)');

// Specific hardcoded adjustments
// Make the 'done' button neutral until hovered
css = css.replace(
  /\.daily-routine-segment-done-btn \{\s*background: var\(--bg-tertiary\);\s*color: var\(--green\);\s*border: 1px solid var\(--border\);/g,
  '.daily-routine-segment-done-btn {\n  background: transparent;\n  color: var(--text-muted);\n  border: 1px solid var(--border);'
);

fs.writeFileSync(path, css);
console.log('CSS updated successfully!');
