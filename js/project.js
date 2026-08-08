(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CURRENT_VERSION = 2;
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

  function collection(input, key) {
    if (input[key] == null) return [];
    if (!Array.isArray(input[key])) throw new Error(key + ' must be an array.');
    return input[key];
  }

  function normalizeProject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Project data must be an object.');
    }
    return {
      version: CURRENT_VERSION,
      style: Object.hasOwn(STYLE_PRESETS, input.style) ? input.style : DEFAULT_STYLE,
      architectureStyle: Object.hasOwn(ARCHITECTURE_PRESETS, input.architectureStyle) ? input.architectureStyle : DEFAULT_ARCHITECTURE_STYLE,
      sunAngle: finiteNumber(input.sunAngle, 60),
      walls: collection(input, 'walls').map(wall => ({ thickness: 20, height: 280, ...wall })),
      doors: collection(input, 'doors').map(door => ({ ...door })),
      windows: collection(input, 'windows').map(win => ({ ...win })),
      rooms: collection(input, 'rooms').map(room => ({ ...room })),
      furnitures: collection(input, 'furnitures').map(normalizeFurniture),
      dimensions: collection(input, 'dimensions').map(dimension => ({ ...dimension })),
    };
  }

  function serializeProject(state) {
    return normalizeProject({
      version: CURRENT_VERSION,
      style: state.style,
      architectureStyle: state.architectureStyle,
      sunAngle: state.sunAngle,
      walls: state.walls,
      doors: state.doors,
      windows: state.windows,
      rooms: state.rooms,
      furnitures: state.furnitures,
      dimensions: state.dimensions,
    });
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

  return { CURRENT_VERSION, DEFAULT_STYLE, DEFAULT_ARCHITECTURE_STYLE, FURNITURE_DEFAULTS, STYLE_PRESETS, ARCHITECTURE_PRESETS, normalizeProject, serializeProject, createHistory, computeWallSegments, computeCutawayWallIds, computeDoorPose, getOpeningOffset, placeOpeningOnWall, hitTestFurniture };
});
