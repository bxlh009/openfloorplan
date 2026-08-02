// Lightweight bilingual UI dictionary. Project JSON files remain language-neutral.
(function () {
  const dict = {
    zh: {
      'app.title': '户型设计师', 'app.brand': '户型设计师', 'lang.switch': 'EN',
      'mode.2d': '2D 平面', 'mode.3d': '3D 预览', 'mode.split': '分屏',
      'action.new': '新建', 'action.save': '保存', 'action.load': '载入', 'action.exportSvg': '导出 SVG',
      'section.drawing': '绘图', 'section.furniture': '家具', 'section.properties': '属性',
      'tool.select': '选择', 'tool.wall': '墙体', 'tool.door': '门', 'tool.window': '窗', 'tool.room': '房间', 'tool.dimension': '标注',
      'hint.selectObject': '选择对象查看属性', 'status.tool': '工具', 'status.zoom': '缩放', 'status.position': '位置',
      'status.shortcuts': 'V选择 W墙 D门 F窗 M标注 R房间 | Ctrl+Z撤销 Ctrl+Y重做 Ctrl+C复制 Ctrl+V粘贴 | Del删除',
      'furniture.sofa': '沙发', 'furniture.bed': '床', 'furniture.table': '餐桌', 'furniture.wardrobe': '衣柜',
      'furniture.desk': '书桌', 'furniture.cabinet': '橱柜', 'furniture.plant': '盆栽', 'furniture.lamp': '落地灯',
      'furniture.toilet': '马桶', 'furniture.bathtub': '浴缸', 'furniture.sink': '水槽', 'furniture.stove': '灶台',
      'furniture.fridge': '冰箱', 'furniture.washer': '洗衣机', 'furniture.tv': '电视',
      'control.sun': '阳光', 'control.walk': '漫游', 'control.walkExit': '退出漫游', 'control.exportPng': '导出 PNG',
      'prop.type': '类型', 'prop.length': '长度(cm)', 'prop.angle': '角度(°)', 'prop.thickness': '厚度(cm)',
      'prop.height': '高度(cm)', 'prop.width': '宽度(cm)', 'prop.depth': '深度(cm)', 'prop.rotation': '旋转(°)',
      'prop.color': '颜色', 'action.delete': '删除',
      'prompt.new': '确定清空当前所有内容？', 'error.load': '载入失败: ',
      'message.place': '点击画布放置', 'message.placeFurniture': '点击画布放置家具', 'message.placeRoomEnd': '点击第二角完成房间',
      'message.overlap': '该位置与其他对象重叠', 'message.roomCross': '房间与现有墙体交叉', 'message.wallCross': '墙体与现有墙体交叉',
      'message.length': '长度', 'message.angle': '角度'
    },
    en: {
      'app.title': 'OpenFloorPlan', 'app.brand': 'OpenFloorPlan', 'lang.switch': '中文',
      'mode.2d': '2D Plan', 'mode.3d': '3D Preview', 'mode.split': 'Split View',
      'action.new': 'New', 'action.save': 'Save', 'action.load': 'Load', 'action.exportSvg': 'Export SVG',
      'section.drawing': 'Drawing', 'section.furniture': 'Furniture', 'section.properties': 'Properties',
      'tool.select': 'Select', 'tool.wall': 'Wall', 'tool.door': 'Door', 'tool.window': 'Window', 'tool.room': 'Room', 'tool.dimension': 'Dimension',
      'hint.selectObject': 'Select an object to view properties', 'status.tool': 'Tool', 'status.zoom': 'Zoom', 'status.position': 'Position',
      'status.shortcuts': 'V Select W Wall D Door F Window M Dimension R Room | Ctrl+Z Undo Ctrl+Y Redo Ctrl+C Copy Ctrl+V Paste | Del Delete',
      'furniture.sofa': 'Sofa', 'furniture.bed': 'Bed', 'furniture.table': 'Dining table', 'furniture.wardrobe': 'Wardrobe',
      'furniture.desk': 'Desk', 'furniture.cabinet': 'Cabinet', 'furniture.plant': 'Plant', 'furniture.lamp': 'Floor lamp',
      'furniture.toilet': 'Toilet', 'furniture.bathtub': 'Bathtub', 'furniture.sink': 'Sink', 'furniture.stove': 'Stove',
      'furniture.fridge': 'Fridge', 'furniture.washer': 'Washer', 'furniture.tv': 'TV',
      'control.sun': 'Sun', 'control.walk': 'Walk', 'control.walkExit': 'Exit walk', 'control.exportPng': 'Export PNG',
      'prop.type': 'Type', 'prop.length': 'Length (cm)', 'prop.angle': 'Angle (°)', 'prop.thickness': 'Thickness (cm)',
      'prop.height': 'Height (cm)', 'prop.width': 'Width (cm)', 'prop.depth': 'Depth (cm)', 'prop.rotation': 'Rotation (°)',
      'prop.color': 'Color', 'action.delete': 'Delete',
      'prompt.new': 'Clear the current project?', 'error.load': 'Load failed: ',
      'message.place': 'Click the canvas to place ', 'message.placeFurniture': 'Click the canvas to place furniture', 'message.placeRoomEnd': 'Click the second corner to finish the room',
      'message.overlap': 'This position overlaps another object', 'message.roomCross': 'Room crosses an existing wall', 'message.wallCross': 'Wall crosses an existing wall',
      'message.length': 'Length', 'message.angle': 'Angle'
    }
  };
  let lang = 'zh';
  try { lang = localStorage.getItem('openfloorplan-language') || 'zh'; } catch (_) { /* storage unavailable */ }
  function t(key) { return (dict[lang] && dict[lang][key]) || dict.zh[key] || key; }
  function applyLanguage() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('app.title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    const button = document.getElementById('btn-lang');
    if (button) { button.textContent = t('lang.switch'); button.title = lang === 'zh' ? 'Switch to English' : '切换到中文'; }
    if (window.updateToolLabel) window.updateToolLabel();
    if (window.renderProps) window.renderProps();
    if (window.refreshDynamicControls) window.refreshDynamicControls();
    if (window._draw2d && window._draw2d.draw) window._draw2d.draw();
  }
  window.t = t;
  window.getLanguage = () => lang;
  window.setLanguage = next => {
    lang = next === 'en' ? 'en' : 'zh';
    try { localStorage.setItem('openfloorplan-language', lang); } catch (_) { /* storage unavailable */ }
    applyLanguage();
  };
  window.applyLanguage = applyLanguage;
  document.addEventListener('DOMContentLoaded', applyLanguage);
})();
