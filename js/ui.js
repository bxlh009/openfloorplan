// UI: toolbar, modes, properties, file ops, controls
(function() {
  const q = String.fromCharCode(34);
  const sq = String.fromCharCode(39);

  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.selectedTool = btn.dataset.tool;
      State.wallStart = null; State.wallDragging = false; State.wallEnd = null;
      State.activeObject = null; State.activeType = null;
      State.pendingFurniture = null; State.roomStart = null;
      if (window._tools && window._tools.resetToolState) window._tools.resetToolState();
      updateToolLabel(); renderProps();
    });
  });

  document.querySelectorAll('[data-furniture]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.furniture;
      const spec = FURNITURE_DEFS[type];
      if (!spec) return;
      State.pendingFurniture = type;
      document.getElementById('status-info').textContent = t('message.place') + t(spec.labelKey || ('furniture.' + type));
    });
  });

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // Sun + Walk + PNG controls
  const ctrlBar = document.getElementById(' ctrl-bar') || document.querySelector('.actions');
  function setupControls() {
    let bar = document.getElementById('view3d-controls');
    if (!bar) {
      bar = Object.assign(document.createElement('div'), { id: 'view3d-controls' });
      bar.style.cssText = 'position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:10;background:rgba(255,255,255,0.85);padding:6px 8px;border-radius:6px;font-size:11px;align-items:center;flex-wrap:wrap;max-width:260px;';
      const view3d = document.getElementById('view-3d');
      if (view3d) { view3d.style.position = 'relative'; view3d.appendChild(bar); }
    }
    bar.innerHTML =
      '<span style="font-weight:600;">' + t('control.sun') + '</span>' +
      '<input type="range" min="10" max="89" value="' + State.sunAngle + '" id="sun-angle" style="width:70px;">' +
      '<span id="sun-val" style="width:28px;text-align:right;">' + State.sunAngle + '°</span>' +
      '<button id="btn-walk" style="padding:2px 8px;">' + t('control.walk') + '</button>' +
      '<button id="btn-png" style="padding:2px 8px;">' + t('control.exportPng') + '</button>';
    const slider = document.getElementById('sun-angle');
    slider.oninput = () => {
      State.sunAngle = parseFloat(slider.value);
      document.getElementById('sun-val').textContent = State.sunAngle + '°';
      if (window._view3d) window._view3d.setSunAngle(State.sunAngle);
    };
    document.getElementById('btn-walk').onclick = (e) => {
      if (window._view3d && window._view3d.isWalkMode()) { window._view3d.exitWalkMode(); e.target.style.background = ''; }
      else if (window._view3d) { window._view3d.enterWalkMode(); e.target.style.background = '#34c759'; }
    };
    document.getElementById('btn-png').onclick = () => {
      if (window._view3d) {
        const url = window._view3d.exportPNG();
        const a = document.createElement('a'); a.href = url; a.download = 'plan-' + new Date().toISOString().slice(0,10) + '.png'; a.click();
      }
    };
  }
  window.refreshDynamicControls = setupControls;
  setTimeout(setupControls, 500);

  document.getElementById('btn-lang').addEventListener('click', () => {
    setLanguage(getLanguage() === 'zh' ? 'en' : 'zh');
  });

  function switchMode(mode) {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="' + mode + '"]').classList.add('active');
    State.mode = mode;
    const view2d = document.getElementById('view-2d');
    const view3d = document.getElementById('view-3d');
    const views = document.querySelector('.views');
    const divider = document.getElementById('split-divider');
    view2d.classList.remove('split-2d', 'split-3d', 'hidden');
    view3d.classList.remove('split-2d', 'split-3d', 'hidden');
    views.classList.remove('with-split');
    divider.style.display = 'none';
    if (mode === '2d') { view3d.classList.add('hidden'); view2d.style.flex = '1 1 100%'; }
    else if (mode === '3d') {
      view2d.classList.add('hidden'); view3d.style.flex = '1 1 100%';
      if (window._view3d) { _view3d.onResize(); setTimeout(setupControls, 100); }
    } else {
      view2d.classList.add('split-2d'); view3d.classList.add('split-3d'); views.classList.add('with-split'); divider.style.display = 'block';
      view2d.style.flex = '1 1 50%'; view3d.style.flex = '1 1 50%';
      if (window._view3d) { _view3d.onResize(); setTimeout(setupControls, 100); }
    }
    rebuild3D();
  }
  window.switchMode = switchMode;

  // Draggable split divider
  (function() {
    const divider = document.getElementById('split-divider');
    const view2d = document.getElementById('view-2d');
    divider.addEventListener('pointerdown', e => {
      e.preventDefault(); divider.classList.add('dragging');
      dragStartX = e.clientX; startFlex2d = view2d.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    });
    let dragStartX = 0, startFlex2d = 50;
    window.addEventListener('pointermove', e => {
      if (!divider.classList.contains('dragging')) return;
      const viewsRect = document.querySelector('.views').getBoundingClientRect();
      const delta = e.clientX - dragStartX;
      const pct = ((startFlex2d + delta) / viewsRect.width) * 100;
      const clamped = Math.max(15, Math.min(85, pct));
      document.getElementById('view-2d').style.flex = '0 0 ' + clamped + '%';
      document.getElementById('view-3d').style.flex = '0 0 ' + (100 - clamped) + '%';
      if (window._view3d) _view3d.onResize();
      if (window._draw2d) _draw2d.draw();
    });
    window.addEventListener('pointerup', () => {
      if (divider.classList.contains('dragging')) { divider.classList.remove('dragging'); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    });
  })();

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!confirm(t('prompt.new'))) return;
    _pushHistory();
    State.walls = []; State.doors = []; State.windows = []; State.rooms = []; State.furnitures = []; State.dimensions = [];
    State.activeObject = null; State.activeType = null; State.pendingFurniture = null; State.roomStart = null;
    State.panX = 0; State.panY = 0; State.zoom = 1;
    rebuild3D(); renderProps();
  });
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-load').click());
  document.getElementById('file-load').addEventListener('change', loadProject);

  function saveProject() {
    const data = { version: 1, walls: State.walls, doors: State.doors, windows: State.windows, furnitures: State.furnitures, dimensions: State.dimensions, sunAngle: State.sunAngle };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'home-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function loadProject(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        _pushHistory();
        State.walls = data.walls || []; State.doors = data.doors || []; State.windows = data.windows || [];
        State.furnitures = data.furnitures || []; State.dimensions = data.dimensions || [];
        State.sunAngle = data.sunAngle || 60;
        State.nextId = Math.max(...State.walls.map(w => parseInt(w.id.split('_')[1])), ...State.doors.map(w => parseInt(w.id.split('_')[1])), ...State.windows.map(w => parseInt(w.id.split('_')[1])), ...State.furnitures.map(w => parseInt(w.id.split('_')[1])), 0) + 1;
        if (!isFinite(State.nextId) || State.nextId < 1) State.nextId = 1;
        rebuild3D(); if (window._view3d) window._view3d.setSunAngle(State.sunAngle);
      } catch (err) { alert(t('error.load') + err.message); }
    };
    reader.readAsText(file); e.target.value = '';
  }

  function updateToolLabel() {
    const map = { select: 'tool.select', wall: 'tool.wall', door: 'tool.door', window: 'tool.window', room: 'tool.room', dimension: 'tool.dimension' };
    const el = document.getElementById('status-tool');
    if (el) el.textContent = t('status.tool') + ': ' + (map[State.selectedTool] ? t(map[State.selectedTool]) : State.selectedTool);
  }

  function renderProps() {
    const box = document.getElementById("props");
    if (!State.activeObject) { box.innerHTML = '<p class="hint">' + t('hint.selectObject') + '</p>'; return; }
    let obj = null, type = State.activeType;
    if (type === "wall") obj = State.walls.find(w => w.id === State.activeObject);
    if (type === "furniture") obj = State.furnitures.find(w => w.id === State.activeObject);
    if (type === "door") obj = State.doors.find(w => w.id === State.activeObject);
    if (type === "window") obj = State.windows.find(w => w.id === State.activeObject);
    if (type === "wall-endpoint") obj = State.walls.find(w => w.id === State.activeObject);
    if (!obj) { box.innerHTML = '<p class="hint">' + t('hint.selectObject') + '</p>'; return; }
    let html = "";
    if (type === "wall" || type === "wall-endpoint") {
      const length = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
      const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180 / Math.PI;
      html += propNum("prop.length", length.toFixed(0), 10, 2000, v => { const a = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1); obj.x2 = obj.x1 + Math.cos(a) * v; obj.y2 = obj.y1 + Math.sin(a) * v; _pushHistory(); rebuild3D(); }, 1);
      html += propNum("prop.angle", angle.toFixed(1), -180, 180, v => { const len = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1); const a = v * Math.PI / 180; obj.x2 = obj.x1 + Math.cos(a) * len; obj.y2 = obj.y1 + Math.sin(a) * len; _pushHistory(); rebuild3D(); });
      html += propNum("prop.thickness", obj.thickness, 5, 50, v => { obj.thickness = v; _pushHistory(); rebuild3D(); }, 1);
      html += propNum("prop.height", obj.height, 100, 400, v => { obj.height = v; _pushHistory(); rebuild3D(); }, 5);
      html += colorPicker("prop.color", obj.color || "#f5f0e8", v => { obj.color = v; _pushHistory(); rebuild3D(); });
    } else if (type === "furniture") {
      html += `<div class="prop-row"><span data-prop-key="prop.type">${t('prop.type')}</span><span>${t(FURNITURE_DEFS[obj.type]?.labelKey || ('furniture.' + obj.type))}</span></div>`;
      html += propNum("prop.width", obj.w.toFixed(0), 10, 500, v => { obj.w = v; _pushHistory(); rebuild3D(); }, 1);
      html += propNum("prop.depth", (obj.d || obj.h).toFixed(0), 10, 500, v => { obj.d = v; _pushHistory(); rebuild3D(); }, 1);
      html += propNum("prop.height", (obj.h || 50).toFixed(0), 5, 400, v => { obj.h = v; _pushHistory(); rebuild3D(); }, 1);
      html += propNum("prop.rotation", ((obj.rotation || 0) * 180 / Math.PI).toFixed(0), 0, 360, v => { obj.rotation = v * Math.PI / 180; _pushHistory(); rebuild3D(); });
      html += colorPicker("prop.color", obj.color || "#8b6f47", v => { obj.color = v; _pushHistory(); rebuild3D(); });
    } else if (type === "door") {
      html += propNum("prop.width", obj.width.toFixed(0), 50, 200, v => { obj.width = v; _pushHistory(); rebuild3D(); }, 5);
      html += propNum("X", obj.x.toFixed(0), -10000, 10000, v => { obj.x = v; _pushHistory(); rebuild3D(); }, 5);
      html += propNum("Y", obj.y.toFixed(0), -10000, 10000, v => { obj.y = v; _pushHistory(); rebuild3D(); }, 5);
    } else if (type === "window") {
      html += propNum("prop.width", obj.width.toFixed(0), 50, 300, v => { obj.width = v; _pushHistory(); rebuild3D(); }, 5);
      html += propNum("X", obj.x.toFixed(0), -10000, 10000, v => { obj.x = v; _pushHistory(); rebuild3D(); }, 5);
      html += propNum("Y", obj.y.toFixed(0), -10000, 10000, v => { obj.y = v; _pushHistory(); rebuild3D(); }, 5);
    }
    html += '<button id="btn-del" style="margin-top:8px;padding:4px 8px;background:#ff3b30;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;width:100%;">' + t('action.delete') + '</button>';
    box.innerHTML = html;
    document.getElementById("btn-del").addEventListener("click", () => {
      _pushHistory();
      const arr = (type === "wall" || type === "wall-endpoint") ? State.walls : type === "door" ? State.doors : type === "window" ? State.windows : State.furnitures;
      const idx = arr.findIndex(o => o.id === State.activeObject);
      if (idx >= 0) arr.splice(idx, 1);
      State.activeObject = null; State.activeType = null; rebuild3D(); renderProps();
    });
    bindPropInputs();
  }

  function propNum(labelKey, value, min, max, onInput, step) {
    const s = step != null ? step : 1;
    return `<div class="prop-row"><span data-prop-key="${labelKey}">${t(labelKey)}</span><input type="number" value="${value}" min="${min}" max="${max}" step="${s}"></div>`;
  }
  function colorPicker(labelKey, value, onInput) {
    return `<div class="prop-row"><span data-prop-key="${labelKey}">${t(labelKey)}</span><input type="color" value="${value}" style="width:40px;height:22px;padding:0;border:1px solid #ccc;border-radius:3px;"></div>`;
  }
  function bindPropInputs() {
    const box = document.getElementById("props");
    const inputs = box.querySelectorAll("input");
    inputs.forEach((inp, idx) => {
      const label = inp.parentElement?.querySelector("span")?.dataset.propKey || "";
      inp.addEventListener("input", () => {
        let v = parseFloat(inp.value);
        if (inp.type === "color") v = inp.value;
        if (isNaN(v) && inp.type !== "color") return;
        if (label === "prop.length") { const o = State.walls.find(w => w.id === State.activeObject); if (o) { const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1); o.x2 = o.x1 + Math.cos(a) * v; o.y2 = o.y1 + Math.sin(a) * v; _pushHistory(); rebuild3D(); } }
        if (label === "prop.angle") { const o = State.walls.find(w => w.id === State.activeObject); if (o) { const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1); const a = v * Math.PI / 180; o.x2 = o.x1 + Math.cos(a) * len; o.y2 = o.y1 + Math.sin(a) * len; _pushHistory(); rebuild3D(); } }
        if (label === "prop.thickness") { const o = State.walls.find(w => w.id === State.activeObject); if (o) { o.thickness = v; _pushHistory(); rebuild3D(); } }
        if (label === "prop.height") { const o = State.walls.find(w => w.id === State.activeObject); if (o) { o.height = v; _pushHistory(); rebuild3D(); } }
        if (label === "prop.width") { const f = State.furnitures.find(w => w.id === State.activeObject); const d = State.doors.find(w => w.id === State.activeObject); const wi = State.windows.find(w => w.id === State.activeObject); if (f) f.w = v; if (d) d.width = v; if (wi) wi.width = v; _pushHistory(); rebuild3D(); }
        if (label === "prop.depth") { const f = State.furnitures.find(w => w.id === State.activeObject); if (f) f.d = v; _pushHistory(); rebuild3D(); }
        if (label === "prop.rotation") { const f = State.furnitures.find(w => w.id === State.activeObject); if (f) f.rotation = v * Math.PI / 180; _pushHistory(); rebuild3D(); }
        if (label === "X") { const d = State.doors.find(w => w.id === State.activeObject); const wi = State.windows.find(w => w.id === State.activeObject); if (d) d.x = v; if (wi) wi.x = v; _pushHistory(); rebuild3D(); }
        if (label === "Y") { const d = State.doors.find(w => w.id === State.activeObject); const wi = State.windows.find(w => w.id === State.activeObject); if (d) d.y = v; if (wi) wi.y = v; _pushHistory(); rebuild3D(); }
        if (label === "prop.color") { const o = State.walls.find(w => w.id === State.activeObject) || State.furnitures.find(w => w.id === State.activeObject); if (o) { o.color = v; _pushHistory(); rebuild3D(); } }
      });
    });
  }
  window.renderProps = renderProps;window.renderProps = renderProps;
})();

const FURNITURE_DEFS = {
  sofa: { w: 180, d: 85, h: 80, labelKey: 'furniture.sofa' },
  bed: { w: 160, d: 200, h: 50, labelKey: 'furniture.bed' },
  table: { w: 120, d: 80, h: 75, labelKey: 'furniture.table' },
  wardrobe: { w: 180, d: 60, h: 200, labelKey: 'furniture.wardrobe' },
  desk: { w: 120, d: 60, h: 75, labelKey: 'furniture.desk' },
  plant: { w: 30, d: 30, h: 100, labelKey: 'furniture.plant' },
  toilet: { w: 40, d: 60, h: 40, labelKey: 'furniture.toilet' },
  bathtub: { w: 170, d: 70, h: 55, labelKey: 'furniture.bathtub' },
  cabinet: { w: 80, d: 50, h: 90, labelKey: 'furniture.cabinet' },
  fridge: { w: 70, d: 70, h: 180, labelKey: 'furniture.fridge' },
  tv: { w: 120, d: 8, h: 70, labelKey: 'furniture.tv' },
  lamp: { w: 25, d: 25, h: 150, labelKey: 'furniture.lamp' },
  stove: { w: 60, d: 60, h: 85, labelKey: 'furniture.stove' },
  sink: { w: 60, d: 50, h: 85, labelKey: 'furniture.sink' },
  washer: { w: 60, d: 60, h: 85, labelKey: 'furniture.washer' },
};
