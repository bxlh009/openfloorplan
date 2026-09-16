const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../js/project.js');

function room() {
  return {
    walls: [
      { id: 'a', levelId: '1', x1: 0, y1: 0, x2: 400, y2: 0 },
      { id: 'b', levelId: '1', x1: 400, y1: 0, x2: 400, y2: 300 },
      { id: 'upper', levelId: '2', x1: 400, y1: 0, x2: 400, y2: 300 },
    ],
    doors: [{ id: 'door', wallId: 'a', x: 200, y: 0, width: 80 }],
    windows: [{ id: 'window', wallId: 'b', x: 400, y: 150, width: 60 }],
  };
}

test('precise wall resizing preserves joints and repositions both walls openings', () => {
  const project = room();
  assert.equal(Model.updateWallGeometry(project, 'a', { x2: 500, y2: 0 }), true);
  assert.equal(project.walls[1].x1, 500);
  assert.equal(project.walls[2].x1, 400);
  assert.equal(project.doors[0].x, 250);
  assert.equal(project.windows[0].x, 450);
  assert.equal(project.windows[0].y, 150);
});

test('rotated walls carry opening position and angle', () => {
  const project = room();
  Model.updateWallGeometry(project, 'a', { x2: 0, y2: 400 });
  assert.equal(project.doors[0].x, 0);
  assert.equal(project.doors[0].y, 200);
  assert.equal(project.doors[0].angle, Math.PI / 2);
});

test('invalid geometry is rejected atomically instead of stranding openings', () => {
  for (const geometry of [{ x2: 20 }, { x2: NaN }, { x2: 400, y2: 299 }]) {
    const project = room();
    const before = JSON.stringify(project);
    assert.equal(Model.updateWallGeometry(project, 'a', geometry), false);
    assert.equal(JSON.stringify(project), before);
  }
});

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test('saving rotates a valid previous draft and repeated saves preserve recovery', () => {
  const local = storage();
  const first = { walls: [{ id: 'a', x1: 0, y1: 0, x2: 400, y2: 0 }] };
  assert.equal(Model.saveLocalDraft(local, first), true);
  assert.equal(Model.saveLocalDraft(local, { walls: [] }), true);
  assert.equal(Model.saveLocalDraft(local, { walls: [] }), true);
  assert.equal(Model.loadLocalDraft(local, true).walls.length, 1);
  assert.equal(Model.loadLocalDraft(local).walls.length, 0);
  local.setItem(Model.LOCAL_DRAFT_KEY, '{damaged');
  assert.equal(Model.loadLocalDraft(local).walls.length, 1);
  assert.equal(local.getItem(Model.LOCAL_DRAFT_KEY), '{damaged');
});

test('storage quota failure retains the last good primary draft', () => {
  const local = storage();
  Model.saveLocalDraft(local, { walls: [] });
  const previous = local.getItem(Model.LOCAL_DRAFT_KEY);
  local.setItem = () => { throw new Error('quota exceeded'); };
  assert.equal(Model.saveLocalDraft(local, room()), false);
  assert.equal(local.getItem(Model.LOCAL_DRAFT_KEY), previous);
});
