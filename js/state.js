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
  snapEnabled: true,
  showDimensions: true,
  gridSize: 50,

  hover: null,
  mouseWorld: null,

  // Style: modern | nordic | chinese | japanese | american | industrial
  style: 'modern',
  // Furniture category filter
  furnitureCategory: 'all',
  // Sun controls
  sunAngle: 60,
  sunIntensity: 1.0,
};

// ---- Undo/Redo history ----
const _history = [];
const _redoStack = [];
let _historyTimer = null;

function snapshot() {
  return JSON.stringify({
    walls: State.walls, doors: State.doors, windows: State.windows,
    rooms: State.rooms, furnitures: State.furnitures, dimensions: State.dimensions,
    nextId: State.nextId,
  });
}
function _pushHistory() {
  if (_historyTimer) return;
  _historyTimer = setTimeout(() => {
    _historyTimer = null;
    _history.push(snapshot());
    if (_history.length > 50) _history.shift();
    _redoStack.length = 0;
  }, 250);
}
function undo() {
  if (_historyTimer) { clearTimeout(_historyTimer); _historyTimer = null; }
  if (_history.length === 0) return;
  _redoStack.push(snapshot());
  const prev = _history.pop();
  _restore(prev);
}
function redo() {
  if (_redoStack.length === 0) return;
  _history.push(snapshot());
  const next = _redoStack.pop();
  _restore(next);
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
  State.activeObject = null;
  State.activeType = null;
  requestRedraw();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
}

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
  if (obj) _clipboard = JSON.parse(JSON.stringify(obj));
}
function pasteSelection() {
  if (!_clipboard) return;
  _pushHistory();
  const obj = JSON.parse(JSON.stringify(_clipboard));
  obj.id = genId();
  obj.x += 50;
  obj.y += 50;
  if (obj.x1 != null) { obj.x1 += 50; obj.x2 += 50; obj.y1 += 50; obj.y2 += 50; }
  if (obj.type) State.furnitures.push(obj);
  else if (obj.width && obj.wallId) {
    if (obj.height != null) State.windows.push(obj);
    else State.doors.push(obj);
  } else State.walls.push(obj);
  State.activeObject = obj.id;
  State.activeType = obj.type ? 'furniture' : (obj.width ? (obj.height != null ? 'window' : 'door') : 'wall');
  requestRedraw();
  if (window.rebuild3D) window.rebuild3D();
  if (window.renderProps) window.renderProps();
}

function genId() { return 'obj_' + (State.nextId++); }

function setState(patch) {
  Object.assign(State, patch);
  requestRedraw();
}

// Style color palettes
const STYLE_PALETTES = {
  modern: { wall: 0xf5f0e8, floor: 0xe8dcc4, wood: 0xa0826d, fabric: 0x4a4a4a, metal: 0xc0c0c0 },
  nordic: { wall: 0xffffff, floor: 0xf0e6d6, wood: 0xd4a574, fabric: 0xe8e8e8, metal: 0xb0b0b0 },
  chinese: { wall: 0xf5f0e0, floor: 0x8b5a2b, wood: 0x5a2d0c, fabric: 0x8b0000, metal: 0xd4af37 },
  japanese: { wall: 0xfaf5eb, floor: 0xc4a882, wood: 0x8b7355, fabric: 0xd2b48c, metal: 0x4a4a4a },
  american: { wall: 0xf0e8d8, floor: 0x654321, wood: 0x4a2c17, fabric: 0x2f4f4f, metal: 0xb8860b },
  industrial: { wall: 0xd0d0d0, floor: 0x505050, wood: 0x3a2a1a, fabric: 0x2f2f2f, metal: 0x1a1a1a },
};

function getPalette() { return STYLE_PALETTES[State.style] || STYLE_PALETTES.modern; }
