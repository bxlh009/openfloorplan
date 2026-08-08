const State = {
  walls: [],
  doors: [],
  windows: [],
  rooms: [],
  furnitures: [],
  dimensions: [],

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
    walls: State.walls, doors: State.doors, windows: State.windows,
    rooms: State.rooms, furnitures: State.furnitures, dimensions: State.dimensions,
    nextId: State.nextId, style: State.style, architectureStyle: State.architectureStyle, sunAngle: State.sunAngle,
  });
}
function _restore(json) {
  const data = JSON.parse(json);
  State.walls = data.walls;
  State.doors = data.doors;
  State.windows = data.windows;
  State.rooms = data.rooms;
  State.furnitures = data.furnitures;
  State.dimensions = data.dimensions;
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
}

const _history = ProjectModel.createHistory({ capture: snapshot, restore: _restore });
function beginHistory() { return _history.begin(); }
function commitHistory(before) { return _history.commit(before); }
function mutateProject(mutator) {
  const before = beginHistory();
  mutator();
  return commitHistory(before);
}
function undo() { return _history.undo(); }
function redo() { return _history.redo(); }

// ---- Copy/Paste ----
let _clipboard = null;
function copySelection() {
  if (!State.activeObject) return;
  let arr = null;
  if (State.activeType === 'wall') arr = State.walls;
  else if (State.activeType === 'door') arr = State.doors;
  else if (State.activeType === 'window') arr = State.windows;
  else if (State.activeType === 'furniture') arr = State.furnitures;
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
