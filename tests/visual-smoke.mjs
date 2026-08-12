import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const artifactsDir = path.join(projectRoot, 'artifacts');
const screenshotPath = path.join(artifactsDir, 'sweet-home-photo-smoke.png');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (localError) {
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) throw localError;
    const bundled = path.join(userProfile, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright');
    try {
      return require(bundled);
    } catch (_) {
      throw new Error('Visual smoke test needs Playwright. Install it locally or run inside the Codex desktop runtime.');
    }
  }
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true,
  args: ['--allow-file-access-from-files'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });

  await page.goto(pathToFileURL(path.join(projectRoot, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => document.readyState === 'complete' && window.rebuild3D);
  await page.locator('[data-room-template="living"]').click();
  await page.locator('[data-mode="3d"]').click();
  await page.waitForSelector('#canvas-3d canvas');
  await page.evaluate(async () => {
    window._view3d.setRenderMode('photo');
    window._view3d.setLightingPreset('daylight');
    window._view3d.setCameraPreset('eye');
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  const canvas = await page.locator('#canvas-3d canvas').evaluate(element => ({ width: element.width, height: element.height }));
  const mode = await page.evaluate(() => window._view3d.getRenderMode());
  if (canvas.width < 500 || canvas.height < 300) throw new Error('WebGL canvas is missing or undersized');
  mkdirSync(artifactsDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ screenshotPath, canvas, mode, browserErrors: 0 }));
} finally {
  await browser.close();
}
