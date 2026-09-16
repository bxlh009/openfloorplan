// Tools - Sweet Home 3D style
(function() {
  const canvas = document.getElementById('canvas-2d');
  const FURNITURE_CLEARANCE_CM = 25;

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

  function normalizeAngle(angle) {
    const fullTurn = Math.PI * 2;
    const value = Number(angle) || 0;
    return ((value % fullTurn) + fullTurn) % fullTurn;
  }

  function getFurnitureFootprint(item, rotation = item.rotation) {
    return ProjectModel.getRotatedFootprint(item.w, item.d || item.h, rotation);
  }

  function pendingFurniturePlacement(spec, x, y) {
    const rotation = normalizeAngle(State.pendingFurnitureRotation);
    const footprint = getFurnitureFootprint(spec, rotation);
    const snapped = snapObject({ x, y, w: footprint.w, d: footprint.d }, null, FURNITURE_CLEARANCE_CM);
    return { ...snapped, rotation, footprint };
  }

  function updatePendingFurniturePreview(spec, x, y) {
    const placement = pendingFurniturePlacement(spec, x, y);
    State.snapPreview = {
      x: placement.x,
      y: placement.y,
      w: spec.w,
      d: spec.d || spec.h,
      rotation: placement.rotation,
      label: t(spec.labelKey),
    };
    return placement;
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
      ...activeLevelItems(State.furnitures).map(item => ({ ...item, ...getFurnitureFootprint(item) })),
      ...activeLevelItems(State.stairs).map(item => ({ ...item, ...ProjectModel.getRotatedFootprint(item.width, item.length, item.rotation) })),
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

  function validateFurniturePlacement(item, excludeId) {
    const levelId = item.levelId || State.activeLevelId;
    const candidate = {
      ...item,
      id: item.id || '__candidate__',
      levelId,
      roomId: ProjectModel.findFurnitureSpaceId(State.rooms, State.walls, { ...item, levelId }),
    };
    const footprint = getFurnitureFootprint(candidate);
    const levelWalls = State.walls.filter(wall => wall.levelId === levelId);
    const floorPolygons = ProjectModel.computeFloorPolygons(levelWalls);
    if (floorPolygons.length && !ProjectModel.isFootprintInsideFloor(levelWalls, candidate)) {
      return { valid: false, reason: 'floor', roomId: null };
    }
    for (const wall of levelWalls) {
      const dist = distToSeg(candidate.x, candidate.y, wall.x1, wall.y1, wall.x2, wall.y2);
      const dx = wall.x2 - wall.x1; const dy = wall.y2 - wall.y1; const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length; const ny = dx / length;
      const support = Math.abs(nx) * footprint.w / 2 + Math.abs(ny) * footprint.d / 2 + (wall.thickness || 20) / 2;
      if (dist < support - 0.5) return { valid: false, reason: 'wall', roomId: null };
    }
    for (const stair of State.stairs.filter(other => other.levelId === levelId && other.id !== excludeId)) {
      const stairFootprint = ProjectModel.getRotatedFootprint(stair.width, stair.length, stair.rotation);
      if (Math.abs(candidate.x - stair.x) < (footprint.w + stairFootprint.w) / 2
        && Math.abs(candidate.y - stair.y) < (footprint.d + stairFootprint.d) / 2) {
        return { valid: false, reason: 'overlap', roomId: null };
      }
    }
    const furniture = State.furnitures
      .filter(other => other.levelId === levelId && other.id !== excludeId)
      .map(other => ({ ...other, roomId: ProjectModel.findFurnitureSpaceId(State.rooms, State.walls, other) }));
    const issue = ProjectModel.findFurnitureClearanceIssues([...furniture, candidate], FURNITURE_CLEARANCE_CM)
      .find(entry => entry.leftId === candidate.id || entry.rightId === candidate.id);
    if (issue) return { valid: false, reason: issue.kind, issue, roomId: null };
    return {
      valid: true,
      roomId: ProjectModel.findFurnitureRoomId(State.rooms, candidate),
      spaceId: candidate.roomId,
    };
  }

  function showFurniturePlacementIssue(reason) {
    const status = document.getElementById('status-info');
    if (!status) return;
    status.textContent = reason === 'floor' ? t('message.furnitureInside') : t('message.furnitureClearance');
  }

  function snapObject(item, excludeId, objectClearance = 0) {
    if (!State.snapEnabled) {
      State.snapGuides = [];
      return { x: item.x, y: item.y, kind: null, guides: [] };
    }
    const objects = [
      ...activeLevelItems(State.furnitures).map(object => ({ ...object, ...getFurnitureFootprint(object) })),
      ...activeLevelItems(State.stairs).map(object => ({ ...object, ...ProjectModel.getRotatedFootprint(object.width, object.length, object.rotation) })),
    ].filter(object => object.id !== excludeId);
    const result = ProjectModel.computeObjectSnap(item, {
      walls: activeLevelItems(State.walls), objects, gridSize: State.gridSize, threshold: 12, objectClearance,
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

  function findSnapPoint(wx, wy, excludeId) {
    if (!State.snapEnabled) return null;
    let best = null;
    let distance = 15 / State.zoom;
    for (const w of activeLevelItems(State.walls)) {
      if (w.id === excludeId) continue;
      for (const end of [1, 2]) {
        const d = Math.hypot(wx - w['x' + end], wy - w['y' + end]);
        if (d < distance) { distance = d; best = { x: w['x' + end], y: w['y' + end] }; }
      }
    }
    return best;
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
    State.pendingFurnitureRotation = 0;
    State.snapGuides = [];
    State.snapPreview = null;
  }

  // --- Pointer handlers ---

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    if (e.button === 2) {
      e.preventDefault();
      const m = getMouse(e);
      const w = _draw2d.toWorld(m.sx, m.sy);
      State.mouseWorld = w;

      if (State.pendingFurniture) {
        const spec = FURNITURE_DEFS[State.pendingFurniture];
        State.pendingFurnitureRotation = normalizeAngle(State.pendingFurnitureRotation + Math.PI / 2);
        if (spec) updatePendingFurniturePreview(spec, w.x, w.y);
        requestRedraw();
        return;
      }

      const pick = pickAt(w.x, w.y);
      if (pick?.type === 'furniture') {
        const rotation = normalizeAngle((pick.obj.rotation || 0) + Math.PI / 2);
        const validation = validateFurniturePlacement({ ...pick.obj, rotation }, pick.obj.id);
        if (validation.valid) {
          mutateProject(() => { pick.obj.rotation = rotation; pick.obj.roomId = validation.roomId; });
          setSelection([{ id: pick.id, type: 'furniture' }]);
          const status = document.getElementById('status-info');
          if (status) status.textContent = t('message.furnitureRotated').replace('{angle}', String(Math.round(pick.obj.rotation * 180 / Math.PI)));
          rebuild3D();
        } else showFurniturePlacementIssue(validation.reason);
      }
      return;
    }

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
        const placement = pendingFurniturePlacement(spec, w.x, w.y);
        const fx = placement.x;
        const fy = placement.y;
        const candidate = {
          type: State.pendingFurniture, levelId: State.activeLevelId,
          x: fx, y: fy, w: spec.w, d: spec.d, h: spec.h, rotation: placement.rotation,
        };
        const validation = validateFurniturePlacement(candidate);
        if (validation.valid) {
          let furnitureId;
          mutateProject(() => {
            furnitureId = genId();
            State.furnitures.push({
              id: furnitureId, ...candidate, roomId: validation.roomId,
            });
          });
          State.selectedTool = 'select';
          document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === 'select'));
          document.querySelectorAll('[data-furniture]').forEach(button => button.classList.remove('active'));
          if (window.updateToolLabel) window.updateToolLabel();
          setSelection([{ id: furnitureId, type: 'furniture' }]);
          rebuild3D();
        } else showFurniturePlacementIssue(validation.reason);
      }
      State.pendingFurniture = null;
      State.pendingFurnitureRotation = 0;
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
        const activeWalls = State.walls.filter(wall => wall.levelId === State.activeLevelId);
        if (!ProjectModel.isFootprintInsideFloor(activeWalls, { ...snapped, width: 100, length: 300, rotation: 0 })) {
          document.getElementById('status-info').textContent = t('message.stairInside');
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
      State.wallEnd = snapPt || { x: snapped.x, y: snapped.y };
      const len = Math.hypot(State.wallEnd.x - State.wallStart.x, State.wallEnd.y - State.wallStart.y);
      const ang = Math.atan2(State.wallEnd.y - State.wallStart.y, State.wallEnd.x - State.wallStart.x) * 180 / Math.PI;
      document.getElementById('status-info').textContent = t('message.length') + ': ' + (len/100).toFixed(2) + ' m | ' + t('message.angle') + ': ' + ang.toFixed(1) + '\u00b0';
      return;
    }

    if (draggedWallEndpoint && moveStart) {
      const { wall, endpoint } = draggedWallEndpoint;
      const snapPt = findSnapPoint(w.x, w.y, wall.id);
      const nx = snapPt ? snapPt.x : snapToGrid(w.x, State.gridSize);
      const ny = snapPt ? snapPt.y : snapToGrid(w.y, State.gridSize);
      ProjectModel.updateWallGeometry(State, wall.id, endpoint === 0 ? { x1: nx, y1: ny } : { x2: nx, y2: ny });
      moveStart = { x: w.x, y: w.y };
      rebuild3D();
      renderProps();
      return;
    }

    if (moveStart && moveObj && State.selectedTool === 'select' && !draggedWallEndpoint) {
      const dx = w.x - moveStart.x;
      const dy = w.y - moveStart.y;
      if (moveObj.type === 'furniture') {
        const footprint = getFurnitureFootprint(moveObj.obj);
        const snapped = snapObject({
          x: w.x + moveObj.snapOffset.x, y: w.y + moveObj.snapOffset.y, w: footprint.w, d: footprint.d,
        }, moveObj.obj.id, FURNITURE_CLEARANCE_CM);
        const validation = validateFurniturePlacement({ ...moveObj.obj, x: snapped.x, y: snapped.y }, moveObj.obj.id);
        if (validation.valid) {
          moveObj.obj.x = snapped.x; moveObj.obj.y = snapped.y; moveObj.obj.roomId = validation.roomId;
        } else showFurniturePlacementIssue(validation.reason);
      } else if (moveObj.type === 'stair') {
        const footprint = ProjectModel.getRotatedFootprint(moveObj.obj.width, moveObj.obj.length, moveObj.obj.rotation);
        const snapped = snapObject({
          x: w.x + moveObj.snapOffset.x, y: w.y + moveObj.snapOffset.y, w: footprint.w, d: footprint.d,
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
        const wall = moveObj.obj;
        ProjectModel.updateWallGeometry(State, wall.id, {
          x1: wall.x1 + dx, y1: wall.y1 + dy, x2: wall.x2 + dx, y2: wall.y2 + dy,
        });
      }
      moveStart = { x: w.x, y: w.y };
      rebuild3D();
    }

    // Status bar hints for pending operations
    if (State.pendingFurniture) {
      const spec = FURNITURE_DEFS[State.pendingFurniture];
      if (spec) {
        updatePendingFurniturePreview(spec, w.x, w.y);
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
    if (!State.pendingFurniture) {
      State.snapGuides = [];
      State.snapPreview = null;
    }

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

  window._tools = { pickAt, nearestWall, resetToolState, snapObject, validateFurniturePlacement };
})();
