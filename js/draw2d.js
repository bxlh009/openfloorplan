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

  function drawGrid() {
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fafafa';
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
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = State.activeObject === w.id ? '#0071e3' : '#3a3a3c';
    ctx.lineWidth = Math.max(4, w.thickness * State.zoom);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();

    if (State.showDimensions) drawWallDimension(w);

    // Endpoint handles when selected
    if (State.activeObject === w.id) {
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
    const p = toScreen(d.x, d.y);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(p.x, p.y);
    ctx.rotate(d.angle || 0);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#34c759';
    ctx.lineWidth = 2;
    const w = d.width * State.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, Math.PI / 2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawWindow(win) {
    const p = toScreen(win.x, win.y);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(p.x, p.y);
    ctx.rotate(win.angle || 0);
    ctx.fillStyle = '#5ac8fa';
    ctx.strokeStyle = '#007aff';
    ctx.lineWidth = 2;
    const w = win.width * State.zoom;
    ctx.fillRect(-w, -3, w * 2, 6);
    ctx.strokeRect(-w, -3, w * 2, 6);
    ctx.restore();
  }

  function drawFurniture(f) {
    const p = toScreen(f.x, f.y);
    const w = f.w * State.zoom;
    const h = f.d * State.zoom;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(p.x, p.y);
    ctx.rotate(f.rotation || 0);

    ctx.fillStyle = 'rgba(255,159,10,0.15)';
    ctx.strokeStyle = '#ff9f0a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff9f0a';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getFurnitureLabel(f.type), 0, 0);
    ctx.restore();
  }

  function getFurnitureLabel(type) {
    const map = {
      sofa: '沙发', bed: '床', table: '餐桌', wardrobe: '衣柜',
      toilet: '马桶', bathtub: '浴缸', desk: '书桌', plant: '盆栽'
    };
    return map[type] || type;
  }

  function drawDimension(dim) {
    const a = toScreen(dim.x1, dim.y1);
    const b = toScreen(dim.x2, dim.y2);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#ff3b30';
    ctx.fillStyle = '#ff3b30';
    ctx.lineWidth = 1;
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

  function draw() {
    if (!canvas.width) return;
    drawGrid();

    ctx.save();
    State.walls.forEach(drawWall);
    State.windows.forEach(drawWindow);
    State.doors.forEach(drawDoor);
    State.furnitures.forEach(drawFurniture);
    State.dimensions.forEach(drawDimension);
    drawLiveWallPreview();
    drawRoomPreview();
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
