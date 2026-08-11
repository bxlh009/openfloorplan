// 2D Canvas rendering with real-time dimension displays
(function() {
  const canvas = document.getElementById('canvas-2d');
  const ctx = canvas.getContext('2d');
  let dpr = window.devicePixelRatio || 1;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    draw();
  }
  window.addEventListener('resize', resize);

  function toScreen(x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (x + State.panX) * State.zoom + rect.width / 2,
      y: (y + State.panY) * State.zoom + rect.height / 2,
    };
  }

  function toWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (sx - rect.width / 2) / State.zoom - State.panX,
      y: (sy - rect.height / 2) / State.zoom - State.panY,
    };
  }

  function isSelectedObject(type, id) {
    const normalized = type === 'wall-endpoint' ? 'wall' : type;
    if (Array.isArray(State.selectedObjects) && State.selectedObjects.some(entry => {
      const entryType = entry.type === 'wall-endpoint' ? 'wall' : entry.type;
      return entryType === normalized && entry.id === id;
    })) return true;
    const activeType = State.activeType === 'wall-endpoint' ? 'wall' : State.activeType;
    return State.activeObject === id && activeType === normalized;
  }

  function drawGrid() {
    const rect = canvas.getBoundingClientRect();
    const preset = getStylePreset();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = preset.wall;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const step = State.gridSize * State.zoom;
    const offsetX = (rect.width / 2 + State.panX * State.zoom) % step;
    const offsetY = (rect.height / 2 + State.panY * State.zoom) % step;

    ctx.strokeStyle = '#e5e5ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < rect.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
    }
    for (let y = offsetY; y < rect.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
    }
    ctx.stroke();

    const origin = toScreen(0, 0);
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x - 8, origin.y);
    ctx.lineTo(origin.x + 8, origin.y);
    ctx.moveTo(origin.x, origin.y - 8);
    ctx.lineTo(origin.x, origin.y + 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawWall(w) {
    const a = toScreen(w.x1, w.y1);
    const b = toScreen(w.x2, w.y2);
    const selected = isSelectedObject('wall', w.id);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = selected ? '#0071e3' : '#3a3a3c';
    ctx.lineWidth = Math.max(4, w.thickness * State.zoom);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();

    if (State.showDimensions) drawWallDimension(w);

    // Endpoint handles when selected
    if (selected) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#0071e3';
      ctx.lineWidth = 2;
      [a, b].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  function drawWallDimension(w) {
    const a = { x: w.x1, y: w.y1 };
    const b = { x: w.x2, y: w.y2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const angle = Math.atan2(dy, dx);
    // perpendicular offset for label
    const offset = 18 / State.zoom;
    const nx = -dy / length * offset;
    const nx2 = dx / length * 0; // keep aligned to wall
    const pos = toScreen(mid.x + nx, mid.y + (-dx / length * offset));

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#0071e3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // background
    const text = (length / 100).toFixed(2) + ' m';
    const m = ctx.measureText(text);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.roundRect(pos.x - m.width / 2 - 4, pos.y - 8, m.width + 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#0071e3';
    ctx.fillText(text, pos.x, pos.y);
    ctx.restore();
  }

  function drawDoor(d) {
    const wall = State.walls.find(item => item.id === d.wallId);
    if (!wall) return;
    const pose = ProjectModel.computeDoorPose(d, wall);
    const hinge = toScreen(pose.hingeX, pose.hingeY);
    const closed = toScreen(pose.centerX * 2 - pose.hingeX, pose.centerY * 2 - pose.hingeY);
    const opened = toScreen(pose.openEndX, pose.openEndY);
    const selected = isSelectedObject('door', d.id);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(hinge.x, hinge.y);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = selected ? '#0071e3' : '#34c759';
    ctx.lineWidth = selected ? 3 : 2;
    const w = d.width * State.zoom;
    const start = Math.atan2(closed.y - hinge.y, closed.x - hinge.x);
    const end = Math.atan2(opened.y - hinge.y, opened.x - hinge.x);
    const clockwiseDelta = (end - start + Math.PI * 2) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(closed.x - hinge.x, closed.y - hinge.y);
    ctx.arc(0, 0, w, start, end, clockwiseDelta > Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWindow(win) {
    const p = toScreen(win.x, win.y);
    const selected = isSelectedObject('window', win.id);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(p.x, p.y);
    ctx.rotate(win.angle || 0);
    ctx.fillStyle = '#5ac8fa';
    ctx.strokeStyle = selected ? '#0071e3' : '#007aff';
    ctx.lineWidth = selected ? 3 : 2;
    const w = win.width * State.zoom / 2;
    ctx.fillRect(-w, -3, w * 2, 6);
    ctx.strokeRect(-w, -3, w * 2, 6);
    ctx.restore();
  }

  function drawFurniture(f) {
    const p = toScreen(f.x, f.y);
    const w = f.w * State.zoom;
    const h = f.d * State.zoom;
    const color = f.color || getStylePreset().accent;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(p.x, p.y);
    ctx.rotate(f.rotation || 0);

    const selected = isSelectedObject('furniture', f.id);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = selected ? '#0071e3' : color;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    ctx.fillStyle = selected ? '#0071e3' : color;
    ctx.font = selected ? 'bold 12px sans-serif' : '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((selected ? t('status.selected') + ' · ' : '') + getFurnitureLabel(f.type), 0, 0);
    if (selected) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0071e3'; ctx.lineWidth = 2;
      for (const [x, y] of [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]) {
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function getFurnitureLabel(type) {
    return t('furniture.' + type) || type;
  }

  function drawDimension(dim) {
    const a = toScreen(dim.x1, dim.y1);
    const b = toScreen(dim.x2, dim.y2);
    ctx.save();
    ctx.scale(dpr, dpr);
    const selected = isSelectedObject('dimension', dim.id);
    ctx.strokeStyle = selected ? '#0071e3' : '#ff3b30';
    ctx.fillStyle = selected ? '#0071e3' : '#ff3b30';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';

    const dist = Math.hypot(b.x - a.x, b.y - a.y) / State.zoom * 10;
    ctx.fillText(dist.toFixed(0) + ' cm', (a.x + b.x) / 2, (a.y + b.y) / 2 - 6);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawStair(stair) {
    const p = toScreen(stair.x, stair.y);
    const width = stair.width * State.zoom;
    const length = stair.length * State.zoom;
    const steps = Math.max(2, Math.round(stair.stepCount || 16));
    ctx.save();
    ctx.scale(dpr, dpr); ctx.translate(p.x, p.y); ctx.rotate(stair.rotation || 0);
    const selected = isSelectedObject('stair', stair.id);
    ctx.fillStyle = 'rgba(177,143,101,.16)'; ctx.strokeStyle = selected ? '#0071e3' : '#765638';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.fillRect(-width / 2, -length / 2, width, length); ctx.strokeRect(-width / 2, -length / 2, width, length);
    ctx.lineWidth = 1;
    for (let index = 1; index < steps; index += 1) {
      const y = -length / 2 + length * index / steps;
      ctx.beginPath(); ctx.moveTo(-width / 2, y); ctx.lineTo(width / 2, y); ctx.stroke();
    }
    ctx.fillStyle = '#765638'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t('tool.stair') + ' ↑', 0, 4);
    ctx.restore();
  }

  function drawSnapFeedback() {
    if (!State.snapEnabled) return;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ff2d92'; ctx.fillStyle = '#ff2d92'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    for (const guide of State.snapGuides || []) {
      ctx.beginPath();
      if (guide.type === 'x') {
        const x = toScreen(guide.value, 0).x; ctx.moveTo(x, 0); ctx.lineTo(x, height);
      } else if (guide.type === 'y') {
        const y = toScreen(0, guide.value).y; ctx.moveTo(0, y); ctx.lineTo(width, y);
      } else if (guide.type === 'wall') {
        const a = toScreen(guide.x1, guide.y1); const b = toScreen(guide.x2, guide.y2);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    const preview = State.snapPreview;
    if (preview) {
      const p = toScreen(preview.x, preview.y);
      const w = preview.w * State.zoom; const h = preview.d * State.zoom;
      ctx.fillStyle = 'rgba(255,45,146,.10)'; ctx.strokeStyle = '#ff2d92'; ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(preview.rotation || 0);
      ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.setLineDash([]); ctx.fillStyle = '#ff2d92'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⌁ ' + preview.label, p.x, p.y + 4);
    }
    ctx.restore();
  }

  function drawDimensionPreview() {
    if (State.selectedTool !== 'dimension' || !State.mouseWorld) return;
    const end = toScreen(State.mouseWorld.x, State.mouseWorld.y);
    const startWorld = State.dimensionStart;
    const start = startWorld ? toScreen(startWorld.x, startWorld.y) : end;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ff3b30'; ctx.fillStyle = '#ff3b30'; ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    for (const point of [start, end]) { ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill(); }
    const label = startWorld
      ? (Math.hypot(State.mouseWorld.x - startWorld.x, State.mouseWorld.y - startWorld.y) / 100).toFixed(2) + ' m · ' + t('message.dimensionEnd')
      : t('message.dimensionStart');
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const metrics = ctx.measureText(label); const lx = (start.x + end.x) / 2; const ly = Math.min(start.y, end.y) - 12;
    ctx.fillStyle = 'rgba(255,59,48,0.94)'; ctx.beginPath(); ctx.roundRect(lx - metrics.width/2 - 7, ly - 18, metrics.width + 14, 20, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, lx, ly - 3);
    ctx.restore();
  }

  function drawLiveWallPreview() {
    if (!State.wallStart) return;
    const start = State.wallStart;
    const end = State.wallEnd || State.mouseWorld;
    if (!end) return;

    const a = toScreen(start.x, start.y);
    const b = toScreen(end.x, end.y);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Wall preview
    ctx.strokeStyle = '#0071e3';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Start dot
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#0071e3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // End dot (follows cursor)
    ctx.fillStyle = '#0071e3';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Live dimension text
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const angleDeg = angle * 180 / Math.PI;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    const lengthText = (length / 100).toFixed(2) + ' m';
    const angleText = angleDeg.toFixed(1) + '°';

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Length label
    const m1 = ctx.measureText(lengthText);
    ctx.fillStyle = 'rgba(0,113,227,0.92)';
    ctx.beginPath();
    ctx.roundRect(mid.x - m1.width / 2 - 5, mid.y - 22, m1.width + 10, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(lengthText, mid.x, mid.y - 7);

    // Angle label
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,59,48,0.92)';
    const m2 = ctx.measureText(angleText);
    ctx.beginPath();
    ctx.roundRect(mid.x - m2.width / 2 - 4, mid.y + 6, m2.width + 8, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(angleText, mid.x, mid.y + 18);

    ctx.restore();
  }

  function drawRoomPreview() {
    if (!State.roomStart || !State.mouseWorld) return;
    const a = toScreen(State.roomStart.x, State.roomStart.y);
    const b = toScreen(State.mouseWorld.x, State.mouseWorld.y);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#34c759';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
    ctx.fillStyle = '#34c759';
    [[a.x, a.y], [b.x, a.y], [b.x, b.y], [a.x, b.y]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    });
    const w = Math.abs(b.x - a.x) / State.zoom;
    const h = Math.abs(b.y - a.y) / State.zoom;
    const label = (w / 100).toFixed(1) + 'm x ' + (h / 100).toFixed(1) + 'm';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const m = ctx.measureText(label);
    ctx.fillStyle = 'rgba(52,199,89,0.92)';
    ctx.beginPath();
    ctx.roundRect((a.x + b.x) / 2 - m.width / 2 - 5, Math.min(a.y, b.y) - 26, m.width + 10, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, (a.x + b.x) / 2, Math.min(a.y, b.y) - 10);
    ctx.restore();
  }

  function drawLowerLevelPreview() {
    const lowerLevel = ProjectModel.getPreviousLevel(State.levels, State.activeLevelId);
    if (!lowerLevel) return;
    const walls = State.walls.filter(wall => wall.levelId === lowerLevel.id);
    if (!walls.length) return;

    const polygons = ProjectModel.computeFloorPolygons(walls);
    const area = ProjectModel.computeFloorArea(walls);
    const worldPoints = walls.flatMap(wall => [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ]);
    const minX = Math.min(...worldPoints.map(point => point.x));
    const maxX = Math.max(...worldPoints.map(point => point.x));
    const minY = Math.min(...worldPoints.map(point => point.y));
    const maxY = Math.max(...worldPoints.map(point => point.y));
    const rect = canvas.getBoundingClientRect();
    const center = toScreen((minX + maxX) / 2, (minY + maxY) / 2);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,113,227,0.045)';
    ctx.strokeStyle = 'rgba(0,113,227,0.52)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);

    polygons.forEach(polygon => {
      ctx.beginPath();
      polygon.forEach((point, index) => {
        const screen = toScreen(point.x, point.y);
        if (index === 0) ctx.moveTo(screen.x, screen.y);
        else ctx.lineTo(screen.x, screen.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // Keep the preview useful even when the lower floor is not closed yet.
    ctx.globalAlpha = 0.72;
    walls.forEach(wall => {
      const a = toScreen(wall.x1, wall.y1);
      const b = toScreen(wall.x2, wall.y2);
      ctx.lineWidth = Math.max(2, Math.min(6, (wall.thickness || 20) * State.zoom));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    const areaText = area == null
      ? t('level.areaUnclosed')
      : t('level.area').replace('{area}', area.toFixed(2));
    const label = t('level.lowerPreview').replace('{level}', lowerLevel.name) + ' · ' + areaText;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
    const halfWidth = metrics.width / 2 + 8;
    const labelX = Math.max(halfWidth, Math.min(rect.width - halfWidth, center.x));
    const labelY = Math.max(18, Math.min(rect.height - 10, center.y));
    ctx.fillStyle = 'rgba(0,113,227,0.9)';
    ctx.beginPath();
    ctx.roundRect(labelX - halfWidth, labelY - 11, metrics.width + 16, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
  }

  function drawSelectionMarquee() {
    const box = State.selectionBox;
    if (!box) return;
    const a = toScreen(box.start.x, box.start.y);
    const b = toScreen(box.end.x, box.end.y);
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(0,113,227,.10)';
    ctx.strokeStyle = '#0071e3';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(left, top, width, height);
    ctx.strokeRect(left, top, width, height);
    ctx.restore();
  }

  function draw() {
    if (!canvas.width) return;
    drawGrid();
    drawLowerLevelPreview();

    ctx.save();
    activeLevelItems(State.walls).forEach(drawWall);
    activeLevelItems(State.windows).forEach(drawWindow);
    activeLevelItems(State.doors).forEach(drawDoor);
    activeLevelItems(State.furnitures).forEach(drawFurniture);
    activeLevelItems(State.stairs).forEach(drawStair);
    activeLevelItems(State.dimensions).forEach(drawDimension);
    drawSnapFeedback();
    drawDimensionPreview();
    drawLiveWallPreview();
    drawRoomPreview();
    drawSelectionMarquee();
    ctx.restore();

    if (window.onDrawComplete) window.onDrawComplete();
  }

  // Continuous render loop for smooth interactions
  function startLoop() {
    function loop() {
      draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  window._draw2d = { draw, resize, toWorld, toScreen, startLoop };
  requestRedraw = draw;
  setTimeout(() => {
    resize();
    startLoop();
  }, 0);
})();

function requestRedraw() {}
