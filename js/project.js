(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CURRENT_VERSION = 3;
  const LOCAL_DRAFT_KEY = 'openfloorplan-project-v2';
  const DEFAULT_LEVEL = { id: 'level_1', name: '1F', elevation: 0, floorThickness: 20, height: 280, floorFinish: 'wood' };
  const DEFAULT_STYLE = 'modern';
  const DEFAULT_ARCHITECTURE_STYLE = 'modern';
  const FURNITURE_DEFAULTS = {
    sofa: { w: 180, d: 85, h: 80 },
    bed: { w: 160, d: 200, h: 50 },
    table: { w: 120, d: 80, h: 75 },
    wardrobe: { w: 180, d: 60, h: 200 },
    desk: { w: 120, d: 60, h: 75 },
    plant: { w: 30, d: 30, h: 100 },
    toilet: { w: 40, d: 60, h: 40 },
    bathtub: { w: 170, d: 70, h: 55 },
    cabinet: { w: 80, d: 50, h: 90 },
    fridge: { w: 70, d: 70, h: 180 },
    tv: { w: 120, d: 8, h: 70 },
    lamp: { w: 25, d: 25, h: 150 },
    stove: { w: 60, d: 60, h: 85 },
    sink: { w: 60, d: 50, h: 85 },
    washer: { w: 60, d: 60, h: 85 },
  };
  const STYLE_PRESETS = {
    modern: {
      wall: '#f4f1ec', floor: '#c8a47b', floorAlt: '#b99066', wood: '#9a6b43',
      fabric: '#65717b', metal: '#aeb7bf', accent: '#315f59', sky: '#c9d9e6', sun: '#fff0d6', furnitureProfile: 'low',
    },
    nordic: {
      wall: '#fbfbf7', floor: '#e1c9a8', floorAlt: '#d5b78e', wood: '#c79b69',
      fabric: '#aab7b0', metal: '#c8ced1', accent: '#78968b', sky: '#dce7ec', sun: '#fff7e8', furnitureProfile: 'tapered',
    },
    japanese: {
      wall: '#eee7d8', floor: '#b89b72', floorAlt: '#a9885f', wood: '#76563c',
      fabric: '#9e9a82', metal: '#4f5550', accent: '#66735b', sky: '#d6d8cf', sun: '#f8e7c7', furnitureProfile: 'floor',
    },
    wabiSabi: {
      wall: '#d8cdbc', floor: '#a68b6b', floorAlt: '#93765a', wood: '#745b45',
      fabric: '#8c8173', metal: '#6c6962', accent: '#7b6d59', sky: '#c8c2b7', sun: '#ecd8b8', furnitureProfile: 'organic',
    },
    industrial: {
      wall: '#a9aaa7', floor: '#6f6b65', floorAlt: '#5d5954', wood: '#5c4635',
      fabric: '#4d5153', metal: '#363b3d', accent: '#a5643d', sky: '#aeb9bf', sun: '#e8d5b4', furnitureProfile: 'frame',
    },
    american: {
      wall: '#eadfce', floor: '#7a5136', floorAlt: '#68432d', wood: '#5b3824',
      fabric: '#58645f', metal: '#a27845', accent: '#354f49', sky: '#c6d4dc', sun: '#ffe9c2', furnitureProfile: 'classic',
    },
  };
  const ARCHITECTURE_PRESETS = {
    modern: { frameWidth: 0.035, mullions: 0, baseboard: 0.04, crown: 0, doorProfile: 'flush' },
    nordic: { frameWidth: 0.045, mullions: 1, baseboard: 0.09, crown: 0.03, doorProfile: 'groove' },
    japanese: { frameWidth: 0.055, mullions: 4, baseboard: 0.04, crown: 0.07, doorProfile: 'slatted' },
    wabiSabi: { frameWidth: 0.07, mullions: 0, baseboard: 0.025, crown: 0, doorProfile: 'organic' },
    industrial: { frameWidth: 0.03, mullions: 2, baseboard: 0.07, crown: 0.05, doorProfile: 'steel' },
    american: { frameWidth: 0.075, mullions: 2, baseboard: 0.14, crown: 0.11, doorProfile: 'panel' },
  };

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeFurniture(item) {
    const defaults = FURNITURE_DEFAULTS[item.type] || { w: 60, d: 60, h: 60 };
    return {
      ...item,
      w: finiteNumber(item.w ?? item.width, defaults.w),
      d: finiteNumber(item.d ?? item.depth ?? item.height, defaults.d),
      h: finiteNumber(item.h, defaults.h),
      rotation: finiteNumber(item.rotation, 0),
    };
  }

  function normalizeLevel(level, index) {
    return {
      ...level,
      id: String(level.id || ('level_' + (index + 1))),
      name: String(level.name || ((index + 1) + 'F')),
      elevation: finiteNumber(level.elevation, index * 300),
      floorThickness: Math.max(1, finiteNumber(level.floorThickness, 20)),
      height: Math.max(100, finiteNumber(level.height, 280)),
      floorFinish: ['wood', 'tile', 'concrete'].includes(level.floorFinish) ? level.floorFinish : 'wood',
    };
  }

  function collection(input, key) {
    if (input[key] == null) return [];
    if (!Array.isArray(input[key])) throw new Error(key + ' must be an array.');
    return input[key];
  }

  function normalizeProject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Project data must be an object.');
    }
    const levels = (input.levels == null ? [DEFAULT_LEVEL] : collection(input, 'levels')).map(normalizeLevel);
    if (!levels.length) levels.push({ ...DEFAULT_LEVEL });
    const levelIds = new Set(levels.map(level => level.id));
    const fallbackLevelId = levels[0].id;
    const activeLevelId = levelIds.has(input.activeLevelId) ? input.activeLevelId : fallbackLevelId;
    const withLevel = item => ({ ...item, levelId: levelIds.has(item.levelId) ? item.levelId : fallbackLevelId });
    const walls = collection(input, 'walls').map(wall => withLevel({ thickness: 20, height: 280, ...wall }));
    const wallLevels = new Map(walls.map(wall => [wall.id, wall.levelId]));
    const withOpeningLevel = item => ({ ...item, levelId: levelIds.has(item.levelId) ? item.levelId : (wallLevels.get(item.wallId) || fallbackLevelId) });
    return {
      version: CURRENT_VERSION,
      levels,
      activeLevelId,
      style: Object.hasOwn(STYLE_PRESETS, input.style) ? input.style : DEFAULT_STYLE,
      architectureStyle: Object.hasOwn(ARCHITECTURE_PRESETS, input.architectureStyle) ? input.architectureStyle : DEFAULT_ARCHITECTURE_STYLE,
      sunAngle: finiteNumber(input.sunAngle, 60),
      walls,
      doors: collection(input, 'doors').map(withOpeningLevel),
      windows: collection(input, 'windows').map(withOpeningLevel),
      rooms: collection(input, 'rooms').map(withLevel),
      furnitures: collection(input, 'furnitures').map(item => withLevel(normalizeFurniture(item))),
      dimensions: collection(input, 'dimensions').map(withLevel),
      stairs: collection(input, 'stairs').map(stair => withLevel({
        width: 100, length: 300, stepCount: 16, rotation: 0, ...stair,
        toLevelId: levelIds.has(stair.toLevelId) ? stair.toLevelId : null,
      })),
    };
  }

  function serializeProject(state) {
    return normalizeProject({
      version: CURRENT_VERSION,
      levels: state.levels,
      activeLevelId: state.activeLevelId,
      style: state.style,
      architectureStyle: state.architectureStyle,
      sunAngle: state.sunAngle,
      walls: state.walls,
      doors: state.doors,
      windows: state.windows,
      rooms: state.rooms,
      furnitures: state.furnitures,
      dimensions: state.dimensions,
      stairs: state.stairs,
    });
  }

  function saveLocalDraft(storage, state) {
    try {
      storage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serializeProject(state)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadLocalDraft(storage) {
    try {
      const json = storage.getItem(LOCAL_DRAFT_KEY);
      if (!json) return null;
      return normalizeProject(JSON.parse(json));
    } catch (_) {
      try { storage.removeItem(LOCAL_DRAFT_KEY); } catch (_) { /* storage unavailable */ }
      return null;
    }
  }

  function getNextObjectId(project) {
    const ids = ['walls', 'doors', 'windows', 'rooms', 'furnitures', 'dimensions', 'stairs']
      .flatMap(key => Array.isArray(project[key]) ? project[key] : [])
      .map(item => Number.parseInt(String(item.id || '').split('_').pop(), 10))
      .filter(Number.isFinite);
    return Math.max(0, ...ids) + 1;
  }

  function getNextLevelId(project) {
    const ids = (project.levels || []).map(level => Number.parseInt(String(level.id).split('_').pop(), 10)).filter(Number.isFinite);
    return 'level_' + (Math.max(0, ...ids) + 1);
  }

  function getNextLevelElevation(project) {
    return Math.max(...(project.levels || [DEFAULT_LEVEL]).map(level => finiteNumber(level.elevation, 0) + finiteNumber(level.height, 280) + finiteNumber(level.floorThickness, 20)));
  }

  function duplicateLevel(project, sourceLevelId) {
    const normalized = normalizeProject(project);
    const source = normalized.levels.find(level => level.id === sourceLevelId);
    if (!source) throw new Error('Source level not found.');
    const levelId = getNextLevelId(normalized);
    const level = { ...source, id: levelId, name: (normalized.levels.length + 1) + 'F', elevation: getNextLevelElevation(normalized) };
    const next = JSON.parse(JSON.stringify(normalized));
    next.levels.push(level);
    const idMap = new Map();
    let nextId = getNextObjectId(next);
    const cloneCollection = key => {
      const clones = normalized[key].filter(item => item.levelId === sourceLevelId).map(item => {
        const id = 'obj_' + nextId++;
        idMap.set(item.id, id);
        return { ...item, id, levelId };
      });
      next[key].push(...clones);
    };
    ['walls', 'rooms', 'furnitures', 'dimensions'].forEach(cloneCollection);
    for (const key of ['doors', 'windows']) {
      const clones = normalized[key].filter(item => item.levelId === sourceLevelId).map(item => ({
        ...item, id: 'obj_' + nextId++, levelId, wallId: idMap.get(item.wallId) || item.wallId,
      }));
      next[key].push(...clones);
    }
    next.activeLevelId = levelId;
    return normalizeProject(next);
  }

  function computeFloorPolygons(walls) {
    const epsilon = 0.000001;
    const pointKey = point => point.x.toFixed(6) + ',' + point.y.toFixed(6);
    const points = new Map();
    for (const wall of Array.isArray(walls) ? walls : []) {
      for (const point of [
        { x: finiteNumber(wall.x1, 0), y: finiteNumber(wall.y1, 0) },
        { x: finiteNumber(wall.x2, 0), y: finiteNumber(wall.y2, 0) },
      ]) points.set(pointKey(point), point);
    }

    const edges = new Map();
    for (const wall of Array.isArray(walls) ? walls : []) {
      const start = { x: finiteNumber(wall.x1, 0), y: finiteNumber(wall.y1, 0) };
      const end = { x: finiteNumber(wall.x2, 0), y: finiteNumber(wall.y2, 0) };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= epsilon) continue;
      const cuts = [...points.values()].map(point => {
        const px = point.x - start.x;
        const py = point.y - start.y;
        const cross = Math.abs(px * dy - py * dx);
        const t = (px * dx + py * dy) / lengthSquared;
        return cross <= epsilon * Math.sqrt(lengthSquared) && t >= -epsilon && t <= 1 + epsilon ? Math.max(0, Math.min(1, t)) : null;
      }).filter(value => value != null).sort((a, b) => a - b);
      const uniqueCuts = cuts.filter((value, index) => index === 0 || Math.abs(value - cuts[index - 1]) > epsilon);
      for (let index = 0; index < uniqueCuts.length - 1; index += 1) {
        const a = { x: start.x + dx * uniqueCuts[index], y: start.y + dy * uniqueCuts[index] };
        const b = { x: start.x + dx * uniqueCuts[index + 1], y: start.y + dy * uniqueCuts[index + 1] };
        const aKey = pointKey(a);
        const bKey = pointKey(b);
        if (aKey === bKey) continue;
        points.set(aKey, a); points.set(bKey, b);
        const edgeKey = [aKey, bKey].sort().join('|');
        edges.set(edgeKey, [aKey, bKey]);
      }
    }

    const neighbors = new Map();
    function connect(a, b) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      neighbors.get(a).add(b);
    }
    for (const [a, b] of edges.values()) { connect(a, b); connect(b, a); }
    const sortedNeighbors = new Map([...neighbors].map(([key, values]) => {
      const origin = points.get(key);
      return [key, [...values].sort((a, b) => {
        const pointA = points.get(a); const pointB = points.get(b);
        return Math.atan2(pointA.y - origin.y, pointA.x - origin.x)
          - Math.atan2(pointB.y - origin.y, pointB.x - origin.x);
      })];
    }));

    const visited = new Set();
    const faces = [];
    const halfEdgeKey = (a, b) => a + '>' + b;
    for (const [edgeA, edgeB] of edges.values()) {
      for (const [startA, startB] of [[edgeA, edgeB], [edgeB, edgeA]]) {
        if (visited.has(halfEdgeKey(startA, startB))) continue;
        const path = [];
        let a = startA;
        let b = startB;
        let closed = false;
        for (let step = 0; step <= edges.size * 2; step += 1) {
          const directed = halfEdgeKey(a, b);
          if (visited.has(directed)) break;
          visited.add(directed);
          path.push(a);
          const options = sortedNeighbors.get(b) || [];
          const incomingIndex = options.indexOf(a);
          if (incomingIndex < 0 || !options.length) break;
          const next = options[(incomingIndex - 1 + options.length) % options.length];
          a = b;
          b = next;
          if (a === startA && b === startB) { closed = true; break; }
        }
        if (!closed || path.length < 3) continue;
        const polygon = path.map(key => points.get(key));
        const signedArea = polygon.reduce((sum, point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return sum + point.x * next.y - next.x * point.y;
        }, 0) / 2;
        if (signedArea > epsilon) faces.push(polygon);
      }
    }
    return faces;
  }

  function createHistory({ capture, restore, limit = 50 }) {
    const undoStack = [];
    const redoStack = [];

    function begin() {
      return capture();
    }

    function commit(before) {
      const after = capture();
      if (before === after) return false;
      undoStack.push(before);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
      return true;
    }

    function undo() {
      if (!undoStack.length) return false;
      redoStack.push(capture());
      restore(undoStack.pop());
      return true;
    }

    function redo() {
      if (!redoStack.length) return false;
      undoStack.push(capture());
      restore(redoStack.pop());
      return true;
    }

    function clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    }

    return { begin, commit, undo, redo, clear };
  }

  function computeWallSegments(wall, doors, windows) {
    const dx = (finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0)) / 100;
    const dz = (finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0)) / 100;
    const length = Math.hypot(dx, dz);
    const wallHeight = finiteNumber(wall.height, 280) / 100;
    if (length < 0.001 || wallHeight <= 0) return [];

    const openings = [];
    function addOpening(item, bottom, height) {
      if (item.wallId !== wall.id) return;
      const px = (finiteNumber(item.x, wall.x1) - finiteNumber(wall.x1, 0)) / 100;
      const pz = (finiteNumber(item.y, wall.y1) - finiteNumber(wall.y1, 0)) / 100;
      const along = Math.max(0, Math.min(length, (px * dx + pz * dz) / length));
      const halfWidth = Math.max(0, finiteNumber(item.width, 0) / 200);
      const start = Math.max(0, along - halfWidth);
      const end = Math.min(length, along + halfWidth);
      const openingBottom = Math.max(0, Math.min(wallHeight, bottom));
      const openingTop = Math.max(openingBottom, Math.min(wallHeight, openingBottom + height));
      if (end > start && openingTop > openingBottom) openings.push({ start, end, bottom: openingBottom, top: openingTop });
    }

    doors.forEach(door => addOpening(door, 0, finiteNumber(door.height, 210) / 100));
    windows.forEach(win => addOpening(win, finiteNumber(win.sillHeight, 90) / 100, finiteNumber(win.height, 120) / 100));

    const edges = [...new Set([0, length, ...openings.flatMap(opening => [opening.start, opening.end])])].sort((a, b) => a - b);
    const result = [];
    const round = value => Number(value.toFixed(6));
    for (let index = 0; index < edges.length - 1; index += 1) {
      const start = edges[index];
      const end = edges[index + 1];
      if (end - start < 0.000001) continue;
      const midpoint = (start + end) / 2;
      const blocked = openings
        .filter(opening => midpoint > opening.start && midpoint < opening.end)
        .map(opening => [opening.bottom, opening.top])
        .sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      for (const [bottom, top] of blocked) {
        if (bottom > cursor) result.push({ start: round(start), end: round(end), bottom: round(cursor), top: round(bottom) });
        cursor = Math.max(cursor, top);
      }
      if (cursor < wallHeight) result.push({ start: round(start), end: round(end), bottom: round(cursor), top: round(wallHeight) });
    }
    return result;
  }

  function computeCutawayWallIds(walls, cameraPosition) {
    if (!Array.isArray(walls) || !walls.length) return [];
    const points = walls.flatMap(wall => [
      { x: finiteNumber(wall.x1, 0) / 100, z: finiteNumber(wall.y1, 0) / 100 },
      { x: finiteNumber(wall.x2, 0) / 100, z: finiteNumber(wall.y2, 0) / 100 },
    ]);
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minZ = Math.min(...points.map(point => point.z));
    const maxZ = Math.max(...points.map(point => point.z));
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const viewX = finiteNumber(cameraPosition && cameraPosition.x, centerX) - centerX;
    const viewZ = finiteNumber(cameraPosition && cameraPosition.z, centerZ) - centerZ;

    return walls
      .filter(wall => {
        const midX = (finiteNumber(wall.x1, 0) + finiteNumber(wall.x2, 0)) / 200;
        const midZ = (finiteNumber(wall.y1, 0) + finiteNumber(wall.y2, 0)) / 200;
        return (midX - centerX) * viewX + (midZ - centerZ) * viewZ > 0.000001;
      })
      .map(wall => wall.id)
      .filter(Boolean);
  }

  function computeDoorPose(door, wall) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const centerX = finiteNumber(door.x, wall.x1);
    const centerY = finiteNumber(door.y, wall.y1);
    const width = Math.max(0, finiteNumber(door.width, 90));
    const distanceToStart = Math.hypot(centerX - wall.x1, centerY - wall.y1);
    const distanceToEnd = Math.hypot(centerX - wall.x2, centerY - wall.y2);
    const hingeSide = door.hingeSide === -1 || door.hingeSide === 1
      ? door.hingeSide
      : (distanceToStart <= distanceToEnd ? -1 : 1);
    const hingeX = centerX + ux * width / 2 * hingeSide;
    const hingeY = centerY + uy * width / 2 * hingeSide;
    const openAngle = Math.max(0, Math.min(110, finiteNumber(door.openAngle, 75)));
    const swing = door.swing === -1 ? -1 : 1;
    const rotation = -hingeSide * swing * openAngle * Math.PI / 180;
    const closedX = -hingeSide * ux * width;
    const closedY = -hingeSide * uy * width;
    const openEndX = hingeX + closedX * Math.cos(rotation) - closedY * Math.sin(rotation);
    const openEndY = hingeY + closedX * Math.sin(rotation) + closedY * Math.cos(rotation);
    const round = value => Number(value.toFixed(6));
    return {
      centerX: round(centerX), centerY: round(centerY),
      hingeX: round(hingeX), hingeY: round(hingeY),
      openEndX: round(openEndX), openEndY: round(openEndY),
      hingeSide, openAngle,
    };
  }

  function getOpeningOffset(opening, wall) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const px = finiteNumber(opening.x, wall.x1) - finiteNumber(wall.x1, 0);
    const py = finiteNumber(opening.y, wall.y1) - finiteNumber(wall.y1, 0);
    return Math.max(0, Math.min(length, (px * dx + py * dy) / length));
  }

  function placeOpeningOnWall(opening, wall, requestedOffset) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const halfWidth = Math.max(0, finiteNumber(opening.width, 0) / 2);
    const minOffset = Math.min(halfWidth, length / 2);
    const maxOffset = Math.max(minOffset, length - halfWidth);
    const offset = Math.max(minOffset, Math.min(maxOffset, finiteNumber(requestedOffset, minOffset)));
    const round = value => Number(value.toFixed(6));
    return {
      x: round(finiteNumber(wall.x1, 0) + dx / length * offset),
      y: round(finiteNumber(wall.y1, 0) + dy / length * offset),
      offset: round(offset),
    };
  }

  function hitTestFurniture(furniture, x, y) {
    const dx = finiteNumber(x, 0) - finiteNumber(furniture.x, 0);
    const dy = finiteNumber(y, 0) - finiteNumber(furniture.y, 0);
    const rotation = finiteNumber(furniture.rotation, 0);
    const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return Math.abs(localX) <= finiteNumber(furniture.w, 0) / 2
      && Math.abs(localY) <= finiteNumber(furniture.d, furniture.h || 0) / 2;
  }

  function normalizeSelectionRect(rect) {
    const start = rect?.start || rect?.a || rect;
    const end = rect?.end || rect?.b || rect;
    const x1 = finiteNumber(start?.x, 0);
    const y1 = finiteNumber(start?.y, 0);
    const x2 = finiteNumber(end?.x, x1);
    const y2 = finiteNumber(end?.y, y1);
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
  }

  function selectionRectContainsPoint(rect, point) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function rotatedBoxCorners(item, width, depth) {
    const x = finiteNumber(item.x, 0);
    const y = finiteNumber(item.y, 0);
    const halfWidth = Math.max(0, finiteNumber(width, 0)) / 2;
    const halfDepth = Math.max(0, finiteNumber(depth, 0)) / 2;
    const rotation = finiteNumber(item.rotation, 0);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]]
      .map(([localX, localY]) => ({ x: x + localX * cos - localY * sin, y: y + localX * sin + localY * cos }));
  }

  function selectionRectContainsObject(rect, type, item) {
    if (type === 'wall' || type === 'dimension') {
      return selectionRectContainsPoint(rect, { x: finiteNumber(item.x1, 0), y: finiteNumber(item.y1, 0) })
        && selectionRectContainsPoint(rect, { x: finiteNumber(item.x2, 0), y: finiteNumber(item.y2, 0) });
    }
    if (type === 'door' || type === 'window') {
      return selectionRectContainsPoint(rect, { x: finiteNumber(item.x, 0), y: finiteNumber(item.y, 0) });
    }
    if (type === 'furniture') {
      return rotatedBoxCorners(item, item.w, item.d ?? item.h).every(point => selectionRectContainsPoint(rect, point));
    }
    if (type === 'stair') {
      return rotatedBoxCorners(item, item.width, item.length).every(point => selectionRectContainsPoint(rect, point));
    }
    if (Number.isFinite(Number(item.x1)) && Number.isFinite(Number(item.y1))
      && Number.isFinite(Number(item.x2)) && Number.isFinite(Number(item.y2))) {
      return selectionRectContainsObject(rect, 'dimension', item);
    }
    if (Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) {
      const width = item.w ?? item.width;
      const depth = item.d ?? item.length ?? item.h;
      if (width != null && depth != null) return rotatedBoxCorners(item, width, depth).every(point => selectionRectContainsPoint(rect, point));
      return selectionRectContainsPoint(rect, item);
    }
    return false;
  }

  function selectObjectsInRect(project, rect, levelId) {
    const normalizedRect = normalizeSelectionRect(rect);
    const selected = [];
    const sameLevel = item => !levelId || !item.levelId || item.levelId === levelId;
    const add = (type, items) => {
      for (const item of Array.isArray(items) ? items : []) {
        if (sameLevel(item) && item.id && selectionRectContainsObject(normalizedRect, type, item)) selected.push({ type, id: item.id });
      }
    };
    add('wall', project?.walls);
    add('door', project?.doors);
    add('window', project?.windows);
    add('room', project?.rooms);
    add('furniture', project?.furnitures);
    add('dimension', project?.dimensions);
    add('stair', project?.stairs);
    return selected;
  }

  function computeObjectSnap(item, options) {
    const threshold = Math.max(0, finiteNumber(options?.threshold, 12));
    const rawX = finiteNumber(item?.x, 0);
    const rawY = finiteNumber(item?.y, 0);
    const width = Math.max(0, finiteNumber(item?.w, item?.width || 0));
    const depth = Math.max(0, finiteNumber(item?.d, item?.length || 0));
    const walls = Array.isArray(options?.walls) ? options.walls : [];
    const objects = Array.isArray(options?.objects) ? options.objects : [];

    let nearestWall = null;
    for (const wall of walls) {
      const x1 = finiteNumber(wall.x1, 0); const y1 = finiteNumber(wall.y1, 0);
      const dx = finiteNumber(wall.x2, 0) - x1; const dy = finiteNumber(wall.y2, 0) - y1;
      const length = Math.hypot(dx, dy);
      if (length < 0.001) continue;
      const tx = dx / length; const ty = dy / length;
      const nx = -ty; const ny = tx;
      const projection = Math.max(0, Math.min(length, (rawX - x1) * tx + (rawY - y1) * ty));
      const px = x1 + tx * projection; const py = y1 + ty * projection;
      const support = Math.abs(nx) * width / 2 + Math.abs(ny) * depth / 2 + finiteNumber(wall.thickness, 20) / 2;
      for (const side of [-1, 1]) {
        const x = px + nx * support * side; const y = py + ny * support * side;
        const distance = Math.hypot(x - rawX, y - rawY);
        if (distance <= threshold && (!nearestWall || distance < nearestWall.distance)) nearestWall = { x, y, distance, wall };
      }
    }
    if (nearestWall) return {
      x: Number(nearestWall.x.toFixed(6)), y: Number(nearestWall.y.toFixed(6)), kind: 'wall',
      guides: [{ type: 'wall', x1: nearestWall.wall.x1, y1: nearestWall.wall.y1, x2: nearestWall.wall.x2, y2: nearestWall.wall.y2 }],
    };

    function snapAxis(raw, size, axis) {
      let best = null;
      for (const other of objects) {
        const otherCenter = finiteNumber(other[axis], 0);
        const otherSize = Math.max(0, finiteNumber(axis === 'x' ? (other.w ?? other.width) : (other.d ?? other.length), 0));
        for (const position of [otherCenter, otherCenter + (otherSize + size) / 2, otherCenter - (otherSize + size) / 2]) {
          const distance = Math.abs(position - raw);
          if (distance <= threshold && (!best || distance < best.distance)) best = { position, distance, kind: 'object' };
        }
      }
      if (best) return best;
      const grid = Math.max(0, finiteNumber(options?.gridSize, 0));
      if (grid > 0) {
        const position = Math.round(raw / grid) * grid;
        const distance = Math.abs(position - raw);
        if (distance <= threshold) return { position, distance, kind: 'grid' };
      }
      return { position: raw, distance: Infinity, kind: null };
    }

    const snapX = snapAxis(rawX, width, 'x');
    const snapY = snapAxis(rawY, depth, 'y');
    const guides = [];
    if (snapX.kind) guides.push({ type: 'x', value: Number(snapX.position.toFixed(6)) });
    if (snapY.kind) guides.push({ type: 'y', value: Number(snapY.position.toFixed(6)) });
    return {
      x: Number(snapX.position.toFixed(6)), y: Number(snapY.position.toFixed(6)),
      kind: snapX.kind === 'object' || snapY.kind === 'object' ? 'object' : (snapX.kind || snapY.kind), guides,
    };
  }

  function filterFurnitureCatalog(items, category, query) {
    const selectedCategory = category || 'all';
    const term = String(query || '').trim().toLocaleLowerCase();
    return items.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const haystack = (String(item.label || '') + ' ' + String(item.type || '')).toLocaleLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }

  return { CURRENT_VERSION, LOCAL_DRAFT_KEY, DEFAULT_LEVEL, DEFAULT_STYLE, DEFAULT_ARCHITECTURE_STYLE, FURNITURE_DEFAULTS, STYLE_PRESETS, ARCHITECTURE_PRESETS, normalizeProject, serializeProject, saveLocalDraft, loadLocalDraft, getNextObjectId, getNextLevelId, getNextLevelElevation, duplicateLevel, computeFloorPolygons, createHistory, computeWallSegments, computeCutawayWallIds, computeDoorPose, getOpeningOffset, placeOpeningOnWall, hitTestFurniture, selectObjectsInRect, computeObjectSnap, filterFurnitureCatalog };
});
