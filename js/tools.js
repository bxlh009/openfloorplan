// Tools - Sweet Home 3D style
(function() {
  const canvas = document.getElementById('canvas-2d');

  let isPanning = false;
  let panStart = null;
  let moveStart = null;
  let moveObj = null;
  let moveHistory = null;
  let wallMouseDown = false;
  let draggedWallEndpoint = null;
  let roomStart = null; // First corner for room tool
  let marqueeSelecting = false;

  // --- Snapping helpers ---

  function snapToGrid(v, grid) {
    if (!State.snapEnabled) return v;
    return Math.round(v / grid) * grid;
  }

  function snapAngle(x1, y1, x2, y2) {
    if (!State.snapEnabled) return { x: x2, y: y2 };
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy);
    const snapAngles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -Math.PI/4, -Math.PI/2, -3*Math.PI/4];
    let closest = snapAngles[0];
    let minDiff = Math.abs(angle - closest);
    for (const sa of snapAngles) {
      const d = Math.abs(angle - sa);
      if (d < minDiff) { minDiff = d; closest = sa; }
    }
    if (minDiff < 10 * Math.PI / 180) {
      return { x: x1 + Math.cos(closest) * length, y: y1 + Math.sin(closest) * length };
    }
    return { x: x2, y: y2 };
  }

  function getMouse(e) {
    const rect = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  // --- Collision detection ---

  function linesIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    function cross(ux, uy, vx, vy) { return ux * vy - uy * vx; }
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx - cx, d2y = dy - cy;
    const denom = cross(d1x, d1y, d2x, d2y);
    if (Math.abs(denom) < 0.001) return false;
    const t = cross(cx - ax, cy - ay, d2x, d2y) / denom;
    const u = cross(cx - ax, cy - ay, d1x, d1y) / denom;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  }

  function wallCollides(x1, y1, x2, y2, excludeId) {
    for (const w of activeLevelItems(State.walls)) {
      if (w.id === excludeId) continue;
      if (linesIntersect(x1, y1, x2, y2, w.x1, w.y1, w.x2, w.y2)) return w;
    }
    return null;
  }

  function furnitureOverlaps(fx, fy, fw, fd, excludeId) {
    const objects = [
      ...activeLevelItems(State.furnitures).map(item => ({ ...item, d: item.d || item.h })),
      ...activeLevelItems(State.stairs).map(item => ({ ...item, w: item.width, d: item.length })),
    ];
    for (const object of objects) {
      if (object.id === excludeId) continue;
      if (Math.abs(fx - object.x) < (fw + object.w) / 2 && Math.abs(fy - object.y) < (fd + object.d) / 2) return object;
    }
    for (const w of activeLevelItems(State.walls)) {
      const dist = distToSeg(fx, fy, w.x1, w.y1, w.x2, w.y2);
      const dx = w.x2 - w.x1; const dy = w.y2 - w.y1; const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length; const ny = dx / length;
      const support = Math.abs(nx) * fw / 2 + Math.abs(ny) * fd / 2 + (w.thickness || 20) / 2;
      if (dist < support - 0.5) return w;
    }
    return null;
  }

  function snapObject(item, excludeId) {
    if (!State.snapEnabled) {
      State.snapGuides = [];
      return { x: item.x, y: item.y, kind: null, guides: [] };
    }
    const objects = [
      ...activeLevelItems(State.furnitures).map(object => ({ ...object, d: object.d || object.h })),
      ...activeLevelItems(State.stairs).map(object => ({ ...object, w: object.width, d: object.length })),
    ].filter(object => object.id !== excludeId);
    const result = ProjectModel.computeObjectSnap(item, {
      walls: activeLevelItems(State.walls), objects, gridSize: State.gridSize, threshold: 12,
    });
    State.snapGuides = result.guides;
    return result;
  }

  // --- Picking ---

  function pickAt(wx, wy) {
    // Visible objects take priority over structural lines underneath them.
    const stairs = activeLevelItems(State.stairs);
    for (let i = stairs.length - 1; i >= 0; i--) {
      const stair = stairs[i];
      if (ProjectModel.hitTestFurniture({ ...stair, w: stair.width, d: stair.length }, wx, wy)) return { type: 'stair', obj: stair, id: stair.id };
    }
    const furnitures = activeLevelItems(State.furnitures);
    for (let i = furnitures.length - 1; i >= 0; i--) {
      const f = furnitures[i];
      if (ProjectModel.hitTestFurniture(f, wx, wy)) return { type: 'furniture', obj: f, id: f.id };
    }
    for (const d of activeLevelItems(State.doors)) {
      if (Math.hypot(wx - d.x, wy - d.y) < Math.max(15, d.width / 2)) return { type: 'door', obj: d, id: d.id };
    }
    for (const win of activeLevelItems(State.windows)) {
      if (Math.hypot(wx - win.x, wy - win.y) < Math.max(15, win.width / 2)) return { type: 'window', obj: win, id: win.id };
    }
    const walls = activeLevelItems(State.walls);
    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i];
      if (Math.hypot(wx - w.x1, wy - w.y1) < 12) return { type: 'wall-endpoint', obj: w, id: w.id, endpoint: 0 };
      if (Math.hypot(wx - w.x2, wy - w.y2) < 12) return { type: 'wall-endpoint', obj: w, id: w.id, endpoint: 1 };
    }
    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i];
      const d = distToSeg(wx, wy, w.x1, w.y1, w.x2, w.y2);
      if (d < 10 / State.zoom) return { type: 'wall', obj: w, id: w.id };
    }
    return null;
  }

  function distToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function findSnapPoint(wx, wy) {
    for (const w of activeLevelItems(State.walls)) {
      if (Math.hypot(wx - w.x1, wy - w.y1) < 15) return { x: w.x1, y: w.y1 };
      if (Math.hypot(wx - w.x2, wy - w.y2) < 15) return { x: w.x2, y: w.y2 };
    }
    return null;
  }

  // --- Reset tool state (called on tool switch) ---

  function resetToolState() {
    State.dimensionStart = null;
    roomStart = null;
    State.roomStart = null;
    isPanning = false;
    panStart = null;
    moveStart = null;
    moveObj = null;
    wallMouseDown = false;
    draggedWallEndpoint = null;
    marqueeSelecting = false;
    State.selectionBox = null;
    State.snapGuides = [];
    State.snapPreview = null;
  }

  // --- Pointer handlers ---

  canvas.addEventListener('pointerdown', e => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      panStart = { x: e.clientX - State.panX * State.zoom, y: e.clientY - State.panY * State.zoom };
      return;
    }

    const m = getMouse(e);
    const w = _draw2d.toWorld(m.sx, m.sy);
    State.mouseWorld = w;

    // Pending furniture placement: click anywhere to place at cursor
    if (State.pendingFurniture) {
      const spec = FURNITURE_DEFS[State.pendingFurniture];
      if (spec) {
        const snapped = snapObject({ x: w.x, y: w.y, w: spec.w, d: spec.d });
        const fx = snapped.x;
        const fy = snapped.y;
        if (!furnitureOverlaps(fx, fy, spec.w, spec.d)) {
          let furnitureId;
          mutateProject(() => {
            furnitureId = genId();
            State.furnitures.push({
              id: furnitureId, type: State.pendingFurniture, levelId: State.activeLevelId,
              x: fx, y: fy, w: spec.w, d: spec.d, h: spec.h, rotation: 0,
            });
          });
          State.selectedTool = 'select';
          document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === 'select'));
          document.querySelectorAll('[data-furniture]').forEach(button => button.classList.remove('active'));
          if (window.updateToolLabel) window.updateToolLabel();
          setSelection([{ id: furnitureId, type: 'furniture' }]);
          rebuild3D();
        } else {
          document.getElementById('status-info').textContent = t('message.overlap');
          setTimeout(() => document.getElementById('status-info').textContent = '', 2000);
        }
      }
      State.pendingFurniture = null;
      State.snapGuides = [];
      State.snapPreview = null;
      return;
    }

    switch (State.selectedTool) {
      case 'select': {
        const pick = pickAt(w.x, w.y);
        if (pick) {
          marqueeSelecting = false;
          if (e.shiftKey) {
            const current = Array.isArray(State.selectedObjects) ? State.selectedObjects : [];
            const key = normalizeSelectionType(pick.type) + ':' + pick.id;
            const next = current.some(entry => normalizeSelectionType(entry.type) + ':' + entry.id === key)
              ? current.filter(entry => normalizeSelectionType(entry.type) + ':' + entry.id !== key)
              : [...current, { id: pick.id, type: pick.type }];
            setSelection(next);
            break;
          }
          setSelection([{ id: pick.id, type: pick.type }]);
          moveStart = { x: w.x, y: w.y };
          moveObj = pick;
          if (pick.type === 'furniture' || pick.type === 'stair') {
            moveObj.snapOffset = { x: pick.obj.x - w.x, y: pick.obj.y - w.y };
          }
          moveHistory = beginHistory();
          if (pick.type === 'wall-endpoint') {
            draggedWallEndpoint = { wall: pick.obj, endpoint: pick.endpoint };
          }
        } else {
          setSelection([]);
          marqueeSelecting = true;
          State.selectionBox = { start: { x: w.x, y: w.y }, end: { x: w.x, y: w.y } };
          document.getElementById('status-info').textContent = t('message.dragSelect');
        }
        renderProps();
        break;
      }
      case 'wall': {
        wallMouseDown = true;
        const snapPt = findSnapPoint(w.x, w.y);
        State.wallStart = {
          x: snapPt ? snapPt.x : snapToGrid(w.x, State.gridSize),
          y: snapPt ? snapPt.y : snapToGrid(w.y, State.gridSize),
        };
        State.wallDragging = true;
        State.wallEnd = null;
        break;
      }
      case 'dimension': {
        if (!State.dimensionStart) State.dimensionStart = { x: w.x, y: w.y };
        else {
          mutateProject(() => {
            State.dimensions.push({ id: genId(), levelId: State.activeLevelId, x1: State.dimensionStart.x, y1: State.dimensionStart.y, x2: w.x, y2: w.y });
          });
          State.dimensionStart = null;
        }
        break;
      }
      case 'room': {
        if (!roomStart) {
          roomStart = { x: snapToGrid(w.x, State.gridSize), y: snapToGrid(w.y, State.gridSize) };
          State.roomStart = roomStart;
        } else {
          const x1 = roomStart.x, y1 = roomStart.y;
          const x2 = snapToGrid(w.x, State.gridSize), y2 = snapToGrid(w.y, State.gridSize);
          if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
            roomStart = null;
            State.roomStart = null;
            break;
          }
          const segs = [
            { x1, y1, x2: x2, y1 },
            { x1: x2, y1, x2, y2 },
            { x1: x2, y2, x2: x1, y2 },
            { x1, y2, x2, y1 },
          ];
          let blocked = false;
          for (const seg of segs) {
            if (wallCollides(seg.x1, seg.y1, seg.x2, seg.y2)) { blocked = true; break; }
          }
          if (blocked) {
            document.getElementById('status-info').textContent = t('message.roomCross');
            setTimeout(() => document.getElementById('status-info').textContent = '', 2000);
          } else {
            mutateProject(() => {
              for (const seg of segs) State.walls.push({ id: genId(), levelId: State.activeLevelId, ...seg, thickness: 20, height: 280 });
            });
            rebuild3D();
          }
          roomStart = null;
          State.roomStart = null;
        }
        break;
      }
      case 'door': {
        const near = nearestWall(w.x, w.y);
        if (near) {
          const halfW = 45; // half door width in cm
          const pos = clampToWall(near.wall, near.x, near.y, halfW);
          mutateProject(() => {
            State.doors.push({
              id: genId(), levelId: State.activeLevelId, x: pos.x, y: pos.y, wallId: near.wall.id,
              width: 90,
              angle: Math.atan2(near.wall.y2 - near.wall.y1, near.wall.x2 - near.wall.x1),
            });
          });
          rebuild3D();
        }
        break;
      }
      case 'window': {
        const near = nearestWall(w.x, w.y);
        if (near) {
          const halfW = 60; // half window width in cm
          const pos = clampToWall(near.wall, near.x, near.y, halfW);
          mutateProject(() => {
            State.windows.push({
              id: genId(), levelId: State.activeLevelId, x: pos.x, y: pos.y, wallId: near.wall.id,
              width: 120,
              angle: Math.atan2(near.wall.y2 - near.wall.y1, near.wall.x2 - near.wall.x1),
            });
          });
          rebuild3D();
        }
        break;
      }
      case 'stair': {
        const current = State.levels.find(level => level.id === State.activeLevelId);
        const target = State.levels
          .filter(level => level.elevation > (current?.elevation || 0))
          .sort((a, b) => a.elevation - b.elevation)[0] || null;
        const snapped = snapObject({ x: w.x, y: w.y, w: 100, d: 300 });
        if (furnitureOverlaps(snapped.x, snapped.y, 100, 300)) {
          document.getElementById('status-info').textContent = t('message.overlap');
          break;
        }
        mutateProject(() => State.stairs.push({
          id: genId(), levelId: State.activeLevelId, toLevelId: target?.id || null,
          x: snapped.x, y: snapped.y,
          width: 100, length: 300, stepCount: 16, rotation: 0,
        }));
        State.snapGuides = []; State.snapPreview = null;
        rebuild3D();
        break;
      }
    }
  });

  canvas.addEventListener('pointermove', e => {
    const m = getMouse(e);
    const w = _draw2d.toWorld(m.sx, m.sy);
    State.mouseWorld = w;

    document.getElementById('status-pos').textContent = 'X: ' + (w.x / 100).toFixed(2) + 'm Y: ' + (w.y / 100).toFixed(2) + 'm';

    if (isPanning) {
      State.panX = (e.clientX - panStart.x) / State.zoom;
      State.panY = (e.clientY - panStart.y) / State.zoom;
      return;
    }

    if (marqueeSelecting && State.selectionBox) {
      State.selectionBox.end = { x: w.x, y: w.y };
      const count = ProjectModel.selectObjectsInRect(State, State.selectionBox, State.activeLevelId).length;
      document.getElementById('status-info').textContent = t('message.dragSelect') + (count ? ' · ' + t('status.selectionCount').replace('{count}', String(count)) : '');
      requestRedraw();
      return;
    }

    if (State.wallDragging && State.wallStart) {
      const snapPt = findSnapPoint(w.x, w.y);
      let ex = snapPt ? snapPt.x : snapToGrid(w.x, State.gridSize);
      let ey = snapPt ? snapPt.y : snapToGrid(w.y, State.gridSize);
      const snapped = snapAngle(State.wallStart.x, State.wallStart.y, ex, ey);
      State.wallEnd = { x: snapped.x, y: snapped.y };
      const len = Math.hypot(State.wallEnd.x - State.wallStart.x, State.wallEnd.y - State.wallStart.y);
      const ang = Math.atan2(State.wallEnd.y - State.wallStart.y, State.wallEnd.x - State.wallStart.x) * 180 / Math.PI;
      document.getElementById('status-info').textContent = t('message.length') + ': ' + (len/10).toFixed(2) + ' m | ' + t('message.angle') + ': ' + ang.toFixed(1) + '\u00b0';
      return;
    }

    if (draggedWallEndpoint && moveStart) {
      const { wall, endpoint } = draggedWallEndpoint;
      const snapPt = findSnapPoint(w.x, w.y);
      const nx = snapPt ? snapPt.x : snapToGrid(w.x, State.gridSize);
      const ny = snapPt ? snapPt.y : snapToGrid(w.y, State.gridSize);
      if (endpoint === 0) { wall.x1 = nx; wall.y1 = ny; }
      else { wall.x2 = nx; wall.y2 = ny; }
      moveStart = { x: w.x, y: w.y };
      rebuild3D();
      renderProps();
      return;
    }

    if (moveStart && moveObj && State.selectedTool === 'select' && !draggedWallEndpoint) {
      const dx = w.x - moveStart.x;
      const dy = w.y - moveStart.y;
      if (moveObj.type === 'furniture' || moveObj.type === 'stair') {
        const width = moveObj.type === 'stair' ? moveObj.obj.width : moveObj.obj.w;
        const depth = moveObj.type === 'stair' ? moveObj.obj.length : (moveObj.obj.d || moveObj.obj.h);
        const snapped = snapObject({
          x: w.x + moveObj.snapOffset.x, y: w.y + moveObj.snapOffset.y, w: width, d: depth,
        }, moveObj.obj.id);
        moveObj.obj.x = snapped.x; moveObj.obj.y = snapped.y;
      } else if (moveObj.type === 'door' || moveObj.type === 'window') {
        const wall = State.walls.find(item => item.id === moveObj.obj.wallId);
        if (wall) {
          const offset = ProjectModel.getOpeningOffset({ x: w.x, y: w.y }, wall);
          const placed = ProjectModel.placeOpeningOnWall(moveObj.obj, wall, offset);
          moveObj.obj.x = placed.x; moveObj.obj.y = placed.y;
        }
      } else if (moveObj.type === 'wall') {
        moveObj.obj.x1 += dx; moveObj.obj.y1 += dy;
        moveObj.obj.x2 += dx; moveObj.obj.y2 += dy;
      }
      moveStart = { x: w.x, y: w.y };
      rebuild3D();
    }

    // Status bar hints for pending operations
    if (State.pendingFurniture) {
      const spec = FURNITURE_DEFS[State.pendingFurniture];
      if (spec) {
        const snapped = snapObject({ x: w.x, y: w.y, w: spec.w, d: spec.d });
        State.snapPreview = { x: snapped.x, y: snapped.y, w: spec.w, d: spec.d, label: t(spec.labelKey) };
      }
      document.getElementById('status-info').textContent = t('message.placeFurniture');
    } else if (State.selectedTool === 'dimension') {
      if (State.dimensionStart) {
        const length = Math.hypot(w.x - State.dimensionStart.x, w.y - State.dimensionStart.y);
        document.getElementById('status-info').textContent = t('message.dimensionEnd') + ' · ' + (length / 100).toFixed(2) + ' m';
      } else document.getElementById('status-info').textContent = t('message.dimensionStart');
    } else if (State.selectedTool === 'room' && roomStart) {
      document.getElementById('status-info').textContent = t('message.placeRoomEnd');
    } else if (State.selectedTool === 'stair') {
      const snapped = snapObject({ x: w.x, y: w.y, w: 100, d: 300 });
      State.snapPreview = { x: snapped.x, y: snapped.y, w: 100, d: 300, label: t('tool.stair') };
    }
  });

  canvas.addEventListener('pointerup', e => {
    isPanning = false;
    if (marqueeSelecting) {
      const selection = ProjectModel.selectObjectsInRect(State, State.selectionBox, State.activeLevelId);
      marqueeSelecting = false;
      State.selectionBox = null;
      setSelection(selection);
      const status = document.getElementById('status-info');
      if (status) status.textContent = t('status.selectionCount').replace('{count}', String(selection.length));
      return;
    }
    if (moveHistory != null) commitHistory(moveHistory);
    moveHistory = null;
    moveStart = null;
    moveObj = null;
    draggedWallEndpoint = null;
    State.snapGuides = [];
    State.snapPreview = null;

    if (State.wallDragging && State.wallStart) {
      const end = State.wallEnd || State.mouseWorld;
      if (end) {
        const dx = end.x - State.wallStart.x;
        const dy = end.y - State.wallStart.y;
        const length = Math.hypot(dx, dy);
        if (length > 5) {
          if (!wallCollides(State.wallStart.x, State.wallStart.y, end.x, end.y)) {
            mutateProject(() => {
              State.walls.push({
                id: genId(),
                levelId: State.activeLevelId,
                x1: State.wallStart.x, y1: State.wallStart.y,
                x2: end.x, y2: end.y,
                thickness: 20, height: 280,
              });
            });
            if (e.shiftKey) {
              State.wallStart = { x: end.x, y: end.y };
              State.wallEnd = null;
              return;
            }
          } else {
            document.getElementById('status-info').textContent = t('message.wallCross');
            setTimeout(() => document.getElementById('status-info').textContent = '', 2000);
          }
        }
      }
      State.wallStart = null;
      State.wallDragging = false;
      State.wallEnd = null;
      rebuild3D();
    }

    wallMouseDown = false;
    document.getElementById('status-info').textContent = '';
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    State.zoom = Math.max(0.1, Math.min(5, State.zoom * factor));
    document.getElementById('status-zoom').textContent = '\u7f29\u653e: ' + (State.zoom * 100).toFixed(1) + '%';
  }, { passive: false });

  function nearestWall(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const w of activeLevelItems(State.walls)) {
      const d = distToSeg(x, y, w.x1, w.y1, w.x2, w.y2);
      if (d < bestD && d < 30) {
        bestD = d;
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const l2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / l2));
        best = { wall: w, x: w.x1 + t * dx, y: w.y1 + t * dy };
      }
    }
    return best;
  }


  function clampToWall(wall, x, y, halfWidth) {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return { x, y };
    let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / (len * len);
    // Clamp t so that the object stays fully on the wall
    const tMin = halfWidth / len;
    const tMax = 1 - tMin;
    if (tMin > tMax) t = 0.5; // wall too short, place at center
    else t = Math.max(tMin, Math.min(tMax, t));
    return { x: wall.x1 + t * dx, y: wall.y1 + t * dy };
  }

  window._tools = { pickAt, nearestWall, resetToolState, snapObject };
})();
