// capture-styles.mjs — Extract computed styles from rendered components
// Usage: node /tmp/capture-styles.mjs <repo-path> > styles-dump.json
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import http from 'http';
import https from 'https';
import path from 'path';

const repoPath = process.argv[2] || process.cwd();
const PORT = 5199;

// Key CSS properties that matter for layout/visibility
const KEY_PROPS = [
  'position', 'display', 'zIndex', 'visibility', 'opacity',
  'top', 'right', 'bottom', 'left', 'inset',
  'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'border', 'borderRadius',
  'flex', 'flexDirection', 'flexWrap', 'alignItems', 'justifyContent', 'gap',
  'gridTemplateColumns', 'gridTemplateRows',
  'overflow', 'overflowX', 'overflowY',
  'fontSize', 'fontWeight', 'color', 'backgroundColor',
  'background', 'backgroundImage',
  'transform', 'transition', 'boxShadow',
  'cursor', 'pointerEvents',
  'backdropFilter', 'webkitBackdropFilter',
  'textAlign', 'whiteSpace', 'textOverflow',
  'animation', 'transformOrigin',
];

function waitForServer(baseUrl, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const isHttps = baseUrl.startsWith('https');
    const mod = isHttps ? https : http;
    const tryConnect = () => {
      const req = mod.get(baseUrl, { rejectUnauthorized: false }, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) resolve();
        else setTimeout(tryConnect, 500);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('Timeout waiting for server'));
        else setTimeout(tryConnect, 500);
      });
      req.end();
    };
    tryConnect();
  });
}

async function main() {
  const branchP = new Promise((resolve) => {
    const git = spawn('git', ['branch', '--show-current'], { cwd: repoPath, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    git.stdout.on('data', d => out += d.toString());
    git.on('close', () => resolve(out.trim()));
  });
  const branch = await branchP;
  console.error(`Branch: ${branch}`);

  // 1. Start dev server
  console.error('Starting dev server...');
  const server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
    cwd: repoPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    shell: true,
  });

  server.stderr.on('data', (d) => process.stderr.write(d));
  server.stdout.on('data', (d) => process.stderr.write(d));

  try {
    // Vite uses HTTPS by default, but fall back to HTTP
    let baseUrl = `https://localhost:${PORT}`;
    try {
      await waitForServer(`${baseUrl}/`, 15000);
    } catch {
      baseUrl = `http://localhost:${PORT}`;
      await waitForServer(`${baseUrl}/`);
    }
    console.error(`Server ready at ${baseUrl}`);

    // 2. Launch browser — find the installed chromium-headless-shell
    const PW_ROOT = '/root/.cache/ms-playwright';
    const shellDir = execSync(`ls -d ${PW_ROOT}/chromium_headless_shell-* 2>/dev/null | head -1`, { shell: true })
      .toString().trim();
    const exePath = shellDir ? `${shellDir}/chrome-headless-shell-linux64/chrome-headless-shell` : undefined;
    const browser = await chromium.launch({
      headless: true,
      ...(exePath ? { executablePath: exePath } : {}),
    });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    // 3. Navigate and wait for app to render
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });
    // Give SolidJS time to render
    await page.waitForTimeout(3000);

    // Take screenshot for visual reference
    await page.screenshot({ path: `/tmp/screenshot-${branch}.png`, fullPage: true });
    console.error(`Screenshot saved to /tmp/screenshot-${branch}.png`);

    // 4. Extract computed styles for all elements with class or id
    const elements = await page.evaluate((keyProps) => {
      const results = [];
      const all = document.querySelectorAll('[class], [id]');

      all.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const className = el.getAttribute('class') || '';
        const id = el.getAttribute('id') || '';
        const text = (el.textContent || '').trim().substring(0, 60).replace(/\s+/g, ' ');

        if (['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(tag)) return;
        if (!className && !id && !text) return;

        const computed = window.getComputedStyle(el);
        const styles = {};
        keyProps.forEach((prop) => {
          const rawVal = computed.getPropertyValue(prop);
          if (rawVal && rawVal !== 'none' && rawVal !== 'normal' && rawVal !== 'auto' &&
              rawVal !== '0px' && rawVal !== 'rgba(0, 0, 0, 0)' && rawVal !== '0s' &&
              rawVal !== '0' && rawVal !== '0deg' && rawVal !== 'visible' &&
              rawVal !== 'static' && rawVal !== 'inline' && rawVal !== 'row' &&
              rawVal !== 'stretch' && rawVal !== 'flex-start') {
            styles[prop] = rawVal;
          }
        });

        let sel = tag;
        if (id) sel += '#' + id;
        if (className) sel += '.' + className.split(' ').slice(0, 3).join('.');

        results.push({
          selector: sel,
          tag,
          classList: className,
          id,
          text: text.substring(0, 40),
          styles,
        });
      });

      return results;
    }, KEY_PROPS);

    console.log(JSON.stringify({
      branch,
      elementCount: elements.length,
      elements,
    }, null, 2));

    await browser.close();
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
