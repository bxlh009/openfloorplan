// Lightweight bilingual UI dictionary. Project JSON files remain language-neutral.
(function () {
  const dict = {
    zh: {
      'app.title': '户型设计师', 'app.brand': '户型设计师', 'lang.switch': 'EN',
      'mode.2d': '2D 平面', 'mode.3d': '3D 预览', 'mode.split': '分屏',
      'action.new': '新建', 'action.save': '导出备份', 'action.load': '载入', 'action.exportSvg': '导出 SVG',
      'section.project': '项目定位', 'section.levels': '楼层', 'section.materials': '地板材质',
      'section.drawing': '绘图', 'section.styles': '室内风格', 'section.architecture': '建筑构件风格', 'section.furniture': '家具', 'section.properties': '属性',
      'flow.project': '1 项目', 'flow.levels': '2 楼层', 'flow.structure': '3 结构', 'flow.openings': '4 通行采光', 'flow.rooms': '5 房间', 'flow.materials': '6 材质', 'flow.decorate': '7 现代装修', 'flow.output': '8 检查输出',
      'safety.concept': '用于空间与装修概念设计；结构、消防、报批与施工请按当地规范交由专业人员复核。',
      'level.add': '新增空白楼层', 'level.copy': '复制当前楼层', 'level.summary': '标高 {elevation} cm · 层高 {height} cm · 楼板 {thickness} cm', 'level.lowerPreview': '下层 {level} 预览', 'level.area': '面积 {area}㎡', 'level.areaUnclosed': '面积未闭合',
      'floor.wood': '木地板', 'floor.tile': '瓷砖', 'floor.concrete': '微水泥',
      'style.modern': '现代', 'style.nordic': '北欧', 'style.japanese': '日式', 'style.wabiSabi': '侘寂', 'style.industrial': '工业', 'style.american': '美式',
      'tool.select': '选择', 'tool.wall': '墙体', 'tool.door': '门', 'tool.window': '窗', 'tool.room': '房间', 'tool.dimension': '标注', 'tool.stair': '楼梯',
      'snap.auto': '自动吸附墙边、物件和网格',
      'hint.selectObject': '选择对象查看属性', 'hint.multiSelection': '可按 Delete 键或点击上方按钮删除', 'status.tool': '工具', 'status.zoom': '缩放', 'status.position': '位置',
      'status.restored': '已恢复上次在此浏览器中的设计；后续修改会自动保存在本地',
      'status.autosave': '本地自动保存', 'status.autosaveSaved': '已保存到本地', 'status.autosaveUnavailable': '本地保存不可用，请导出备份', 'status.newProject': '已新建空白项目并更新本地草稿', 'status.loadedProject': '已载入项目并更新本地草稿', 'status.backupExported': 'JSON 备份已导出；清除浏览器数据前请保留此文件',
      'status.shortcuts': 'V选择 W墙 D门 F窗 M标注 R房间 | Ctrl+Z撤销 Ctrl+Y重做 Ctrl+C复制 Ctrl+V粘贴 | Del删除',
      'furniture.sofa': '沙发', 'furniture.bed': '床', 'furniture.table': '餐桌', 'furniture.wardrobe': '衣柜',
      'furniture.desk': '书桌', 'furniture.cabinet': '橱柜', 'furniture.plant': '盆栽', 'furniture.lamp': '落地灯',
      'furniture.toilet': '马桶', 'furniture.bathtub': '浴缸', 'furniture.sink': '水槽', 'furniture.stove': '灶台',
      'furniture.fridge': '冰箱', 'furniture.washer': '洗衣机', 'furniture.tv': '电视',
      'furniture.search': '搜索家具', 'furniture.empty': '没有匹配的家具',
      'category.all': '全部', 'category.living': '客餐厅', 'category.bedroom': '卧室', 'category.work': '办公', 'category.kitchen': '厨房', 'category.bath': '卫浴', 'category.decor': '装饰',
      'control.sun': '阳光', 'control.wholeBuilding': '整栋楼', 'control.activeLevel': '当前层', 'control.cutaway': '剖切视图', 'control.exterior': '完整外观', 'control.walk': '漫游', 'control.walkExit': '退出漫游', 'control.exportPng': '导出 PNG',
      'status.selected': '已选择', 'status.selectionCount': '已选择 {count} 个对象', 'message.dimensionStart': '单击设置标注起点', 'message.dimensionEnd': '单击设置标注终点',
      'message.dragSelected3d': '已选中：拖动家具移动，双击其他家具切换选择',
      'prop.type': '类型', 'prop.length': '长度(cm)', 'prop.angle': '角度(°)', 'prop.thickness': '厚度(cm)',
      'prop.height': '高度(cm)', 'prop.width': '宽度(cm)', 'prop.depth': '深度(cm)', 'prop.rotation': '旋转(°)',
      'prop.color': '颜色', 'prop.position': '距墙起点(cm)', 'prop.sillHeight': '离地高度(cm)', 'prop.openAngle': '开启角度(°)',
      'prop.steps': '级数',
      'object.wall': '墙体', 'object.door': '门', 'object.window': '窗', 'object.furniture': '家具', 'action.delete': '删除', 'action.deleteSelection': '删除所选',
      'prompt.new': '确定清空当前所有内容？', 'error.load': '载入失败: ',
      'message.place': '点击画布放置', 'message.placeFurniture': '点击画布放置家具', 'message.placeRoomEnd': '点击第二角完成房间', 'message.dragSelect': '拖拽框选对象', 'message.deleteSelection': '已删除 {count} 个对象',
      'message.overlap': '该位置与其他对象重叠', 'message.roomCross': '房间与现有墙体交叉', 'message.wallCross': '墙体与现有墙体交叉',
      'message.length': '长度', 'message.angle': '角度'
    },
    en: {
      'app.title': 'OpenFloorPlan', 'app.brand': 'OpenFloorPlan', 'lang.switch': '中文',
      'mode.2d': '2D Plan', 'mode.3d': '3D Preview', 'mode.split': 'Split View',
      'action.new': 'New', 'action.save': 'Export backup', 'action.load': 'Load', 'action.exportSvg': 'Export SVG',
      'section.project': 'Project scope', 'section.levels': 'Levels', 'section.materials': 'Floor finish',
      'section.drawing': 'Drawing', 'section.styles': 'Interior style', 'section.architecture': 'Architectural details', 'section.furniture': 'Furniture', 'section.properties': 'Properties',
      'flow.project': '1 Project', 'flow.levels': '2 Levels', 'flow.structure': '3 Structure', 'flow.openings': '4 Circulation', 'flow.rooms': '5 Rooms', 'flow.materials': '6 Materials', 'flow.decorate': '7 Modern decor', 'flow.output': '8 Review & export',
      'safety.concept': 'For spatial and interior concepts only. Local professionals must verify structure, fire safety, permits and construction.',
      'level.add': 'Add blank level', 'level.copy': 'Duplicate current level', 'level.summary': 'Elevation {elevation} cm · Height {height} cm · Slab {thickness} cm', 'level.lowerPreview': 'Lower level {level} preview', 'level.area': 'Area {area} m²', 'level.areaUnclosed': 'Area not enclosed',
      'floor.wood': 'Wood', 'floor.tile': 'Tile', 'floor.concrete': 'Microcement',
      'style.modern': 'Modern', 'style.nordic': 'Nordic', 'style.japanese': 'Japanese', 'style.wabiSabi': 'Wabi-sabi', 'style.industrial': 'Industrial', 'style.american': 'American',
      'tool.select': 'Select', 'tool.wall': 'Wall', 'tool.door': 'Door', 'tool.window': 'Window', 'tool.room': 'Room', 'tool.dimension': 'Dimension', 'tool.stair': 'Stair',
      'snap.auto': 'Snap to walls, objects and grid',
      'hint.selectObject': 'Select an object to view properties', 'hint.multiSelection': 'Press Delete or use the button above to remove them', 'status.tool': 'Tool', 'status.zoom': 'Zoom', 'status.position': 'Position',
      'status.restored': 'Restored the last design from this browser; future edits are saved locally',
      'status.autosave': 'Saved locally', 'status.autosaveSaved': 'Saved to this browser', 'status.autosaveUnavailable': 'Local saving is unavailable; export a backup', 'status.newProject': 'Created a blank project and updated the local draft', 'status.loadedProject': 'Loaded the project and updated the local draft', 'status.backupExported': 'JSON backup exported; keep it before clearing browser data',
      'status.shortcuts': 'V Select W Wall D Door F Window M Dimension R Room | Ctrl+Z Undo Ctrl+Y Redo Ctrl+C Copy Ctrl+V Paste | Del Delete',
      'furniture.sofa': 'Sofa', 'furniture.bed': 'Bed', 'furniture.table': 'Dining table', 'furniture.wardrobe': 'Wardrobe',
      'furniture.desk': 'Desk', 'furniture.cabinet': 'Cabinet', 'furniture.plant': 'Plant', 'furniture.lamp': 'Floor lamp',
      'furniture.toilet': 'Toilet', 'furniture.bathtub': 'Bathtub', 'furniture.sink': 'Sink', 'furniture.stove': 'Stove',
      'furniture.fridge': 'Fridge', 'furniture.washer': 'Washer', 'furniture.tv': 'TV',
      'furniture.search': 'Search furniture', 'furniture.empty': 'No matching furniture',
      'category.all': 'All', 'category.living': 'Living', 'category.bedroom': 'Bedroom', 'category.work': 'Office', 'category.kitchen': 'Kitchen', 'category.bath': 'Bath', 'category.decor': 'Decor',
      'control.sun': 'Sun', 'control.wholeBuilding': 'Whole building', 'control.activeLevel': 'Active level', 'control.cutaway': 'Cutaway', 'control.exterior': 'Exterior', 'control.walk': 'Walk', 'control.walkExit': 'Exit walk', 'control.exportPng': 'Export PNG',
      'status.selected': 'Selected', 'status.selectionCount': 'Selected {count} objects', 'message.dimensionStart': 'Click to set dimension start', 'message.dimensionEnd': 'Click to set dimension end',
      'message.dragSelected3d': 'Selected: drag to move, or double-click another item',
      'prop.type': 'Type', 'prop.length': 'Length (cm)', 'prop.angle': 'Angle (°)', 'prop.thickness': 'Thickness (cm)',
      'prop.height': 'Height (cm)', 'prop.width': 'Width (cm)', 'prop.depth': 'Depth (cm)', 'prop.rotation': 'Rotation (°)',
      'prop.color': 'Color', 'prop.position': 'Wall offset (cm)', 'prop.sillHeight': 'Sill height (cm)', 'prop.openAngle': 'Open angle (°)',
      'prop.steps': 'Steps',
      'object.wall': 'Wall', 'object.door': 'Door', 'object.window': 'Window', 'object.furniture': 'Furniture', 'action.delete': 'Delete', 'action.deleteSelection': 'Delete selected',
      'prompt.new': 'Clear the current project?', 'error.load': 'Load failed: ',
      'message.place': 'Click the canvas to place ', 'message.placeFurniture': 'Click the canvas to place furniture', 'message.placeRoomEnd': 'Click the second corner to finish the room', 'message.dragSelect': 'Drag to select objects', 'message.deleteSelection': 'Deleted {count} objects',
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
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    const button = document.getElementById('btn-lang');
    if (button) { button.textContent = t('lang.switch'); button.title = lang === 'zh' ? 'Switch to English' : '切换到中文'; }
    if (window.updateToolLabel) window.updateToolLabel();
    if (window.renderProps) window.renderProps();
    if (window.refreshDynamicControls) window.refreshDynamicControls();
    if (window.filterFurnitureCatalog) window.filterFurnitureCatalog();
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
