import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const artifactsDir = path.join(projectRoot, 'artifacts');
const screenshotPath = path.join(artifactsDir, 'sweet-home-photo-smoke.png');
const layoutScreenshotPath = path.join(artifactsDir, 'multi-room-isometric-smoke.png');
const homeScreenshotPath = path.join(artifactsDir, 'complete-home-isometric-smoke.png');
const homePlanScreenshotPath = path.join(artifactsDir, 'complete-home-plan-smoke.png');
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
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => browserErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });

  await page.goto(pathToFileURL(path.join(projectRoot, 'index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => document.readyState === 'complete' && window.rebuild3D);
  const catalogIconCount = await page.locator('[data-catalog-icon] svg').count();
  if (catalogIconCount !== 18) throw new Error(`Furniture catalog icons are missing: ${catalogIconCount}/18 rendered`);
  await page.locator('[data-floor-finish="tile"]').click();
  const tileFloorState = await page.evaluate(() => {
    const level = State.levels.find(item => item.id === State.activeLevelId);
    return { finish: level?.floorFinish, materialId: level?.materialId };
  });
  if (tileFloorState.finish !== 'tile' || tileFloorState.materialId !== 'travertine') {
    throw new Error(`Floor finish button did not apply its real material: ${JSON.stringify(tileFloorState)}`);
  }
  await page.locator('[data-floor-finish="wood"]').click();
  await page.locator('[data-furniture-category="bedroom"]').click();
  const bedroomCatalog = await page.locator('[data-furniture]:visible').evaluateAll(buttons => buttons.map(button => button.dataset.furniture).sort());
  if (JSON.stringify(bedroomCatalog) !== JSON.stringify(['bed', 'wardrobe'])) {
    throw new Error(`Furniture category tabs do not filter visible cards: ${bedroomCatalog.join(',')}`);
  }
  await page.locator('[data-furniture-category="all"]').click();
  await page.evaluate(() => { State.architectureStyle = 'modern'; State.style = 'japanese'; syncArchitectureUI(); });
  await page.locator('[data-architecture="modern"]').click();
  const repairedWholeHomeStyle = await page.evaluate(() => ({ architecture: State.architectureStyle, interior: State.style }));
  if (repairedWholeHomeStyle.architecture !== 'modern' || repairedWholeHomeStyle.interior !== 'modern') {
    throw new Error('Whole-home style button did not repair a mismatched architecture/furniture state');
  }
  await page.locator('[data-architecture="industrial"]').click();
  const styleState = await page.evaluate(() => ({ architecture: State.architectureStyle, interior: State.style }));
  if (styleState.architecture !== 'industrial' || styleState.interior !== 'industrial') throw new Error('Whole-home style control did not update doors and furniture together');
  await page.locator('[data-architecture="modern"]').click();
  await page.locator('[data-room-template="living"]').click();
  await page.locator('[data-mode="3d"]').click();
  await page.waitForSelector('#canvas-3d canvas');
  await page.evaluate(async () => {
    window._view3d.setRenderMode('photo');
    window._view3d.setLightingPreset('daylight');
    window._view3d.setCameraPreset('eye');
    await new Promise(resolve => setTimeout(resolve, 3000));
  });
  await page.waitForFunction(() => {
    const diagnostics = window._view3d?.getRenderDiagnostics?.();
    return diagnostics?.photoEnvironment && diagnostics.catalogModels >= 4;
  }, null, { timeout: 15000 });

  const canvas = await page.locator('#canvas-3d canvas').evaluate(element => ({ width: element.width, height: element.height }));
  const mode = await page.evaluate(() => window._view3d.getRenderMode());
  const diagnostics = await page.evaluate(() => window._view3d.getRenderDiagnostics());
  if (canvas.width < 500 || canvas.height < 300) throw new Error('WebGL canvas is missing or undersized');
  mkdirSync(artifactsDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await page.locator('#camera-preset').selectOption('interior');
  await page.waitForFunction(() => State.cameraPreset === 'interior' && State.renderMode === 'photo');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(artifactsDir, 'interior-photo-living.png'), fullPage: false });
  const renderData = await page.evaluate(() => window._view3d.exportPNG());
  writeFileSync(path.join(artifactsDir, 'interior-photo-render.png'), Buffer.from(renderData.split(',')[1], 'base64'));
  const photoView = await page.evaluate(() => window._view3d.saveCurrentCamera());
  if (Math.abs(photoView.position[1] - photoView.target[1]) > 0.001) throw new Error('Interior photo verticals are not level');
  await page.locator('#camera-preset').selectOption('isometric');
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(' | ')}`);

  browserErrors.length = 0;
  await page.locator('#btn-new').click();
  await page.locator('[data-room-template="bedroom"]').click();
  await page.locator('[data-room-template="living"]').click();
  await page.evaluate(async () => {
    window._view3d.setRenderMode('photo');
    window._view3d.setCameraPreset('isometric');
    await new Promise(resolve => setTimeout(resolve, 3000));
  });
  await page.waitForFunction(() => window._view3d?.getRenderDiagnostics?.().catalogModels >= 4, null, { timeout: 15000 });
  const layoutDiagnostics = await page.evaluate(() => window._view3d.getRenderDiagnostics());
  await page.screenshot({ path: layoutScreenshotPath, fullPage: false });
  if (browserErrors.length) throw new Error(`Multi-room browser errors: ${browserErrors.join(' | ')}`);

  browserErrors.length = 0;
  await page.locator('#btn-new').click();
  await page.locator('[data-mode="2d"]').click();
  await page.locator('[data-home-template="modernTwoBedroom"]').click();
  await page.locator('#status-info').waitFor({ state: 'visible' });
  const homeStatus = await page.locator('#status-info').textContent();
  if (!homeStatus.includes('完整现代两居')) throw new Error('Complete home template did not report success');
  await new Promise(resolve => setTimeout(resolve, 500));
  await page.screenshot({ path: homePlanScreenshotPath, fullPage: false });
  await page.locator('[data-mode="3d"]').click();
  await page.evaluate(async () => {
    window._view3d.setRenderMode('photo');
    window._view3d.setCameraPreset('isometric');
    await new Promise(resolve => setTimeout(resolve, 3000));
  });
  await page.waitForFunction(() => window._view3d?.getRenderDiagnostics?.().catalogModels >= 4, null, { timeout: 15000 });
  const homeDiagnostics = await page.evaluate(() => window._view3d.getRenderDiagnostics());
  await page.screenshot({ path: homeScreenshotPath, fullPage: false });
  const blockedPlacement = await page.evaluate(() => {
    const source = State.furnitures.find(item => !['rug', 'artwork'].includes(item.type));
    const other = State.furnitures.find(item => item.id !== source.id && !['rug', 'artwork'].includes(item.type));
    return window._tools.validateFurniturePlacement({ ...other, x: source.x, y: source.y, roomId: source.roomId }, other.id);
  });
  if (blockedPlacement.valid || !['overlap', 'clearance'].includes(blockedPlacement.reason)) {
    throw new Error(`Furniture overlap guard did not reject an invalid edit: ${JSON.stringify(blockedPlacement)}`);
  }
  await page.locator('#material-preset-select').selectOption('porcelainIvory');
  await page.locator('#btn-material-floor').click();
  const floorMaterialState = await page.evaluate(() => ({
    level: State.levels.find(item => item.id === State.activeLevelId),
    rooms: State.rooms.filter(item => item.levelId === State.activeLevelId).map(item => item.materialId),
  }));
  if (floorMaterialState.level.materialId !== 'porcelainIvory' || floorMaterialState.level.floorFinish !== 'tile'
    || floorMaterialState.rooms.some(materialId => materialId !== 'porcelainIvory')) {
    throw new Error(`Applying a floor material did not update every visible room surface: ${JSON.stringify(floorMaterialState)}`);
  }
  await page.evaluate(() => {
    State.activeType = 'wall';
    State.activeObject = State.walls[0].id;
    renderProps();
  });
  await page.locator('#material-preset-select').selectOption('walnut');
  await page.locator('#btn-material-selected').click();
  const genericWallMaterial = await page.evaluate(() => ({ materialId: State.walls[0].materialId, finishId: State.walls[0].wallFinishId }));
  if (genericWallMaterial.materialId !== 'walnut' || genericWallMaterial.finishId != null) {
    throw new Error(`Generic wall material remained hidden under a wall finish: ${JSON.stringify(genericWallMaterial)}`);
  }
  await page.locator('#wall-finish-select').selectOption('woodSlats');
  await page.locator('#btn-wall-finish-selected').click();
  await page.evaluate(() => {
    State.activeType = 'door';
    State.activeObject = State.doors[0].id;
    renderProps();
  });
  await page.locator('#props select[name="door.style"]').selectOption('industrial');
  await page.evaluate(() => {
    State.activeType = 'furniture';
    State.activeObject = State.furnitures[0].id;
    renderProps();
  });
  await page.locator('#props select[name="furniture.style"]').selectOption('japanese');
  const overrideState = await page.evaluate(() => ({
    wall: State.walls[0].wallFinishId,
    door: State.doors[0].styleId,
    furniture: State.furnitures[0].styleId,
  }));
  if (overrideState.wall !== 'woodSlats' || overrideState.door !== 'industrial' || overrideState.furniture !== 'japanese') {
    throw new Error(`Per-object finish/style controls did not persist: ${JSON.stringify(overrideState)}`);
  }
  if (browserErrors.length) throw new Error(`Complete-home browser errors: ${browserErrors.join(' | ')}`);
  // Exercise the visible editing controls and persisted recovery, not only model helpers.
  await page.locator('[data-mode="2d"]').click();
  await page.evaluate(() => {
    State.walls = [
      { id: 'edit-a', levelId: State.activeLevelId, x1: 0, y1: 0, x2: 400, y2: 0, height: 280, thickness: 20 },
      { id: 'edit-b', levelId: State.activeLevelId, x1: 400, y1: 0, x2: 400, y2: 300, height: 280, thickness: 20 },
    ];
    State.doors = [{ id: 'edit-door', wallId: 'edit-a', levelId: State.activeLevelId, x: 200, y: 0, width: 80, height: 210 }];
    State.windows = []; State.furnitures = []; State.rooms = []; State.stairs = []; State.dimensions = [];
    _history.clear(); persistLocalDraft();
    setSelection([{ id: 'edit-a', type: 'wall' }]);
  });
  const lengthInput = page.locator('#props .prop-row').filter({ has: page.locator('[data-prop-key="prop.length"]') }).locator('input');
  await lengthInput.fill('500');
  await lengthInput.press('Tab');
  const edited = await page.evaluate(() => [State.walls[0].x2, State.walls[1].x1, State.doors[0].x]);
  if (JSON.stringify(edited) !== '[500,500,250]') throw new Error(`Precise UI edit broke wall joints: ${edited}`);
  await page.locator('#btn-undo').click();
  if (await page.evaluate(() => State.walls[0].x2) !== 400) throw new Error('One undo did not restore the complete dimension edit');
  await page.locator('#btn-redo').click();
  if (await page.evaluate(() => State.doors[0].x) !== 250) throw new Error('Redo did not restore the opening');
  await page.locator('[data-flow-target="project"]').click();
  await page.locator('#btn-recover').click();
  if (await page.evaluate(() => State.walls[0].x2) !== 400) throw new Error('Recovery did not load the previous draft');
  await page.reload();
  await page.waitForFunction(() => window.rebuild3D);
  if (await page.evaluate(() => State.walls[0].x2) !== 400) throw new Error('Recovered draft did not survive reload');
  const conflictProtected = await page.evaluate(() => {
    const newer = JSON.stringify(ProjectModel.serializeProject({ walls: [] }));
    localStorage.setItem(ProjectModel.LOCAL_DRAFT_KEY, newer);
    return persistLocalDraft() === false && localStorage.getItem(ProjectModel.LOCAL_DRAFT_KEY) === newer;
  });
  if (!conflictProtected) throw new Error('Stale tab overwrote a newer draft');
  if (browserErrors.length) throw new Error(`Editing browser errors: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ screenshotPath, layoutScreenshotPath, homeScreenshotPath, homePlanScreenshotPath, canvas, mode, diagnostics, layoutDiagnostics, homeDiagnostics, editingAndRecovery: 'passed', browserErrors: 0 }));
} finally {
  await browser.close();
}
