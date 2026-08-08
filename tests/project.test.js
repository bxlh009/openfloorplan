const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ProjectModel = require('../js/project.js');

test('v1 project files migrate to the v2 furniture and style contract', () => {
  const fixturePath = path.join(__dirname, '..', 'examples', 'studio-apartment.json');
  const legacy = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const project = ProjectModel.normalizeProject(legacy);

  assert.equal(project.version, 2);
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

  assert.equal(saved.version, 2);
  assert.equal(loaded.style, 'wabiSabi');
  assert.equal(loaded.architectureStyle, 'japanese');
  for (const key of ['walls', 'doors', 'windows', 'rooms', 'furnitures', 'dimensions']) {
    assert.equal(loaded[key].length, 1, key);
  }
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
