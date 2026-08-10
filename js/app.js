// App bootstrap
(function() {
  function rebuild3D() {
    if (window._view3d) window._view3d.buildFromState();
  }
  window.rebuild3D = rebuild3D;

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelection(); return; }
    switch (e.key.toLowerCase()) {
      case 'v': document.querySelector('[data-tool="select"]').click(); break;
      case 'w': document.querySelector('[data-tool="wall"]').click(); break;
      case 'd': document.querySelector('[data-tool="door"]').click(); break;
      case 'f': document.querySelector('[data-tool="window"]').click(); break;
      case 'm': document.querySelector('[data-tool="dimension"]').click(); break;
      case 'r': document.querySelector('[data-tool="room"]').click(); break;
      case 'delete':
        if (State.activeObject) {
          let arr = null;
          if (State.activeType === 'wall') arr = State.walls;
          if (State.activeType === 'wall-endpoint') arr = State.walls;
          if (State.activeType === 'door') arr = State.doors;
          if (State.activeType === 'window') arr = State.windows;
          if (State.activeType === 'furniture') arr = State.furnitures;
          if (State.activeType === 'dimension') arr = State.dimensions;
          if (State.activeType === 'stair') arr = State.stairs;
          if (arr) {
            mutateProject(() => {
              const idx = arr.findIndex(o => o.id === State.activeObject);
              if (idx >= 0) arr.splice(idx, 1);
            });
            State.activeObject = null;
            State.activeType = null;
            rebuild3D();
            renderProps();
          }
        }
        break;
      case 'escape':
        State.wallStart = null;
        State.pendingFurniture = null;
        State.snapGuides = [];
        State.snapPreview = null;
        State.roomStart = null;
        if (window._tools && window._tools.resetToolState) window._tools.resetToolState();
        State.activeObject = null;
        State.activeType = null;
        State.selectedTool = 'select';
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tool="select"]').click();
        break;
      case '1': document.querySelector('[data-mode="2d"]').click(); break;
      case '2': document.querySelector('[data-mode="3d"]').click(); break;
      case '3': document.querySelector('[data-mode="split"]').click(); break;
    }
  });

  // Initial state
  const restoredDraft = restoreLocalDraft();
  if (restoredDraft) {
    if (window.syncStyleUI) window.syncStyleUI();
    if (window.syncArchitectureUI) window.syncArchitectureUI();
    if (window.renderProps) window.renderProps();
    requestRedraw();
  }
  rebuild3D();
  document.getElementById('status-info').textContent = t(restoredDraft ? 'status.restored' : 'status.shortcuts');
})();

function updateToolLabel() {
  const map = {
    select: 'tool.select', wall: 'tool.wall', door: 'tool.door',
    window: 'tool.window', room: 'tool.room', dimension: 'tool.dimension', stair: 'tool.stair'
  };
  const el = document.getElementById('status-tool');
  if (el) el.textContent = t('status.tool') + ': ' + (map[State.selectedTool] ? t(map[State.selectedTool]) : State.selectedTool);
}
