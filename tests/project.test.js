const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ProjectModel = require('../js/project.js');

test('v1 project files migrate to the v3 level, furniture and style contract', () => {
  const fixturePath = path.join(__dirname, '..', 'examples', 'studio-apartment.json');
  const legacy = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const project = ProjectModel.normalizeProject(legacy);

  assert.equal(project.version, 3);
  assert.deepEqual(project.levels, [{ id: 'level_1', name: '1F', elevation: 0, floorThickness: 20, height: 280, floorFinish: 'wood' }]);
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
    assert.match(preset.sky, /^#[0-9a-f]{6}$/i);
    assert.match(preset.sun, /^#[0-9a-f]{6}$/i);
    assert.match(preset.furnitureProfile, /^(low|tapered|floor|organic|frame|classic)$/);
    furnitureProfiles.add(preset.furnitureProfile);
  }
  assert.equal(furnitureProfiles.size, 6);
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
    doors: [{ id: 'obj_2', wallId: 'obj_1', x: 100, y: 0 }],
    furnitures: [{ id: 'obj_3', type: 'sofa', x: 150, y: 150 }],
  });
  const copy = ProjectModel.duplicateLevel(source, 'level_1');
  const copiedWall = copy.walls.find(item => item.levelId === 'level_2');
  const copiedDoor = copy.doors.find(item => item.levelId === 'level_2');
  assert.equal(copy.levels.length, 2);
  assert.equal(copy.activeLevelId, 'level_2');
  assert.equal(copy.levels[1].elevation, 300);
  assert.ok(copiedWall && copiedWall.id !== 'obj_1');
  assert.equal(copiedDoor.wallId, copiedWall.id);
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
  assert.deepEqual(restored.levels, project.levels);
  assert.equal(restored.activeLevelId, 'level_2');
  assert.deepEqual(restored.walls.map(wall => wall.levelId), ['level_1', 'level_2']);
  assert.equal(restored.doors[0].wallId, 'obj_2');
  assert.equal(restored.doors[0].levelId, 'level_2');
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
  assert.equal(removed, true);
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
