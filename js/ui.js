// UI: toolbar, modes, properties, file ops, controls
(function() {
  const q = String.fromCharCode(34);
  const sq = String.fromCharCode(39);

  function assignProject(data) {
    State.levels = data.levels; State.activeLevelId = data.activeLevelId;
    State.walls = data.walls; State.doors = data.doors; State.windows = data.windows;
    State.rooms = data.rooms; State.furnitures = data.furnitures; State.dimensions = data.dimensions; State.stairs = data.stairs;
    State.style = data.style; State.architectureStyle = data.architectureStyle; State.sunAngle = data.sunAngle;
    State.nextId = ProjectModel.getNextObjectId(data);
    State.activeObject = null; State.activeType = null; State.selectedObjects = []; State.selectionBox = null;
    State.pendingFurniture = null; State.pendingFurnitureRotation = 0;
  }

  function syncLevelsUI() {
    const select = document.getElementById('level-select');
    if (!select) return;
    select.innerHTML = State.levels.map(level => '<option value="' + level.id + '">' + level.name + '</option>').join('');
    select.value = State.activeLevelId;
    const level = State.levels.find(item => item.id === State.activeLevelId) || State.levels[0];
    const summary = document.getElementById('level-summary');
    if (summary && level) summary.textContent = t('level.summary')
      .replace('{elevation}', level.elevation).replace('{height}', level.height).replace('{thickness}', level.floorThickness);
    const lowerLevel = ProjectModel.getPreviousLevel(State.levels, State.activeLevelId);
    const preview = document.getElementById('level-preview-summary');
    if (preview) {
      if (!lowerLevel) {
        preview.hidden = true;
        preview.textContent = '';
      } else {
        const lowerWalls = State.walls.filter(wall => wall.levelId === lowerLevel.id);
        const area = ProjectModel.computeFloorArea(lowerWalls);
        preview.hidden = false;
        preview.textContent = t('level.lowerPreview').replace('{level}', lowerLevel.name) + ' · ' + (area == null ? t('level.areaUnclosed') : t('level.area').replace('{area}', area.toFixed(2)));
      }
    }
    document.querySelectorAll('[data-floor-finish]').forEach(button => button.classList.toggle('active', level && button.dataset.floorFinish === level.floorFinish));
  }
  window.syncLevelsUI = syncLevelsUI;

  document.getElementById('level-select').addEventListener('change', event => {
    State.activeLevelId = event.target.value;
    clearSelection();
    persistLocalDraft(); syncLevelsUI(); requestRedraw();
    if (window._view3d?.focusActiveLevel) window._view3d.focusActiveLevel();
    else rebuild3D();
    if (window.refreshDynamicControls) window.refreshDynamicControls();
    renderProps();
  });
  document.getElementById('btn-level-add').addEventListener('click', () => {
    mutateProject(() => {
      const sourceLevelId = State.activeLevelId;
      const id = ProjectModel.getNextLevelId(State);
      State.levels.push({ ...ProjectModel.DEFAULT_LEVEL, id, name: (State.levels.length + 1) + 'F', elevation: ProjectModel.getNextLevelElevation(State) });
      State.stairs.filter(stair => stair.levelId === sourceLevelId && !stair.toLevelId).forEach(stair => { stair.toLevelId = id; });
      State.activeLevelId = id;
    });
    syncLevelsUI(); requestRedraw(); rebuild3D();
  });
  document.getElementById('btn-level-copy').addEventListener('click', () => {
    const duplicated = ProjectModel.duplicateLevel(State, State.activeLevelId);
    mutateProject(() => assignProject(duplicated));
    syncLevelsUI(); requestRedraw(); rebuild3D();
  });
  document.querySelectorAll('[data-floor-finish]').forEach(button => button.addEventListener('click', () => {
    const level = State.levels.find(item => item.id === State.activeLevelId);
    if (!level || level.floorFinish === button.dataset.floorFinish) return;
    mutateProject(() => { level.floorFinish = button.dataset.floorFinish; });
    syncLevelsUI(); rebuild3D();
  }));
  document.querySelectorAll('[data-flow-target]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-flow-target]').forEach(item => item.classList.toggle('active', item === button));
    document.getElementById('panel-' + button.dataset.flowTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  syncLevelsUI();

  document.getElementById('snap-toggle').addEventListener('change', event => {
    State.snapEnabled = event.target.checked;
    if (!State.snapEnabled) { State.snapGuides = []; State.snapPreview = null; }
    requestRedraw();
  });

  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.selectedTool = btn.dataset.tool;
      State.wallStart = null; State.wallDragging = false; State.wallEnd = null;
      clearSelection();
      State.pendingFurniture = null; State.pendingFurnitureRotation = 0; State.roomStart = null;
      State.snapGuides = []; State.snapPreview = null;
      if (window._tools && window._tools.resetToolState) window._tools.resetToolState();
      updateToolLabel(); renderProps();
    });
  });

  document.getElementById('btn-delete-selection').addEventListener('click', () => deleteSelectedObjects());

  document.querySelectorAll('[data-furniture]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.furniture;
      const spec = FURNITURE_DEFS[type];
      if (!spec) return;
      document.querySelectorAll('[data-furniture]').forEach(button => button.classList.toggle('active', button === btn));
      State.pendingFurniture = type;
      State.pendingFurnitureRotation = 0;
      document.getElementById('status-info').textContent = t('message.placeFurniture') + ' · ' + t(spec.labelKey || ('furniture.' + type));
    });
  });

  const furnitureSearch = document.getElementById('furniture-search');
  document.querySelectorAll('[data-furniture-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      State.furnitureCategory = btn.dataset.furnitureCategory;
      document.querySelectorAll('[data-furniture-category]').forEach(button => {
        const active = button === btn;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      filterFurnitureCatalog();
    });
  });
  if (furnitureSearch) furnitureSearch.addEventListener('input', filterFurnitureCatalog);
  function filterFurnitureCatalog() {
    const buttons = [...document.querySelectorAll('[data-furniture]')];
    const items = buttons.map(button => ({
      type: button.dataset.furniture,
      category: button.dataset.category,
      label: t('furniture.' + button.dataset.furniture),
    }));
    const visibleTypes = new Set(ProjectModel.filterFurnitureCatalog(items, State.furnitureCategory, furnitureSearch?.value).map(item => item.type));
    buttons.forEach(button => { button.hidden = !visibleTypes.has(button.dataset.furniture); });
    const empty = document.getElementById('furniture-empty');
    if (empty) empty.hidden = visibleTypes.size > 0;
  }
  window.filterFurnitureCatalog = filterFurnitureCatalog;
  filterFurnitureCatalog();

  document.querySelectorAll('.style-card[data-architecture]').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.architecture;
      if (!ProjectModel.ARCHITECTURE_PRESETS[style] || style === State.architectureStyle) return;
      mutateProject(() => { State.architectureStyle = style; });
      syncArchitectureUI();
      rebuild3D();
    });
  });
  function syncArchitectureUI() {
    document.querySelectorAll('.style-card[data-architecture]').forEach(btn => {
      const active = btn.dataset.architecture === State.architectureStyle;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.body.dataset.architectureStyle = State.architectureStyle;
  }
  window.syncArchitectureUI = syncArchitectureUI;
  syncArchitectureUI();

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
    const cutaway = window._view3d ? window._view3d.isCutaway() : true;
    const wholeBuilding = window._view3d ? window._view3d.getBuildingViewMode() === 'all' : true;
    bar.innerHTML =
      '<span style="font-weight:600;">' + t('control.sun') + '</span>' +
      '<input type="range" min="10" max="89" value="' + State.sunAngle + '" id="sun-angle" style="width:70px;">' +
      '<span id="sun-val" style="width:28px;text-align:right;">' + State.sunAngle + '°</span>' +
      '<button id="btn-building-view" aria-pressed="' + wholeBuilding + '" style="padding:2px 8px;' + (wholeBuilding ? 'background:#34a853;color:#fff;' : '') + '">' + t(wholeBuilding ? 'control.wholeBuilding' : 'control.activeLevel') + '</button>' +
      '<button id="btn-cutaway" aria-pressed="' + cutaway + '" style="padding:2px 8px;' + (cutaway ? 'background:#0071e3;color:#fff;' : '') + '">' + t(cutaway ? 'control.cutaway' : 'control.exterior') + '</button>' +
      '<button id="btn-walk" style="padding:2px 8px;">' + t('control.walk') + '</button>' +
      '<button id="btn-png" style="padding:2px 8px;">' + t('control.exportPng') + '</button>';
    const slider = document.getElementById('sun-angle');
    slider.oninput = () => {
      State.sunAngle = parseFloat(slider.value);
      document.getElementById('sun-val').textContent = State.sunAngle + '°';
      if (window._view3d) window._view3d.setSunAngle(State.sunAngle);
    };
    slider.onpointerdown = () => { slider._historyBefore = beginHistory(); };
    slider.onchange = () => {
      if (slider._historyBefore != null) commitHistory(slider._historyBefore);
      slider._historyBefore = null;
    };
    document.getElementById('btn-cutaway').onclick = () => {
      if (window._view3d) window._view3d.toggleCutaway();
      setupControls();
    };
    document.getElementById('btn-building-view').onclick = () => {
      if (window._view3d) window._view3d.toggleBuildingViewMode();
      setupControls();
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
    mutateProject(() => {
      State.levels = [{ ...ProjectModel.DEFAULT_LEVEL }]; State.activeLevelId = ProjectModel.DEFAULT_LEVEL.id;
      State.walls = []; State.doors = []; State.windows = []; State.rooms = []; State.furnitures = []; State.dimensions = [];
      State.stairs = [];
      clearSelection(); State.pendingFurniture = null; State.pendingFurnitureRotation = 0; State.roomStart = null;
      State.panX = 0; State.panY = 0; State.zoom = 1;
    });
    syncLevelsUI(); rebuild3D(); renderProps();
    document.getElementById('status-info').textContent = t('status.newProject');
  });
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-load').click());
  document.getElementById('file-load').addEventListener('change', loadProject);

  function saveProject() {
    const data = ProjectModel.serializeProject(State);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'home-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
    URL.revokeObjectURL(url);
    document.getElementById('status-info').textContent = t('status.backupExported');
  }
  function loadProject(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = ProjectModel.normalizeProject(JSON.parse(reader.result));
        mutateProject(() => {
          assignProject(data);
        });
        State.activeObject = null; State.activeType = null;
        syncArchitectureUI(); syncLevelsUI(); renderProps(); requestRedraw();
        rebuild3D(); if (window._view3d) { window._view3d.setSunAngle(State.sunAngle); window._view3d.fitHome(); }
        document.getElementById('status-info').textContent = t('status.loadedProject');
      } catch (err) { alert(t('error.load') + err.message); }
    };
    reader.readAsText(file); e.target.value = '';
  }

  function updateToolLabel() {
    const map = { select: 'tool.select', wall: 'tool.wall', door: 'tool.door', window: 'tool.window', room: 'tool.room', dimension: 'tool.dimension', stair: 'tool.stair' };
    const el = document.getElementById('status-tool');
    if (el) el.textContent = t('status.tool') + ': ' + (map[State.selectedTool] ? t(map[State.selectedTool]) : State.selectedTool);
  }
  window.updateToolLabel = updateToolLabel;

  function syncSelectionUI() {
    const button = document.getElementById('btn-delete-selection');
    if (!button) return;
    const count = Array.isArray(State.selectedObjects) ? State.selectedObjects.length : 0;
    button.disabled = count === 0;
    button.textContent = count ? t('action.deleteSelection') + ' (' + count + ')' : t('action.deleteSelection');
    button.title = count ? t('status.selectionCount').replace('{count}', String(count)) : t('action.deleteSelection');
  }
  window.syncSelectionUI = syncSelectionUI;

  function renderProps() {
    const box = document.getElementById("props");
    syncSelectionUI();
    const selectedCount = Array.isArray(State.selectedObjects) ? State.selectedObjects.length : 0;
    if (selectedCount > 1) {
      box.innerHTML = '<div class="selection-banner"><span>' + t('status.selected') + '</span><strong>' + t('status.selectionCount').replace('{count}', String(selectedCount)) + '</strong><code>' + t('hint.multiSelection') + '</code></div>';
      return;
    }
    if (!State.activeObject) { box.innerHTML = '<p class="hint">' + t('hint.selectObject') + '</p>'; return; }
    let obj = null, type = State.activeType;
    if (type === "wall") obj = State.walls.find(w => w.id === State.activeObject);
    if (type === "furniture") obj = State.furnitures.find(w => w.id === State.activeObject);
    if (type === "door") obj = State.doors.find(w => w.id === State.activeObject);
    if (type === "window") obj = State.windows.find(w => w.id === State.activeObject);
    if (type === "wall-endpoint") obj = State.walls.find(w => w.id === State.activeObject);
    if (type === "stair") obj = State.stairs.find(w => w.id === State.activeObject);
    if (!obj) { box.innerHTML = '<p class="hint">' + t('hint.selectObject') + '</p>'; return; }
    const selectedName = type === 'furniture'
      ? t(FURNITURE_DEFS[obj.type]?.labelKey || ('furniture.' + obj.type))
      : t(type === 'stair' ? 'tool.stair' : ('object.' + (type === 'wall-endpoint' ? 'wall' : type)));
    let html = '<div class="selection-banner"><span>' + t('status.selected') + '</span><strong>' + selectedName + '</strong><code>' + obj.id + '</code></div>';
    if (type === "wall" || type === "wall-endpoint") {
      const length = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
      const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180 / Math.PI;
      html += propNum("prop.length", length.toFixed(0), 10, 2000, null, 1);
      html += propNum("prop.angle", angle.toFixed(1), -180, 180);
      html += propNum("prop.thickness", obj.thickness, 5, 50, null, 1);
      html += propNum("prop.height", obj.height, 100, 400, null, 5);
      html += colorPicker("prop.color", obj.color || getStylePreset().wall);
    } else if (type === "furniture") {
      html += `<div class="prop-row"><span data-prop-key="prop.type">${t('prop.type')}</span><span>${t(FURNITURE_DEFS[obj.type]?.labelKey || ('furniture.' + obj.type))}</span></div>`;
      html += propNum("prop.width", obj.w.toFixed(0), 10, 500, null, 1);
      html += propNum("prop.depth", (obj.d || obj.h).toFixed(0), 10, 500, null, 1);
      html += propNum("prop.height", (obj.h || 50).toFixed(0), 5, 400, null, 1);
      html += propNum("prop.rotation", ((obj.rotation || 0) * 180 / Math.PI).toFixed(0), 0, 360);
      html += colorPicker("prop.color", obj.color || getStylePreset().wood);
    } else if (type === "door") {
      html += propNum("prop.width", obj.width.toFixed(0), 50, 200, null, 5);
      html += propNum("prop.height", (obj.height || 210).toFixed(0), 160, 280, null, 5);
      html += propNum("prop.openAngle", (obj.openAngle || 75).toFixed(0), 0, 110, null, 5);
      const wall = State.walls.find(item => item.id === obj.wallId);
      if (wall) html += propNum("prop.position", ProjectModel.getOpeningOffset(obj, wall).toFixed(0), obj.width / 2, Math.max(obj.width / 2, Math.hypot(wall.x2-wall.x1, wall.y2-wall.y1)-obj.width/2), null, 5);
    } else if (type === "window") {
      html += propNum("prop.width", obj.width.toFixed(0), 50, 300, null, 5);
      html += propNum("prop.height", (obj.height || 120).toFixed(0), 40, 240, null, 5);
      html += propNum("prop.sillHeight", (obj.sillHeight || 90).toFixed(0), 0, 220, null, 5);
      const wall = State.walls.find(item => item.id === obj.wallId);
      if (wall) html += propNum("prop.position", ProjectModel.getOpeningOffset(obj, wall).toFixed(0), obj.width / 2, Math.max(obj.width / 2, Math.hypot(wall.x2-wall.x1, wall.y2-wall.y1)-obj.width/2), null, 5);
    } else if (type === 'stair') {
      html += propNum('prop.width', obj.width, 60, 300, null, 5);
      html += propNum('prop.length', obj.length, 120, 800, null, 10);
      html += propNum('prop.steps', obj.stepCount, 2, 40, null, 1);
      html += propNum('prop.rotation', ((obj.rotation || 0) * 180 / Math.PI).toFixed(0), 0, 360);
      const level = State.levels.find(item => item.id === obj.levelId);
      const maxRise = ProjectModel.getStairRiseLimit(State.walls, obj.levelId, level?.height || 280);
      html += '<div class="prop-row"><span data-prop-key="prop.maxRise">' + t('prop.maxRise') + '</span><span>' + maxRise.toFixed(0) + ' cm</span></div>';
    }
    html += '<button id="btn-del" style="margin-top:8px;padding:4px 8px;background:#ff3b30;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;width:100%;">' + t('action.delete') + '</button>';
    box.innerHTML = html;
    document.getElementById("btn-del").addEventListener("click", () => {
      deleteSelectedObjects();
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
    inputs.forEach(inp => {
      const label = inp.parentElement?.querySelector("span")?.dataset.propKey || "";
      inp.addEventListener("input", () => {
        let v = parseFloat(inp.value);
        if (inp.type === "color") v = inp.value;
        if (isNaN(v) && inp.type !== "color") return;
        mutateProject(() => {
          const wall = State.walls.find(item => item.id === State.activeObject);
          const furniture = State.furnitures.find(item => item.id === State.activeObject);
          const door = State.doors.find(item => item.id === State.activeObject);
          const win = State.windows.find(item => item.id === State.activeObject);
          const stair = State.stairs.find(item => item.id === State.activeObject);
          if (label === "prop.length" && wall) { const a = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1); wall.x2 = wall.x1 + Math.cos(a) * v; wall.y2 = wall.y1 + Math.sin(a) * v; }
          if (label === "prop.angle" && wall) { const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1); const a = v * Math.PI / 180; wall.x2 = wall.x1 + Math.cos(a) * len; wall.y2 = wall.y1 + Math.sin(a) * len; }
          if (label === "prop.thickness" && wall) wall.thickness = v;
          if (label === "prop.height") { if (furniture) furniture.h = v; else if (wall) wall.height = v; }
          if (label === "prop.height") { if (door) door.height = v; if (win) win.height = v; }
          if (label === "prop.width") { if (furniture) furniture.w = v; if (door) door.width = v; if (win) win.width = v; }
          if (label === "prop.depth" && furniture) furniture.d = v;
          if (label === "prop.rotation" && furniture) furniture.rotation = v * Math.PI / 180;
          if (label === 'prop.width' && stair) stair.width = v;
          if (label === 'prop.length' && stair) stair.length = v;
          if (label === 'prop.steps' && stair) stair.stepCount = Math.round(v);
          if (label === 'prop.rotation' && stair) stair.rotation = v * Math.PI / 180;
          if (label === "prop.openAngle" && door) door.openAngle = v;
          if (label === "prop.sillHeight" && win) win.sillHeight = v;
          if (label === "prop.position" && (door || win)) {
            const opening = door || win;
            const openingWall = State.walls.find(item => item.id === opening.wallId);
            if (openingWall) Object.assign(opening, ProjectModel.placeOpeningOnWall(opening, openingWall, v));
          }
          if (label === "prop.width" && (door || win)) {
            const opening = door || win;
            const openingWall = State.walls.find(item => item.id === opening.wallId);
            if (openingWall) Object.assign(opening, ProjectModel.placeOpeningOnWall(opening, openingWall, ProjectModel.getOpeningOffset(opening, openingWall)));
          }
          if (label === "prop.color" && (wall || furniture)) (wall || furniture).color = v;
        });
        requestRedraw();
        rebuild3D();
      });
    });
  }
  window.renderProps = renderProps;
})();

const FURNITURE_DEFS = Object.fromEntries(
  Object.entries(ProjectModel.FURNITURE_DEFAULTS).map(([type, spec]) => [type, { ...spec, labelKey: 'furniture.' + type }]),
);
