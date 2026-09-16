const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ProjectModel = require('../js/project.js');

test('v1 project files migrate to the v3 level, furniture and style contract', () => {
  const fixturePath = path.join(__dirname, '..', 'examples', 'studio-apartment.json');
  const legacy = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const project = ProjectModel.normalizeProject(legacy);

  assert.equal(project.version, 3);
  assert.deepEqual(project.levels, [{
    id: 'level_1', name: '1F', elevation: 0, floorThickness: 20, height: 280, floorFinish: 'wood', materialId: null,
    ceiling: { enabled: false, drop: 15, thickness: 8, coveLight: false, downlights: 0, color: '#f7f3ed' },
  }]);
  assert.equal(project.activeLevelId, 'level_1');
  assert.ok(project.walls.every(item => item.levelId === 'level_1'));
  assert.equal(project.style, 'modern');
  assert.deepEqual(
    project.furnitures.map(({ type, w, d, h }) => ({ type, w, d, h })),
    [
      { type: 'sofa', w: 160, d: 70, h: 80 },
      { type: 'bed', w: 150, d: 210, h: 50 },
      { type: 'table', w: 120, d: 80, h: 75 },
    ],
  );
});

test('six local style presets expose a complete whole-home material palette', () => {
  assert.deepEqual(Object.keys(ProjectModel.STYLE_PRESETS), [
    'modern', 'nordic', 'japanese', 'wabiSabi', 'industrial', 'american',
  ]);

  const furnitureProfiles = new Set();
  for (const preset of Object.values(ProjectModel.STYLE_PRESETS)) {
    assert.match(preset.wall, /^#[0-9a-f]{6}$/i);
    assert.match(preset.floor, /^#[0-9a-f]{6}$/i);
    assert.match(preset.floorAlt, /^#[0-9a-f]{6}$/i);
    assert.match(preset.wood, /^#[0-9a-f]{6}$/i);
    assert.match(preset.fabric, /^#[0-9a-f]{6}$/i);
    assert.match(preset.metal, /^#[0-9a-f]{6}$/i);
    assert.match(preset.roof, /^#[0-9a-f]{6}$/i);
    assert.match(preset.ground, /^#[0-9a-f]{6}$/i);
    assert.match(preset.sky, /^#[0-9a-f]{6}$/i);
    assert.match(preset.sun, /^#[0-9a-f]{6}$/i);
    assert.ok(preset.wallRoughness >= 0.5 && preset.wallRoughness <= 1);
    assert.match(preset.furnitureProfile, /^(low|tapered|floor|organic|frame|classic)$/);
    furnitureProfiles.add(preset.furnitureProfile);
  }
  assert.equal(furnitureProfiles.size, 6);
  const styled = ProjectModel.normalizeProject({ furnitures: [{ type: 'bed', styleId: 'japanese' }] });
  assert.equal(styled.furnitures[0].styleId, 'japanese');
  assert.equal(ProjectModel.normalizeProject({ furnitures: [{ type: 'bed', styleId: 'invalid' }] }).furnitures[0].styleId, null);
});

test('invalid project collection types are rejected instead of silently erasing data', () => {
  assert.throws(
    () => ProjectModel.normalizeProject({ version: 2, walls: 'not-an-array' }),
    /walls must be an array/i,
  );
});

test('one committed edit can be undone and redone without timing assumptions', () => {
  let documentState = { walls: [] };
  const history = ProjectModel.createHistory({
    capture: () => JSON.stringify(documentState),
    restore: json => { documentState = JSON.parse(json); },
  });

  const before = history.begin();
  documentState.walls.push({ id: 'wall_1' });
  history.commit(before);

  assert.equal(history.undo(), true);
  assert.deepEqual(documentState.walls, []);
  assert.equal(history.redo(), true);
  assert.deepEqual(documentState.walls, [{ id: 'wall_1' }]);
});

test('saving and loading preserves interior and architectural styles with every collection', () => {
  const saved = ProjectModel.serializeProject({
    style: 'wabiSabi',
    architectureStyle: 'japanese',
    renderMode: 'photo',
    sunAngle: 42,
    walls: [{ id: 'wall_1' }],
    doors: [{ id: 'door_1' }],
    windows: [{ id: 'window_1' }],
    rooms: [{ id: 'room_1' }],
    furnitures: [{ id: 'furniture_1', type: 'sofa', x: 0, y: 0, w: 180, d: 85, h: 80 }],
    dimensions: [{ id: 'dimension_1' }],
  });
  const loaded = ProjectModel.normalizeProject(JSON.parse(JSON.stringify(saved)));

  assert.equal(saved.version, 3);
  assert.equal(loaded.style, 'wabiSabi');
  assert.equal(loaded.architectureStyle, 'japanese');
  assert.equal(loaded.renderMode, 'photo');
  for (const key of ['walls', 'doors', 'windows', 'rooms', 'furnitures', 'dimensions']) {
    assert.equal(loaded[key].length, 1, key);
  }
});

test('v2 openings inherit the level of their wall during migration', () => {
  const project = ProjectModel.normalizeProject({
    version: 2,
    walls: [{ id: 'wall_1', levelId: 'missing' }],
    doors: [{ id: 'door_1', wallId: 'wall_1' }],
    windows: [{ id: 'window_1', wallId: 'wall_1' }],
  });
  assert.equal(project.walls[0].levelId, 'level_1');
  assert.equal(project.doors[0].levelId, 'level_1');
  assert.equal(project.windows[0].levelId, 'level_1');
});

test('duplicating a level remaps wall and opening IDs without cross-level references', () => {
  const source = ProjectModel.normalizeProject({
    walls: [{ id: 'obj_1', x1: 0, y1: 0, x2: 400, y2: 0 }],
    rooms: [{ id: 'obj_4', x: 200, y: 150, w: 400, d: 300 }],
    doors: [{ id: 'obj_2', wallId: 'obj_1', x: 100, y: 0, fromRoomId: 'obj_4', toRoomId: 'obj_4' }],
    furnitures: [{ id: 'obj_3', type: 'artwork', x: 150, y: 150, wallId: 'obj_1', roomId: 'obj_4' }],
  });
  const copy = ProjectModel.duplicateLevel(source, 'level_1');
  const copiedWall = copy.walls.find(item => item.levelId === 'level_2');
  const copiedRoom = copy.rooms.find(item => item.levelId === 'level_2');
  const copiedDoor = copy.doors.find(item => item.levelId === 'level_2');
  const copiedArtwork = copy.furnitures.find(item => item.levelId === 'level_2');
  assert.equal(copy.levels.length, 2);
  assert.equal(copy.activeLevelId, 'level_2');
  assert.equal(copy.levels[1].elevation, 300);
  assert.ok(copiedWall && copiedWall.id !== 'obj_1');
  assert.equal(copiedDoor.wallId, copiedWall.id);
  assert.equal(copiedArtwork.wallId, copiedWall.id);
  assert.equal(copiedArtwork.roomId, copiedRoom.id);
  assert.equal(copiedDoor.fromRoomId, copiedRoom.id);
  assert.equal(copiedDoor.toRoomId, copiedRoom.id);
});

test('stairs persist their adjacent-level relationship and editable concept dimensions', () => {
  const project = ProjectModel.normalizeProject({
    levels: [
      { id: 'level_1', name: '1F', elevation: 0, height: 280, floorThickness: 20 },
      { id: 'level_2', name: '2F', elevation: 300, height: 280, floorThickness: 20 },
    ],
    stairs: [{ id: 'obj_1', levelId: 'level_1', toLevelId: 'level_2', x: 100, y: 120, width: 110, length: 320, stepCount: 17 }],
  });
  assert.deepEqual(project.stairs[0], {
    id: 'obj_1', levelId: 'level_1', toLevelId: 'level_2', x: 100, y: 120,
    width: 110, length: 320, stepCount: 17, rotation: 0,
  });
});

test('render quality modes are explicit and invalid legacy values fall back to realtime', () => {
  assert.deepEqual(Object.keys(ProjectModel.RENDER_PRESETS), ['realtime', 'photo']);
  assert.equal(ProjectModel.RENDER_PRESETS.realtime.pixelRatioCap, 1.75);
  assert.equal(ProjectModel.RENDER_PRESETS.photo.pixelRatioCap, 2.5);
  assert.equal(ProjectModel.RENDER_PRESETS.realtime.shadowMapSize, 2048);
  assert.equal(ProjectModel.RENDER_PRESETS.photo.shadowMapSize, 4096);
  assert.equal(ProjectModel.RENDER_PRESETS.photo.anisotropy, 16);
  assert.equal(ProjectModel.RENDER_PRESETS.photo.exportScale, 2);
  assert.ok(ProjectModel.RENDER_PRESETS.photo.exposure <= 1.05);
  assert.ok(ProjectModel.RENDER_PRESETS.photo.sun <= 1.05);
  assert.ok(ProjectModel.RENDER_PRESETS.photo.hemisphere > ProjectModel.RENDER_PRESETS.photo.ambient);
  assert.equal(ProjectModel.normalizeProject({ renderMode: 'unknown' }).renderMode, 'realtime');
});

test('high resolution export preserves aspect ratio and respects the pixel budget', () => {
  assert.deepEqual(ProjectModel.computeRenderExportSize(800, 600, 2, 16_000_000), { width: 1600, height: 1200, scale: 2 });
  const capped = ProjectModel.computeRenderExportSize(4000, 3000, 2, 16_000_000);
  assert.deepEqual({ width: capped.width, height: capped.height }, { width: 4618, height: 3464 });
  assert.ok(capped.scale < 2);
});

test('lighting presets persist independently from render quality', () => {
  assert.deepEqual(Object.keys(ProjectModel.LIGHTING_PRESETS), ['daylight', 'warmNight', 'studio']);
  const saved = ProjectModel.serializeProject({ renderMode: 'realtime', lightingPreset: 'warmNight' });
  assert.equal(saved.renderMode, 'realtime');
  assert.equal(saved.lightingPreset, 'warmNight');
  assert.equal(ProjectModel.normalizeProject({ lightingPreset: 'invalid' }).lightingPreset, 'daylight');
});

test('camera presets and one saved custom view survive project round trips', () => {
  assert.deepEqual(Object.keys(ProjectModel.CAMERA_PRESETS), ['interior', 'eye', 'bird', 'isometric', 'exterior']);
  assert.equal(ProjectModel.normalizeProject({ cameraPreset: 'interior' }).cameraPreset, 'interior');
  const savedCamera = { position: [4, 2.2, 6], target: [1, 1, 1], fov: 52 };
  const project = ProjectModel.normalizeProject({ cameraPreset: 'bird', savedCamera });
  assert.equal(project.cameraPreset, 'bird');
  assert.deepEqual(project.savedCamera, savedCamera);
  assert.equal(ProjectModel.normalizeProject({ cameraPreset: 'invalid', savedCamera: { position: [1] } }).cameraPreset, 'isometric');
  assert.equal(ProjectModel.normalizeProject({ savedCamera: { position: [1] } }).savedCamera, null);
});

test('each level owns a safe parameterized ceiling and lighting layout', () => {
  const project = ProjectModel.normalizeProject({ levels: [{ id: 'level_1', ceiling: { enabled: true, drop: 18, thickness: 7, coveLight: true, downlights: 6, color: '#f2eee8' } }] });
  assert.deepEqual(project.levels[0].ceiling, { enabled: true, drop: 18, thickness: 7, coveLight: true, downlights: 6, color: '#f2eee8' });
  const legacy = ProjectModel.normalizeProject({});
  assert.equal(legacy.levels[0].ceiling.enabled, false);
  assert.equal(ProjectModel.normalizeProject({ levels: [{ ceiling: { downlights: 99, drop: -2 } }] }).levels[0].ceiling.downlights, 12);
});

test('real-scale material presets apply consistently through the material brush', () => {
  assert.deepEqual(Object.keys(ProjectModel.MATERIAL_PRESETS), ['oakLight', 'oakWarm', 'walnut', 'travertine', 'porcelainIvory', 'terrazzoLight', 'microcement', 'linen']);
  for (const material of Object.values(ProjectModel.MATERIAL_PRESETS)) {
    assert.ok(material.scaleCm >= 10);
    assert.ok(material.roughness >= 0 && material.roughness <= 1);
  }
  const source = { id: 'wall_1', materialId: 'travertine' };
  assert.deepEqual(ProjectModel.applyMaterialBrush(source, { id: 'wall_2' }), { id: 'wall_2', materialId: 'travertine' });
  assert.equal(ProjectModel.normalizeProject({ walls: [{ materialId: 'invalid' }] }).walls[0].materialId, null);
});

test('wall finishes include realistic plaster colours, wall tile and wood slats', () => {
  assert.deepEqual(Object.keys(ProjectModel.WALL_FINISH_PRESETS), [
    'warmWhitePlaster', 'blushPlaster', 'sagePlaster', 'bathroomTile', 'woodSlats',
  ]);
  assert.equal(ProjectModel.WALL_FINISH_PRESETS.blushPlaster.pattern, 'plaster');
  assert.equal(ProjectModel.WALL_FINISH_PRESETS.bathroomTile.pattern, 'tile');
  assert.equal(ProjectModel.WALL_FINISH_PRESETS.woodSlats.pattern, 'slats');
});

test('modern floor materials use long-plank or large-slab proportions instead of square repeats', () => {
  assert.equal(ProjectModel.MATERIAL_PRESETS.oakLight.plankLengthCm, 180);
  assert.equal(ProjectModel.MATERIAL_PRESETS.oakLight.plankWidthCm, 18);
  assert.deepEqual(ProjectModel.getMaterialRepeat('oakLight', 3.6, 1.44), { x: 2, y: 2 });
  assert.deepEqual(ProjectModel.getMaterialRepeat('travertine', 3.6, 2.4), { x: 3, y: 4 });
  assert.deepEqual(ProjectModel.getMaterialRepeat('porcelainIvory', 3.6, 2.4), { x: 6, y: 4 });
  assert.deepEqual(ProjectModel.getMaterialRepeat('terrazzoLight', 3.2, 2.4), { x: 4, y: 3 });
  assert.equal(ProjectModel.getDefaultFloorMaterialId('wood'), 'oakLight');
  assert.equal(ProjectModel.getDefaultFloorMaterialId('tile'), 'travertine');
  assert.equal(ProjectModel.getDefaultFloorMaterialId('concrete'), 'microcement');
  assert.equal(ProjectModel.getFloorFinishForMaterialId('oakWarm'), 'wood');
  assert.equal(ProjectModel.getFloorFinishForMaterialId('porcelainIvory'), 'tile');
  assert.equal(ProjectModel.getFloorFinishForMaterialId('microcement'), 'concrete');
  for (const file of ['WoodFloor040_1K-JPG_Color.jpg', 'WoodFloor040_1K-JPG_NormalGL.jpg', 'WoodFloor040_1K-JPG_Roughness.jpg']) {
    const assetPath = path.join(__dirname, '..', 'assets', 'materials', 'wood_floor_040', file);
    assert.ok(fs.statSync(assetPath).size > 100_000, file);
  }
});

test('photo preview ships self-contained glTF furniture with every referenced buffer and texture', () => {
  for (const [folder, gltfFile] of [
    ['coffee_table_round_01', 'coffee_table_round_01_1k.gltf'],
    ['modern_wooden_cabinet', 'modern_wooden_cabinet_1k.gltf'],
    ['modern_arm_chair_01', 'modern_arm_chair_01_1k.gltf'],
  ]) {
    const modelRoot = path.join(__dirname, '..', 'assets', 'models', folder);
    const gltf = JSON.parse(fs.readFileSync(path.join(modelRoot, gltfFile), 'utf8'));
    const referenced = [
      ...(gltf.buffers || []).map(item => item.uri),
      ...(gltf.images || []).map(item => item.uri),
    ].filter(Boolean);
    assert.ok(referenced.length >= 2, folder);
    for (const relativePath of referenced) assert.ok(fs.statSync(path.join(modelRoot, relativePath)).size > 1_000, relativePath);
  }
});

test('photo mode ships a compact verified indoor HDR environment and modern decor defaults', () => {
  const hdrPath = path.join(__dirname, '..', 'assets', 'environments', 'poly_haven_studio_1k.hdr');
  const hdrSize = fs.statSync(hdrPath).size;
  assert.ok(hdrSize > 1_000_000);
  assert.ok(hdrSize < 3_000_000);
  assert.deepEqual(ProjectModel.FURNITURE_DEFAULTS.armchair, { w: 76, d: 82, h: 84 });
  assert.deepEqual(ProjectModel.FURNITURE_DEFAULTS.rug, { w: 240, d: 170, h: 2 });
  const sofaPath = path.join(__dirname, '..', 'assets', 'models', 'glam_velvet_sofa', 'GlamVelvetSofa.glb');
  const sofaData = fs.readFileSync(sofaPath);
  assert.equal(sofaData.length, 3_149_844);
  assert.equal(createHash('sha256').update(sofaData).digest('hex'), 'f043d5c618a1280d1c9c940d6025d0a92a611929175285bafe05099c77e6f5e0');
});

test('site ground is hidden for cutaway interiors and retained for exterior presentation', () => {
  assert.equal(ProjectModel.shouldShowSite({ buildingViewMode: 'active', cutawayMode: true, walkMode: false, cameraPreset: 'eye' }), false);
  assert.equal(ProjectModel.shouldShowSite({ buildingViewMode: 'active', cutawayMode: false, walkMode: true, cameraPreset: 'eye' }), false);
  assert.equal(ProjectModel.shouldShowSite({ buildingViewMode: 'active', cutawayMode: false, walkMode: false, cameraPreset: 'exterior' }), true);
  assert.equal(ProjectModel.shouldShowSite({ buildingViewMode: 'all', cutawayMode: true, walkMode: false, cameraPreset: 'isometric' }), true);
});

test('furniture grounding always translates its lowest visible geometry onto the floor', () => {
  assert.equal(ProjectModel.computeGroundingTranslation(0.38), -0.38);
  assert.equal(ProjectModel.computeGroundingTranslation(-0.02), 0.02);
  assert.equal(ProjectModel.computeGroundingTranslation(0), 0);
  assert.equal(ProjectModel.computeGroundingTranslation(Number.NaN), 0);
});

test('shadow camera spends its resolution on the house instead of a fixed 120 metre field', () => {
  assert.equal(ProjectModel.computeShadowCameraExtent({ minX: 0, maxX: 10, minZ: 0, maxZ: 8 }), 8);
  assert.equal(ProjectModel.computeShadowCameraExtent({ minX: 0, maxX: 2, minZ: 0, maxZ: 1 }), 4);
  assert.equal(ProjectModel.computeShadowCameraExtent({ minX: -80, maxX: 80, minZ: -2, maxZ: 2 }), 45);
});

test('physical practical lights use visible candela-scale intensities in both render modes', () => {
  assert.equal(ProjectModel.computePracticalLightIntensity('room', 1, 'photo'), 48);
  assert.equal(ProjectModel.computePracticalLightIntensity('downlight', 1, 'photo'), 28);
  assert.equal(ProjectModel.computePracticalLightIntensity('lamp', 1, 'photo'), 20);
  assert.equal(ProjectModel.computePracticalLightIntensity('room', 1, 'realtime'), 34.56);
  assert.equal(ProjectModel.computePracticalLightIntensity('unknown', Number.NaN, 'photo'), 0);
});

test('roof is visible only for the whole-building exterior view', () => {
  assert.equal(ProjectModel.shouldShowRoof({ buildingViewMode: 'all', cutawayMode: false, walkMode: false }), true);
  assert.equal(ProjectModel.shouldShowRoof({ buildingViewMode: 'active', cutawayMode: false, walkMode: false }), false);
  assert.equal(ProjectModel.shouldShowRoof({ buildingViewMode: 'all', cutawayMode: true, walkMode: false }), false);
  assert.equal(ProjectModel.shouldShowRoof({ buildingViewMode: 'all', cutawayMode: false, walkMode: true }), false);
});

test('rotated footprints swap furniture dimensions at a right angle', () => {
  assert.deepEqual(ProjectModel.getRotatedFootprint(180, 85, Math.PI / 2), { w: 85, d: 180 });
  assert.deepEqual(ProjectModel.getRotatedFootprint(180, 85, 0), { w: 180, d: 85 });
});

test('stair rise is capped by the shortest wall on its level', () => {
  const walls = [
    { id: 'wall_1', levelId: 'level_1', height: 280 },
    { id: 'wall_2', levelId: 'level_1', height: 240 },
    { id: 'wall_3', levelId: 'level_2', height: 180 },
  ];

  assert.equal(ProjectModel.getStairRiseLimit(walls, 'level_1', 280), 240);
  assert.equal(ProjectModel.getStairRiseLimit(walls, 'level_2', 280), 180);
  assert.equal(ProjectModel.getStairRiseLimit([], 'level_1', 260), 260);
});

test('local draft round trip restores the latest project without a backend', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const project = {
    style: 'nordic', architectureStyle: 'industrial', sunAngle: 35,
    walls: [{ id: 'obj_8' }], doors: [], windows: [], rooms: [], furnitures: [], dimensions: [],
  };

  assert.equal(ProjectModel.saveLocalDraft(storage, project), true);
  assert.deepEqual(ProjectModel.loadLocalDraft(storage), ProjectModel.serializeProject(project));
  assert.equal(ProjectModel.getNextObjectId(ProjectModel.loadLocalDraft(storage)), 9);
});

test('local draft round trip preserves multiple levels and their objects', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const project = {
    levels: [
      { id: 'level_1', name: '1F', elevation: 0, floorThickness: 20, height: 280, floorFinish: 'wood' },
      { id: 'level_2', name: '2F', elevation: 300, floorThickness: 20, height: 280, floorFinish: 'tile' },
    ],
    activeLevelId: 'level_2',
    walls: [
      { id: 'obj_1', levelId: 'level_1', x1: 0, y1: 0, x2: 300, y2: 0 },
      { id: 'obj_2', levelId: 'level_2', x1: 0, y1: 0, x2: 240, y2: 0 },
    ],
    doors: [{ id: 'obj_3', levelId: 'level_2', wallId: 'obj_2', x: 120, y: 0, width: 90 }],
    windows: [], rooms: [], furnitures: [], dimensions: [], stairs: [],
  };

  assert.equal(ProjectModel.saveLocalDraft(storage, project), true);
  const restored = ProjectModel.loadLocalDraft(storage);
  assert.deepEqual(restored.levels.map(({ id, name, elevation, floorThickness, height, floorFinish }) => ({ id, name, elevation, floorThickness, height, floorFinish })), project.levels);
  assert.equal(restored.activeLevelId, 'level_2');
  assert.deepEqual(restored.walls.map(wall => wall.levelId), ['level_1', 'level_2']);
  assert.equal(restored.doors[0].wallId, 'obj_2');
  assert.equal(restored.doors[0].levelId, 'level_2');
});

test('active level 3D view keeps lower floors as physical context', () => {
  const levels = [
    { id: 'level_1', elevation: 0 },
    { id: 'level_2', elevation: 300 },
    { id: 'level_3', elevation: 600 },
  ];

  assert.deepEqual(ProjectModel.getVisibleLevelIds(levels, 'level_1', 'active'), ['level_1']);
  assert.deepEqual(ProjectModel.getVisibleLevelIds(levels, 'level_2', 'active'), ['level_1', 'level_2']);
  assert.deepEqual(ProjectModel.getVisibleLevelIds(levels, 'level_3', 'active'), ['level_1', 'level_2', 'level_3']);
  assert.deepEqual(ProjectModel.getVisibleLevelIds(levels, 'level_2', 'all'), ['level_1', 'level_2', 'level_3']);
});

test('a damaged or unavailable local draft is ignored safely', () => {
  let removed = false;
  const damagedStorage = {
    getItem: () => '{not json',
    setItem: () => {},
    removeItem: () => { removed = true; },
  };
  const blockedStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };

  assert.equal(ProjectModel.loadLocalDraft(damagedStorage), null);
  assert.equal(removed, false);
  assert.equal(ProjectModel.loadLocalDraft(blockedStorage), null);
  assert.equal(ProjectModel.saveLocalDraft(blockedStorage, {}), false);
});

test('L-shaped connected rooms produce only their enclosed floor faces', () => {
  const walls = [
    { x1: 0, y1: 0, x2: 150, y2: 0 },
    { x1: 150, y1: 0, x2: 150, y2: 150 },
    { x1: 150, y1: 150, x2: 0, y2: 150 },
    { x1: 0, y1: 150, x2: 0, y2: 0 },
    { x1: 0, y1: 150, x2: 250, y2: 150 },
    { x1: 250, y1: 150, x2: 250, y2: 550 },
    { x1: 250, y1: 550, x2: 0, y2: 550 },
    { x1: 0, y1: 550, x2: 0, y2: 150 },
  ];

  const faces = ProjectModel.computeFloorPolygons(walls);
  const areas = faces.map(points => Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2).sort((a, b) => a - b);

  assert.deepEqual(areas, [22500, 100000]);
  assert.equal(areas.reduce((sum, area) => sum + area, 0), 122500);
});

test('floor footprint area is reported in square meters and open walls have no area', () => {
  const closed = [
    { x1: 0, y1: 0, x2: 400, y2: 0 },
    { x1: 400, y1: 0, x2: 400, y2: 300 },
    { x1: 400, y1: 300, x2: 0, y2: 300 },
    { x1: 0, y1: 300, x2: 0, y2: 0 },
  ];

  assert.equal(ProjectModel.computeFloorArea(closed), 12);
  assert.equal(ProjectModel.computeFloorArea(closed.slice(0, 3)), null);
});

test('previous level resolves the nearest lower elevation', () => {
  const levels = [
    { id: 'level_1', elevation: 0 },
    { id: 'level_2', elevation: 300 },
    { id: 'level_3', elevation: 600 },
  ];

  assert.equal(ProjectModel.getPreviousLevel(levels, 'level_3').id, 'level_2');
  assert.equal(ProjectModel.getPreviousLevel(levels, 'level_1'), null);
});

test('a door opening splits a wall into solid segments around the hole', () => {
  const wall = { id: 'wall_1', x1: 0, y1: 0, x2: 500, y2: 0, height: 280 };
  const doors = [{ id: 'door_1', wallId: 'wall_1', x: 250, y: 0, width: 100, height: 210 }];

  assert.deepEqual(ProjectModel.computeWallSegments(wall, doors, []), [
    { start: 0, end: 2, bottom: 0, top: 2.8 },
    { start: 2, end: 3, bottom: 2.1, top: 2.8 },
    { start: 3, end: 5, bottom: 0, top: 2.8 },
  ]);
});

test('a window opening keeps wall material below and above the glass', () => {
  const wall = { id: 'wall_1', x1: 0, y1: 0, x2: 500, y2: 0, height: 280 };
  const windows = [{ id: 'window_1', wallId: 'wall_1', x: 250, y: 0, width: 100, sillHeight: 90, height: 120 }];

  assert.deepEqual(ProjectModel.computeWallSegments(wall, [], windows), [
    { start: 0, end: 2, bottom: 0, top: 2.8 },
    { start: 2, end: 3, bottom: 0, top: 0.9 },
    { start: 2, end: 3, bottom: 2.1, top: 2.8 },
    { start: 3, end: 5, bottom: 0, top: 2.8 },
  ]);
});

test('cutaway view removes the two walls between the camera and a rectangular room', () => {
  const walls = [
    { id: 'north', x1: 0, y1: 0, x2: 300, y2: 0 },
    { id: 'east', x1: 300, y1: 0, x2: 300, y2: 250 },
    { id: 'south', x1: 300, y1: 250, x2: 0, y2: 250 },
    { id: 'west', x1: 0, y1: 250, x2: 0, y2: 0 },
  ];

  assert.deepEqual(
    ProjectModel.computeCutawayWallIds(walls, { x: 6, z: 5 }),
    ['east', 'south'],
  );
});

test('door pose uses the nearest wall end as its hinge and opens into the room', () => {
  const wall = { id: 'south', x1: 300, y1: 250, x2: 0, y2: 250 };
  const door = { id: 'door_1', wallId: 'south', x: 45, y: 250, width: 90, openAngle: 90 };

  assert.deepEqual(ProjectModel.computeDoorPose(door, wall), {
    centerX: 45,
    centerY: 250,
    hingeX: 0,
    hingeY: 250,
    openEndX: 0,
    openEndY: 160,
    hingeSide: 1,
    openAngle: 90,
  });
});

test('opening position stays on its wall and keeps the full width inside both ends', () => {
  const wall = { id: 'wall_1', x1: 100, y1: 50, x2: 100, y2: 550 };
  const window = { id: 'window_1', wallId: 'wall_1', width: 120 };

  assert.deepEqual(ProjectModel.placeOpeningOnWall(window, wall, 20), { x: 100, y: 110, offset: 60 });
  assert.deepEqual(ProjectModel.placeOpeningOnWall(window, wall, 480), { x: 100, y: 490, offset: 440 });
});

test('furniture hit testing follows its visible rotation', () => {
  const furniture = { x: 0, y: 0, w: 100, d: 50, rotation: Math.PI / 2 };
  assert.equal(ProjectModel.hitTestFurniture(furniture, 0, 45), true);
  assert.equal(ProjectModel.hitTestFurniture(furniture, 45, 0), false);
});

test('rectangle selection keeps fully contained objects on the active level', () => {
  const project = {
    walls: [
      { id: 'wall_inside', levelId: 'level_1', x1: 0, y1: 0, x2: 300, y2: 0 },
      { id: 'wall_partial', levelId: 'level_1', x1: 0, y1: 0, x2: 500, y2: 0 },
      { id: 'wall_other_level', levelId: 'level_2', x1: 0, y1: 0, x2: 200, y2: 0 },
    ],
    doors: [{ id: 'door_inside', levelId: 'level_1', x: 150, y: 0 }],
    windows: [{ id: 'window_outside', levelId: 'level_1', x: 420, y: 0 }],
    rooms: [],
    furnitures: [{ id: 'sofa_inside', levelId: 'level_1', x: 150, y: 120, w: 100, d: 60, rotation: 0 }],
    dimensions: [{ id: 'dimension_inside', levelId: 'level_1', x1: 30, y1: 180, x2: 250, y2: 180 }],
    stairs: [{ id: 'stair_other_level', levelId: 'level_2', x: 120, y: 120, width: 100, length: 200, rotation: 0 }],
  };

  assert.deepEqual(
    ProjectModel.selectObjectsInRect(project, { start: { x: 350, y: 220 }, end: { x: -10, y: -10 } }, 'level_1'),
    [
      { type: 'wall', id: 'wall_inside' },
      { type: 'door', id: 'door_inside' },
      { type: 'furniture', id: 'sofa_inside' },
      { type: 'dimension', id: 'dimension_inside' },
    ],
  );
});

test('furniture catalog filters by category and localized search text', () => {
  const items = [
    { type: 'sofa', category: 'living', label: '沙发 Sofa' },
    { type: 'bed', category: 'bedroom', label: '床 Bed' },
    { type: 'sink', category: 'kitchen', label: '水槽 Sink' },
  ];

  assert.deepEqual(ProjectModel.filterFurnitureCatalog(items, 'living', ''), [items[0]]);
  assert.deepEqual(ProjectModel.filterFurnitureCatalog(items, 'all', 'BED'), [items[1]]);
  assert.deepEqual(ProjectModel.filterFurnitureCatalog(items, 'all', '水槽'), [items[2]]);
  assert.deepEqual(ProjectModel.filterFurnitureCatalog(items, 'bath', ''), []);
});

test('object snapping places furniture flush against a wall without crossing it', () => {
  const result = ProjectModel.computeObjectSnap(
    { x: 57, y: 180, w: 100, d: 60 },
    { walls: [{ x1: 0, y1: 0, x2: 0, y2: 400, thickness: 20 }], objects: [], gridSize: 50, threshold: 12 },
  );
  assert.equal(result.x, 60);
  assert.equal(result.y, 180);
  assert.equal(result.kind, 'wall');
  assert.deepEqual(result.guides, [{ type: 'wall', x1: 0, y1: 0, x2: 0, y2: 400 }]);
});

test('object snapping joins nearby furniture edges and aligns their centers', () => {
  const result = ProjectModel.computeObjectSnap(
    { x: 204, y: 103, w: 100, d: 60 },
    { walls: [], objects: [{ id: 'sofa', x: 100, y: 100, w: 100, d: 80 }], gridSize: 50, threshold: 10 },
  );
  assert.equal(result.x, 200);
  assert.equal(result.y, 100);
  assert.equal(result.kind, 'object');
  assert.deepEqual(result.guides, [{ type: 'x', value: 200 }, { type: 'y', value: 100 }]);
});

test('object snapping preserves a free position when every target is outside the threshold', () => {
  const result = ProjectModel.computeObjectSnap(
    { x: 123, y: 177, w: 80, d: 50 },
    { walls: [], objects: [], gridSize: 50, threshold: 10 },
  );
  assert.deepEqual(result, { x: 123, y: 177, kind: null, guides: [] });
});

test('object snapping can preserve a minimum furniture gap instead of forcing edges to touch', () => {
  const result = ProjectModel.computeObjectSnap(
    { x: 229, y: 103, w: 100, d: 60 },
    { walls: [], objects: [{ id: 'sofa', x: 100, y: 100, w: 100, d: 80 }], gridSize: 50, threshold: 10, objectClearance: 25 },
  );
  assert.equal(result.x, 225);
  assert.equal(result.y, 100);
  assert.equal(result.kind, 'object');
});

test('room templates create ordinary editable walls, room metadata and furniture', () => {
  assert.deepEqual(Object.keys(ProjectModel.ROOM_TEMPLATES), ['living', 'bedroom', 'dining', 'study', 'kitchen', 'bathroom']);
  for (const templateId of Object.keys(ProjectModel.ROOM_TEMPLATES)) {
    const created = ProjectModel.createRoomTemplate(templateId, { levelId: 'level_2', originX: 100, originY: 200, startId: 20 });
    assert.equal(created.walls.length, 4, templateId);
    assert.equal(created.rooms.length, 1, templateId);
    assert.ok(created.furnitures.length >= 2, templateId);
    assert.ok(created.windows.length >= 1, templateId);
    assert.ok(created.doors.length >= 1, templateId);
    assert.ok([...created.windows, ...created.doors].every(item => created.walls.some(wall => wall.id === item.wallId)), templateId);
    const objects = [...created.walls, ...created.rooms, ...created.furnitures, ...created.windows, ...created.doors];
    assert.equal(new Set(objects.map(item => item.id)).size, objects.length, templateId);
    assert.ok(objects.every(item => item.levelId === 'level_2'), templateId);
    assert.ok(created.furnitures.every(item => item.roomId === created.rooms[0].id), templateId);
    assert.ok(created.nextId > 20, templateId);
  }
  const living = ProjectModel.createRoomTemplate('living', { startId: 1 });
  assert.deepEqual(
    Object.fromEntries(['w', 'd', 'h'].map(key => [key, living.furnitures.find(item => item.type === 'table')[key]])),
    { w: 90, d: 90, h: 38 },
  );
  assert.equal(living.furnitures.find(item => item.type === 'tv').elevation, 55);
  assert.equal(living.furnitures.find(item => item.type === 'sofa').x, 155);
  assert.equal(living.doors[0].openAngle, 8);
  assert.ok(living.furnitures.some(item => item.type === 'cabinet'));
  assert.ok(living.furnitures.some(item => item.type === 'armchair'));
  assert.ok(living.furnitures.some(item => item.type === 'rug'));
  const artwork = living.furnitures.find(item => item.type === 'artwork');
  assert.equal(artwork.elevation, 118);
  assert.equal(Number(artwork.x.toFixed(1)), 301.6);
  assert.equal(artwork.y, 5);
  assert.equal(artwork.rotation, 0);
});

test('the living-room artwork is mounted on a wall retained by the default cutaway view', () => {
  const artwork = ProjectModel.ROOM_TEMPLATES.living.furnitures.find(item => item.type === 'artwork');
  assert.equal(artwork.wallIndex, 0);
  assert.ok(artwork.wallRatio > 0.5 && artwork.wallRatio < 0.65);
});

test('normalization moves legacy living-room artwork from the cutaway wall into the visible wall gap', () => {
  const created = ProjectModel.createRoomTemplate('living', { startId: 1 });
  const artwork = created.furnitures.find(item => item.type === 'artwork');
  const legacyArtwork = {
    ...artwork,
    wallIndex: 1,
    wallRatio: 0.18,
    wallId: created.walls[1].id,
    x: 515,
    y: 68.4,
    rotation: Math.PI / 2,
  };
  const normalized = ProjectModel.normalizeProject({
    walls: created.walls,
    rooms: created.rooms,
    furnitures: created.furnitures.map(item => item.id === artwork.id ? legacyArtwork : item),
  });
  const repaired = normalized.furnitures.find(item => item.id === artwork.id);
  assert.equal(repaired.wallIndex, 0);
  assert.equal(repaired.wallId, created.walls[0].id);
  assert.equal(Number(repaired.x.toFixed(1)), 301.6);
  assert.equal(repaired.y, 5);
});

test('the complete modern home connects living, kitchen, two bedrooms and bathroom through a hallway', () => {
  const home = ProjectModel.createHomeTemplate('modernTwoBedroom', { levelId: 'level_1', startId: 1 });
  assert.deepEqual(home.rooms.map(room => room.templateId), [
    'living', 'kitchen', 'hallway', 'bedroomPrimary', 'bedroomSecondary', 'bathroom',
  ]);
  assert.ok(home.windows.length >= 5);
  assert.ok(home.doors.length >= 6);
  assert.ok([...home.doors, ...home.windows].every(opening => home.walls.some(wall => wall.id === opening.wallId)));

  const hallway = home.rooms.find(room => room.templateId === 'hallway');
  const connectedRoomIds = new Set();
  for (const door of home.doors) {
    if (door.fromRoomId === hallway.id) connectedRoomIds.add(door.toRoomId);
    if (door.toRoomId === hallway.id) connectedRoomIds.add(door.fromRoomId);
  }
  for (const room of home.rooms.filter(room => room.templateId !== 'hallway')) assert.ok(connectedRoomIds.has(room.id), room.templateId);
  assert.ok(home.doors.some(door => door.fromRoomId === null && door.toRoomId === hallway.id));

  const furnitureTypes = new Set(home.furnitures.map(item => item.type));
  for (const type of ['sofa', 'bed', 'fridge', 'stove', 'sink', 'toilet', 'bathtub', 'artwork']) assert.ok(furnitureTypes.has(type), type);
  const artwork = home.furnitures.find(item => item.type === 'artwork');
  const artworkWall = home.walls.find(wall => wall.id === artwork.wallId);
  assert.equal(artworkWall.y1, 0);
  assert.equal(artworkWall.y2, 0);
  assert.ok(home.walls.some(wall => wall.wallFinishId === 'blushPlaster'));
  assert.ok(home.walls.some(wall => wall.wallFinishId === 'sagePlaster'));
  assert.ok(home.walls.some(wall => wall.wallFinishId === 'bathroomTile'));
});

test('the complete modern home keeps freestanding furniture out of each other\'s clearance zone', () => {
  const home = ProjectModel.createHomeTemplate('modernTwoBedroom', { levelId: 'level_1', startId: 1 });
  assert.deepEqual(ProjectModel.findFurnitureClearanceIssues(home.furnitures, 25), []);
});

test('furniture clearance always rejects physical overlap but only adds soft spacing inside one room', () => {
  const base = { levelId: 'level_1', w: 60, d: 60, h: 80 };
  const groupedOverlap = ProjectModel.findFurnitureClearanceIssues([
    { ...base, id: 'a', x: 100, y: 100, roomId: 'left', clearanceGroup: 'run' },
    { ...base, id: 'b', x: 140, y: 100, roomId: 'right', clearanceGroup: 'run' },
  ], 25);
  assert.equal(groupedOverlap.length, 1);
  assert.equal(groupedOverlap[0].kind, 'overlap');

  const sameRoomTouch = ProjectModel.findFurnitureClearanceIssues([
    { ...base, id: 'a', x: 100, y: 100, roomId: 'living' },
    { ...base, id: 'b', x: 170, y: 100, roomId: 'living' },
  ], 25);
  assert.equal(sameRoomTouch.length, 1);
  assert.equal(sameRoomTouch[0].kind, 'clearance');

  const differentRooms = ProjectModel.findFurnitureClearanceIssues([
    { ...base, id: 'a', x: 100, y: 100, roomId: 'left' },
    { ...base, id: 'b', x: 170, y: 100, roomId: 'right' },
  ], 25);
  assert.deepEqual(differentRooms, []);
});

test('furniture room inference requires its rotated footprint to stay inside one room', () => {
  const rooms = [
    { id: 'small', levelId: 'level_1', x: 100, y: 100, w: 200, d: 200 },
    { id: 'large', levelId: 'level_1', x: 150, y: 100, w: 300, d: 240 },
  ];
  assert.equal(ProjectModel.findFurnitureRoomId(rooms, { levelId: 'level_1', x: 100, y: 100, w: 60, d: 80, rotation: Math.PI / 4 }), 'small');
  assert.equal(ProjectModel.findFurnitureRoomId(rooms, { levelId: 'level_1', x: 5, y: 100, w: 40, d: 40 }), null);
});

test('normalization upgrades the previous complete-home layout with finishes and furniture clearance', () => {
  const legacy = ProjectModel.createHomeTemplate('modernTwoBedroom', { levelId: 'level_1', startId: 1 });
  legacy.walls.forEach(wall => { delete wall.wallFinishId; });
  legacy.furnitures.forEach(item => { delete item.roomId; });
  const move = (type, currentX, currentY, x, y) => Object.assign(
    legacy.furnitures.find(item => item.type === type && item.x === currentX && item.y === currentY), { x, y },
  );
  move('armchair', 450, 360, 410, 335);
  move('table', 310, 230, 310, 245);
  move('lamp', 50, 170, 70, 415);
  move('bed', 940, 130, 940, 180);
  move('wardrobe', 940, 295, 1040, 55);
  move('bed', 940, 440, 940, 475);
  move('wardrobe', 940, 590, 1040, 365);
  const cabinet = legacy.furnitures.find(item => item.type === 'cabinet' && item.x === 805 && item.y === 560);
  Object.assign(cabinet, { type: 'desk', x: 820, y: 565, w: 105, d: 55, h: 75 });
  move('bathtub', 942.5, 710, 935, 710);
  move('toilet', 1075, 700, 1060, 700);

  const normalized = ProjectModel.normalizeProject(legacy);
  assert.deepEqual(ProjectModel.findFurnitureClearanceIssues(normalized.furnitures, 25), []);
  assert.ok(normalized.furnitures.filter(item => item.homeTemplateId === 'modernTwoBedroom').every(item => item.roomId));
  assert.ok(normalized.walls.some(wall => wall.wallFinishId === 'blushPlaster'));
  assert.ok(normalized.walls.some(wall => wall.wallFinishId === 'bathroomTile'));
});

test('wall-mounted template furniture applies a non-zero room origin exactly once', () => {
  const living = ProjectModel.createRoomTemplate('living', { originX: 620, originY: 40, startId: 1 });
  const artwork = living.furnitures.find(item => item.type === 'artwork');
  assert.equal(Number(artwork.x.toFixed(1)), 921.6);
  assert.equal(artwork.y, 45);
  assert.equal(artwork.wallId, living.walls[0].id);
});

test('the next room template attaches to the current building instead of creating a one metre gap', () => {
  const walls = ProjectModel.createRoomTemplate('living', { levelId: 'level_1', startId: 1 }).walls;
  assert.deepEqual(ProjectModel.getAdjacentRoomOrigin(walls, 'level_1'), { originX: 520, originY: 0 });
});

test('attaching a room removes overlapping duplicate wall spans and keeps shared-wall openings', () => {
  const bedroom = ProjectModel.createRoomTemplate('bedroom', { levelId: 'level_1', startId: 1 });
  const origin = ProjectModel.getAdjacentRoomOrigin(bedroom.walls, 'level_1');
  const living = ProjectModel.createRoomTemplate('living', { levelId: 'level_1', ...origin, startId: bedroom.nextId });
  const merged = ProjectModel.mergeRoomTemplateWalls(bedroom.walls, living);
  const sharedDoor = bedroom.doors[0];
  assert.ok(bedroom.walls.some(wall => wall.id === sharedDoor.wallId));
  assert.equal(merged.walls.some(wall => wall.x1 === 420 && wall.x2 === 420 && Math.min(wall.y1, wall.y2) < 360), false);
  assert.ok(merged.walls.some(wall => wall.x1 === 420 && wall.x2 === 420 && Math.min(wall.y1, wall.y2) === 360 && Math.max(wall.y1, wall.y2) === 380));
  assert.equal(ProjectModel.computeFloorPolygons([...bedroom.walls, ...merged.walls]).length, 2);
});

test('an interior stair footprint must remain inside an enclosed floor polygon', () => {
  const walls = ProjectModel.createRoomTemplate('living', { levelId: 'level_1', startId: 1 }).walls;
  assert.equal(ProjectModel.isFootprintInsideFloor(walls, { x: 260, y: 190, width: 100, length: 300, rotation: 0 }), true);
  assert.equal(ProjectModel.isFootprintInsideFloor(walls, { x: 560, y: 190, width: 100, length: 300, rotation: 0 }), false);
});

test('normalization repairs wall artwork saved with the old doubled template origin', () => {
  const created = ProjectModel.createRoomTemplate('living', { originX: 620, originY: 40, startId: 1 });
  const artwork = created.furnitures.find(item => item.type === 'artwork');
  const legacyArtwork = { ...artwork, wallId: undefined, x: artwork.x + 620, y: artwork.y + 40 };
  const normalized = ProjectModel.normalizeProject({
    levels: [{ id: 'level_1', elevation: 0, height: 280 }],
    walls: created.walls,
    rooms: created.rooms,
    furnitures: created.furnitures.map(item => item.id === artwork.id ? legacyArtwork : item),
  });
  const repaired = normalized.furnitures.find(item => item.id === artwork.id);
  assert.equal(Number(repaired.x.toFixed(1)), 921.6);
  assert.equal(repaired.y, 45);
  assert.equal(repaired.wallId, created.walls[0].id);
});

test('invalid interior stairs are identified without deleting their editable project data', () => {
  const walls = ProjectModel.createRoomTemplate('living', { levelId: 'level_1', startId: 1 }).walls;
  const stairs = [
    { id: 'inside', levelId: 'level_1', x: 260, y: 190, width: 100, length: 300, rotation: 0 },
    { id: 'outside', levelId: 'level_1', x: 560, y: 190, width: 100, length: 300, rotation: 0 },
  ];
  assert.deepEqual(ProjectModel.findInvalidStairIds(walls, stairs), ['outside']);
});
