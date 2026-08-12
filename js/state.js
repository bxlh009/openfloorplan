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
  selectedObjects: [],
  selectionBox: null,
  nextId: 1,
  pendingFurniture: null,
  pendingFurnitureRotation: 0,
  materialBrushId: null,

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
  renderMode: 'realtime',
  lightingPreset: 'daylight',
  cameraPreset: 'isometric',
  savedCamera: null,
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
    nextId: State.nextId, style: State.style, architectureStyle: State.architectureStyle, renderMode: State.renderMode, lightingPreset: State.lightingPreset, cameraPreset: State.cameraPreset, savedCamera: State.savedCamera, sunAngle: State.sunAngle,
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
  State.renderMode = data.renderMode || ProjectModel.DEFAULT_RENDER_MODE;
  State.lightingPreset = data.lightingPreset || ProjectModel.DEFAULT_LIGHTING_PRESET;
  State.cameraPreset = data.cameraPreset || ProjectModel.DEFAULT_CAMERA_PRESET;
  State.savedCamera = data.savedCamera || null;
  State.sunAngle = data.sunAngle || 60;
  State.activeObject = null;
  State.activeType = null;
  State.selectedObjects = [];
  State.selectionBox = null;
  State.pendingFurniture = null;
  State.pendingFurnitureRotation = 0;
  requestRedraw();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
  if (window.syncArchitectureUI) window.syncArchitectureUI();
  if (window.syncLevelsUI) window.syncLevelsUI();
}

const _history = ProjectModel.createHistory({ capture: snapshot, restore: _restore });
function beginHistory() { return _history.begin(); }
function localStorageOrNull() {
  try { return window.localStorage; } catch (_) { return null; }
}
function updateAutosaveBadge(saved) {
  const badge = document.querySelector('.autosave-badge');
  if (badge) {
    const summary = [
      State.levels?.length || 0, '层 ·',
      State.walls?.length || 0, '墙 ·',
      State.doors?.length || 0, '门 ·',
      State.windows?.length || 0, '窗 ·',
      State.furnitures?.length || 0, '件家具',
    ].join(' ');
    badge.dataset.saveState = saved ? 'saved' : 'unavailable';
    badge.setAttribute('aria-live', 'polite');
    badge.textContent = saved ? t('status.autosaveSaved') + ' · ' + summary : t('status.autosaveUnavailable');
    badge.setAttribute('title', saved ? summary : t('status.autosaveUnavailable'));
  }
}
function persistLocalDraft() {
  const storage = localStorageOrNull();
  const saved = Boolean(storage && ProjectModel.saveLocalDraft(storage, State));
  updateAutosaveBadge(saved);
  return saved;
}
function restoreLocalDraft() {
  const storage = localStorageOrNull();
  const data = storage ? ProjectModel.loadLocalDraft(storage) : null;
  if (!data) return false;
  State.walls = data.walls; State.doors = data.doors; State.windows = data.windows;
  State.rooms = data.rooms; State.furnitures = data.furnitures; State.dimensions = data.dimensions; State.stairs = data.stairs;
  State.levels = data.levels; State.activeLevelId = data.activeLevelId;
  State.style = data.style; State.architectureStyle = data.architectureStyle; State.renderMode = data.renderMode; State.lightingPreset = data.lightingPreset; State.cameraPreset = data.cameraPreset; State.savedCamera = data.savedCamera; State.sunAngle = data.sunAngle;
  State.nextId = ProjectModel.getNextObjectId(data);
  State.activeObject = null; State.activeType = null;
  State.selectedObjects = []; State.selectionBox = null;
  _history.clear();
  updateAutosaveBadge(true);
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

function normalizeSelectionType(type) { return type === 'wall-endpoint' ? 'wall' : type; }
function getSelectionEntries() {
  if (Array.isArray(State.selectedObjects) && State.selectedObjects.length) return State.selectedObjects;
  return State.activeObject ? [{ id: State.activeObject, type: State.activeType }] : [];
}
function setSelection(entries) {
  const unique = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry?.id || !entry?.type) continue;
    const key = normalizeSelectionType(entry.type) + ':' + entry.id;
    if (!unique.has(key)) unique.set(key, { id: entry.id, type: entry.type });
  }
  State.selectedObjects = [...unique.values()];
  if (State.selectedObjects.length === 1) {
    State.activeObject = State.selectedObjects[0].id;
    State.activeType = State.selectedObjects[0].type;
  } else {
    State.activeObject = null;
    State.activeType = null;
  }
  State.selectionBox = null;
  if (window.syncSelectionUI) window.syncSelectionUI();
  if (window.renderProps) window.renderProps();
  requestRedraw();
}
function clearSelection() { setSelection([]); }
function deleteSelectedObjects() {
  const entries = getSelectionEntries();
  if (!entries.length) return 0;
  const selectedKeys = new Set(entries.map(entry => normalizeSelectionType(entry.type) + ':' + entry.id));
  const wallIds = new Set(entries.filter(entry => normalizeSelectionType(entry.type) === 'wall').map(entry => entry.id));
  let deleted = 0;
  const shouldRemove = (type, item) => selectedKeys.has(type + ':' + item.id);
  mutateProject(() => {
    const removeCollection = (key, type) => {
      const collection = Array.isArray(State[key]) ? State[key] : [];
      State[key] = collection.filter(item => {
        const remove = shouldRemove(type, item);
        if (remove) deleted += 1;
        return !remove;
      });
    };
    removeCollection('walls', 'wall');
    for (const key of ['doors', 'windows']) {
      const type = key === 'doors' ? 'door' : 'window';
      const collection = Array.isArray(State[key]) ? State[key] : [];
      State[key] = collection.filter(item => {
        const remove = shouldRemove(type, item) || wallIds.has(item.wallId);
        if (remove) deleted += 1;
        return !remove;
      });
    }
    removeCollection('rooms', 'room');
    removeCollection('furnitures', 'furniture');
    removeCollection('dimensions', 'dimension');
    removeCollection('stairs', 'stair');
  });
  clearSelection();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
  if (deleted) {
    const status = document.getElementById('status-info');
    if (status) status.textContent = t('message.deleteSelection').replace('{count}', String(deleted));
  }
  return deleted;
}
window.setSelection = setSelection;
window.clearSelection = clearSelection;
window.deleteSelectedObjects = deleteSelectedObjects;

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
  State.selectedObjects = [{ id: obj.id, type: kind }];
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
