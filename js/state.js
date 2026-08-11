const State = {
  levels: [{ ...ProjectModel.DEFAULT_LEVEL }],
  activeLevelId: ProjectModel.DEFAULT_LEVEL.id,
  walls: [],
  doors: [],
  windows: [],
  rooms: [],
  furnitures: [],
  dimensions: [],
  stairs: [],

  selectedTool: 'select',
  activeObject: null,
  activeType: null,
  nextId: 1,

  zoom: 1,
  panX: 0,
  panY: 0,
  mode: '2d',

  wallStart: null,
  wallDragging: false,
  wallEnd: null,
  dimensionStart: null,
  snapEnabled: true,
  snapGuides: [],
  snapPreview: null,
  showDimensions: true,
  gridSize: 50,

  hover: null,
  mouseWorld: null,

  // Whole-home style preset; see ProjectModel.STYLE_PRESETS.
  style: 'modern',
  architectureStyle: 'modern',
  // Furniture category filter
  furnitureCategory: 'all',
  // Sun controls
  sunAngle: 60,
  sunIntensity: 1.0,
};

function snapshot() {
  return JSON.stringify({
    levels: State.levels, activeLevelId: State.activeLevelId,
    walls: State.walls, doors: State.doors, windows: State.windows,
    rooms: State.rooms, furnitures: State.furnitures, dimensions: State.dimensions, stairs: State.stairs,
    nextId: State.nextId, style: State.style, architectureStyle: State.architectureStyle, sunAngle: State.sunAngle,
  });
}
function _restore(json) {
  const data = JSON.parse(json);
  State.levels = data.levels || [{ ...ProjectModel.DEFAULT_LEVEL }];
  State.activeLevelId = data.activeLevelId || State.levels[0].id;
  State.walls = data.walls;
  State.doors = data.doors;
  State.windows = data.windows;
  State.rooms = data.rooms;
  State.furnitures = data.furnitures;
  State.dimensions = data.dimensions;
  State.stairs = data.stairs || [];
  State.nextId = data.nextId;
  State.style = data.style || ProjectModel.DEFAULT_STYLE;
  State.architectureStyle = data.architectureStyle || ProjectModel.DEFAULT_ARCHITECTURE_STYLE;
  State.sunAngle = data.sunAngle || 60;
  State.activeObject = null;
  State.activeType = null;
  requestRedraw();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
  if (window.syncStyleUI) window.syncStyleUI();
  if (window.syncArchitectureUI) window.syncArchitectureUI();
  if (window.syncLevelsUI) window.syncLevelsUI();
}

const _history = ProjectModel.createHistory({ capture: snapshot, restore: _restore });
function beginHistory() { return _history.begin(); }
function localStorageOrNull() {
  try { return window.localStorage; } catch (_) { return null; }
}
function persistLocalDraft() {
  const storage = localStorageOrNull();
  const saved = Boolean(storage && ProjectModel.saveLocalDraft(storage, State));
  const badge = document.querySelector('.autosave-badge');
  if (badge) {
    badge.dataset.saveState = saved ? 'saved' : 'unavailable';
    badge.setAttribute('aria-live', 'polite');
    badge.textContent = t(saved ? 'status.autosaveSaved' : 'status.autosaveUnavailable');
    badge.title = saved
      ? [
        State.levels?.length || 0, '层 ·',
        State.walls?.length || 0, '墙 ·',
        State.doors?.length || 0, '门 ·',
        State.windows?.length || 0, '窗 ·',
        State.furnitures?.length || 0, '件家具',
      ].join(' ')
      : t('status.autosaveUnavailable');
  }
  return saved;
}
function restoreLocalDraft() {
  const storage = localStorageOrNull();
  const data = storage ? ProjectModel.loadLocalDraft(storage) : null;
  if (!data) return false;
  State.walls = data.walls; State.doors = data.doors; State.windows = data.windows;
  State.rooms = data.rooms; State.furnitures = data.furnitures; State.dimensions = data.dimensions; State.stairs = data.stairs;
  State.levels = data.levels; State.activeLevelId = data.activeLevelId;
  State.style = data.style; State.architectureStyle = data.architectureStyle; State.sunAngle = data.sunAngle;
  State.nextId = ProjectModel.getNextObjectId(data);
  _history.clear();
  return true;
}
function commitHistory(before) {
  const committed = _history.commit(before);
  if (committed) persistLocalDraft();
  return committed;
}
function mutateProject(mutator) {
  const before = beginHistory();
  mutator();
  return commitHistory(before);
}
function undo() { const changed = _history.undo(); if (changed) persistLocalDraft(); return changed; }
function redo() { const changed = _history.redo(); if (changed) persistLocalDraft(); return changed; }

// A page can be closed or reloaded immediately after an edit. Keep the latest
// in-memory state as the final save, even when a browser ends the page before
// the normal edit transaction finishes.
window.addEventListener('pagehide', () => persistLocalDraft());

// ---- Copy/Paste ----
let _clipboard = null;
function copySelection() {
  if (!State.activeObject) return;
  let arr = null;
  if (State.activeType === 'wall') arr = State.walls;
  else if (State.activeType === 'door') arr = State.doors;
  else if (State.activeType === 'window') arr = State.windows;
  else if (State.activeType === 'furniture') arr = State.furnitures;
  else if (State.activeType === 'stair') arr = State.stairs;
  if (!arr) return;
  const obj = arr.find(o => o.id === State.activeObject);
  if (obj) _clipboard = { kind: State.activeType, item: JSON.parse(JSON.stringify(obj)) };
}
function pasteSelection() {
  if (!_clipboard) return;
  const kind = _clipboard.kind === 'wall-endpoint' ? 'wall' : _clipboard.kind;
  const obj = JSON.parse(JSON.stringify(_clipboard.item));
  mutateProject(() => {
    obj.id = genId();
    if (Number.isFinite(obj.x)) obj.x += 50;
    if (Number.isFinite(obj.y)) obj.y += 50;
    if (obj.x1 != null) { obj.x1 += 50; obj.x2 += 50; obj.y1 += 50; obj.y2 += 50; }
    if (kind === 'furniture') State.furnitures.push(obj);
    else if (kind === 'stair') State.stairs.push(obj);
    else if (kind === 'door') State.doors.push(obj);
    else if (kind === 'window') State.windows.push(obj);
    else State.walls.push(obj);
  });
  State.activeObject = obj.id;
  State.activeType = kind;
  requestRedraw();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
}

function genId() { return 'obj_' + (State.nextId++); }

function isOnActiveLevel(item) { return !item || !item.levelId || item.levelId === State.activeLevelId; }
function activeLevelItems(items) { return (items || []).filter(isOnActiveLevel); }

function setState(patch) {
  Object.assign(State, patch);
  requestRedraw();
}

function getStylePreset() {
  return ProjectModel.STYLE_PRESETS[State.style] || ProjectModel.STYLE_PRESETS.modern;
}

function getArchitecturePreset() {
  return ProjectModel.ARCHITECTURE_PRESETS[State.architectureStyle] || ProjectModel.ARCHITECTURE_PRESETS.modern;
}
