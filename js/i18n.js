// Lightweight bilingual UI dictionary. Project JSON files remain language-neutral.
(function () {
  const dict = {
    zh: {
      'app.title': '户型设计师', 'app.brand': '户型设计师', 'lang.switch': 'EN',
      'mode.2d': '2D 平面', 'mode.3d': '3D 预览', 'mode.split': '分屏',
      'action.new': '新建', 'action.save': '导出备份', 'action.load': '载入', 'action.exportSvg': '导出 SVG',
      'section.project': '项目定位', 'section.levels': '楼层', 'section.materials': '材质与材质刷', 'section.ceiling': '吊顶与灯光',
      'section.drawing': '绘图', 'section.architecture': '建筑构件风格', 'section.furniture': '家具', 'section.properties': '属性', 'section.roomTemplates': '房间模板',
      'flow.project': '1 项目', 'flow.levels': '2 楼层', 'flow.structure': '3 结构', 'flow.openings': '4 通行采光', 'flow.rooms': '5 房间', 'flow.materials': '6 材质', 'flow.output': '7 检查输出',
      'safety.concept': '用于空间与装修概念设计；结构、消防、报批与施工请按当地规范交由专业人员复核。',
      'level.add': '新增空白楼层', 'level.copy': '复制当前楼层', 'level.summary': '标高 {elevation} cm · 层高 {height} cm · 楼板 {thickness} cm', 'level.lowerPreview': '下层 {level} 预览', 'level.area': '面积 {area}㎡', 'level.areaUnclosed': '面积未闭合',
      'floor.wood': '木地板', 'floor.tile': '瓷砖', 'floor.concrete': '微水泥',
      'material.preset': '真实尺度材质', 'material.oakLight': '现代浅橡木长板', 'material.oakWarm': '暖色哑光橡木', 'material.walnut': '深胡桃木长板', 'material.travertine': '米白洞石大板', 'material.microcement': '暖灰微水泥', 'material.linen': '亚麻',
      'material.applyFloor': '应用到地面', 'material.applySelected': '应用到所选', 'material.pick': '吸取所选', 'material.brush': '刷到所选',
      'ceiling.enabled': '启用当前层吊顶', 'ceiling.drop': '下吊(cm)', 'ceiling.downlights': '筒灯', 'ceiling.cove': '环形灯带',
      'roomTemplate.hint': '一键生成后仍可逐项编辑墙体和家具', 'roomTemplate.living': '客厅', 'roomTemplate.bedroom': '卧室', 'roomTemplate.dining': '餐厅', 'roomTemplate.study': '书房',
      'style.modern': '现代', 'style.nordic': '北欧', 'style.japanese': '日式', 'style.wabiSabi': '侘寂', 'style.industrial': '工业', 'style.american': '美式',
      'tool.select': '选择', 'tool.wall': '墙体', 'tool.door': '门', 'tool.window': '窗', 'tool.room': '房间', 'tool.dimension': '标注', 'tool.stair': '楼梯',
      'snap.auto': '自动吸附墙边、物件和网格',
      'hint.selectObject': '选择对象查看属性', 'hint.multiSelection': '可按 Delete 键或点击上方按钮删除', 'status.tool': '工具', 'status.zoom': '缩放', 'status.position': '位置',
      'status.restored': '已恢复上次在此浏览器中的设计；后续修改会自动保存在本地',
      'status.autosave': '本地自动保存', 'status.autosaveSaved': '已保存到本地', 'status.autosaveUnavailable': '本地保存不可用，请导出备份', 'status.newProject': '已新建空白项目并更新本地草稿', 'status.loadedProject': '已载入项目并更新本地草稿', 'status.backupExported': 'JSON 备份已导出；清除浏览器数据前请保留此文件',
      'status.shortcuts': 'V选择 W墙 D门 F窗 M标注 R房间 | Ctrl+Z撤销 Ctrl+Y重做 Ctrl+C复制 Ctrl+V粘贴 | Del删除 | 右键旋转家具',
      'furniture.sofa': '沙发', 'furniture.bed': '床', 'furniture.table': '餐桌', 'furniture.wardrobe': '衣柜',
      'furniture.desk': '书桌', 'furniture.cabinet': '橱柜', 'furniture.plant': '盆栽', 'furniture.lamp': '落地灯',
      'furniture.toilet': '马桶', 'furniture.bathtub': '浴缸', 'furniture.sink': '水槽', 'furniture.stove': '灶台',
      'furniture.fridge': '冰箱', 'furniture.washer': '洗衣机', 'furniture.tv': '电视',
      'furniture.search': '搜索家具', 'furniture.empty': '没有匹配的家具',
      'category.all': '全部', 'category.living': '客餐厅', 'category.bedroom': '卧室', 'category.work': '办公', 'category.kitchen': '厨房', 'category.bath': '卫浴', 'category.decor': '装饰',
      'control.camera': '镜头', 'camera.eye': '眼平', 'camera.bird': '鸟瞰', 'camera.isometric': '等距', 'camera.exterior': '外观', 'camera.save': '保存视角', 'camera.restore': '恢复视角',
      'control.sun': '阳光', 'control.lighting': '灯光环境', 'lighting.daylight': '日光', 'lighting.warmNight': '暖夜', 'lighting.studio': '棚拍', 'control.realtimeMode': '实时清爽', 'control.photoMode': '摄影暖调', 'control.wholeBuilding': '整栋楼', 'control.activeLevel': '当前层', 'control.cutaway': '剖切视图', 'control.exterior': '完整外观', 'control.walk': '漫游', 'control.walkExit': '退出漫游', 'control.exportPng': '导出 PNG',
      'control.exportPngHD': '导出高清 PNG',
      'status.selected': '已选择', 'status.selectionCount': '已选择 {count} 个对象', 'message.dimensionStart': '单击设置标注起点', 'message.dimensionEnd': '单击设置标注终点',
      'message.dragSelected3d': '已选中：拖动家具移动，双击其他家具切换选择',
      'prop.type': '类型', 'prop.length': '长度(cm)', 'prop.angle': '角度(°)', 'prop.thickness': '厚度(cm)',
      'prop.height': '高度(cm)', 'prop.width': '宽度(cm)', 'prop.depth': '深度(cm)', 'prop.rotation': '旋转(°)',
      'prop.color': '颜色', 'prop.position': '距墙起点(cm)', 'prop.sillHeight': '离地高度(cm)', 'prop.openAngle': '开启角度(°)',
      'prop.steps': '级数', 'prop.maxRise': '最高升高(cm)',
      'object.wall': '墙体', 'object.door': '门', 'object.window': '窗', 'object.furniture': '家具', 'action.delete': '删除', 'action.deleteSelection': '删除所选',
      'prompt.new': '确定清空当前所有内容？', 'error.load': '载入失败: ',
      'message.place': '点击画布放置', 'message.placeFurniture': '点击画布放置家具，右键旋转方向', 'message.placeRoomEnd': '点击第二角完成房间', 'message.dragSelect': '拖拽框选对象', 'message.deleteSelection': '已删除 {count} 个对象',
      'message.overlap': '该位置与其他对象重叠', 'message.roomCross': '房间与现有墙体交叉', 'message.wallCross': '墙体与现有墙体交叉', 'message.furnitureRotated': '家具已旋转 {angle}°',
      'message.selectMaterialTarget': '请先选择墙体或家具', 'message.noMaterialToPick': '所选对象还没有可吸取的材质', 'message.materialPicked': '已吸取材质，可刷到其他墙体或家具',
      'message.roomTemplateAdded': '房间模板已添加，墙体和家具均可继续编辑',
      'message.length': '长度', 'message.angle': '角度'
    },
    en: {
      'app.title': 'OpenFloorPlan', 'app.brand': 'OpenFloorPlan', 'lang.switch': '中文',
      'mode.2d': '2D Plan', 'mode.3d': '3D Preview', 'mode.split': 'Split View',
      'action.new': 'New', 'action.save': 'Export backup', 'action.load': 'Load', 'action.exportSvg': 'Export SVG',
      'section.project': 'Project scope', 'section.levels': 'Levels', 'section.materials': 'Materials & brush', 'section.ceiling': 'Ceiling & lights',
      'section.drawing': 'Drawing', 'section.architecture': 'Architectural details', 'section.furniture': 'Furniture', 'section.properties': 'Properties', 'section.roomTemplates': 'Room templates',
      'flow.project': '1 Project', 'flow.levels': '2 Levels', 'flow.structure': '3 Structure', 'flow.openings': '4 Circulation', 'flow.rooms': '5 Rooms', 'flow.materials': '6 Materials', 'flow.output': '7 Review & export',
      'safety.concept': 'For spatial and interior concepts only. Local professionals must verify structure, fire safety, permits and construction.',
      'level.add': 'Add blank level', 'level.copy': 'Duplicate current level', 'level.summary': 'Elevation {elevation} cm · Height {height} cm · Slab {thickness} cm', 'level.lowerPreview': 'Lower level {level} preview', 'level.area': 'Area {area} m²', 'level.areaUnclosed': 'Area not enclosed',
      'floor.wood': 'Wood', 'floor.tile': 'Tile', 'floor.concrete': 'Microcement',
      'material.preset': 'Real-scale material', 'material.oakLight': 'Modern light oak plank', 'material.oakWarm': 'Warm matte oak', 'material.walnut': 'Dark walnut plank', 'material.travertine': 'Ivory travertine slab', 'material.microcement': 'Warm grey microcement', 'material.linen': 'Linen',
      'material.applyFloor': 'Apply to floor', 'material.applySelected': 'Apply to selected', 'material.pick': 'Pick selected', 'material.brush': 'Brush selected',
      'ceiling.enabled': 'Enable level ceiling', 'ceiling.drop': 'Drop (cm)', 'ceiling.downlights': 'Downlights', 'ceiling.cove': 'Cove light',
      'roomTemplate.hint': 'Generate once, then edit every wall and furniture item', 'roomTemplate.living': 'Living room', 'roomTemplate.bedroom': 'Bedroom', 'roomTemplate.dining': 'Dining room', 'roomTemplate.study': 'Study',
      'style.modern': 'Modern', 'style.nordic': 'Nordic', 'style.japanese': 'Japanese', 'style.wabiSabi': 'Wabi-sabi', 'style.industrial': 'Industrial', 'style.american': 'American',
      'tool.select': 'Select', 'tool.wall': 'Wall', 'tool.door': 'Door', 'tool.window': 'Window', 'tool.room': 'Room', 'tool.dimension': 'Dimension', 'tool.stair': 'Stair',
      'snap.auto': 'Snap to walls, objects and grid',
      'hint.selectObject': 'Select an object to view properties', 'hint.multiSelection': 'Press Delete or use the button above to remove them', 'status.tool': 'Tool', 'status.zoom': 'Zoom', 'status.position': 'Position',
      'status.restored': 'Restored the last design from this browser; future edits are saved locally',
      'status.autosave': 'Saved locally', 'status.autosaveSaved': 'Saved to this browser', 'status.autosaveUnavailable': 'Local saving is unavailable; export a backup', 'status.newProject': 'Created a blank project and updated the local draft', 'status.loadedProject': 'Loaded the project and updated the local draft', 'status.backupExported': 'JSON backup exported; keep it before clearing browser data',
      'status.shortcuts': 'V Select W Wall D Door F Window M Dimension R Room | Ctrl+Z Undo Ctrl+Y Redo Ctrl+C Copy Ctrl+V Paste | Del Delete | Right-click rotates furniture',
      'furniture.sofa': 'Sofa', 'furniture.bed': 'Bed', 'furniture.table': 'Dining table', 'furniture.wardrobe': 'Wardrobe',
      'furniture.desk': 'Desk', 'furniture.cabinet': 'Cabinet', 'furniture.plant': 'Plant', 'furniture.lamp': 'Floor lamp',
      'furniture.toilet': 'Toilet', 'furniture.bathtub': 'Bathtub', 'furniture.sink': 'Sink', 'furniture.stove': 'Stove',
      'furniture.fridge': 'Fridge', 'furniture.washer': 'Washer', 'furniture.tv': 'TV',
      'furniture.search': 'Search furniture', 'furniture.empty': 'No matching furniture',
      'category.all': 'All', 'category.living': 'Living', 'category.bedroom': 'Bedroom', 'category.work': 'Office', 'category.kitchen': 'Kitchen', 'category.bath': 'Bath', 'category.decor': 'Decor',
      'control.camera': 'Camera', 'camera.eye': 'Eye level', 'camera.bird': 'Bird view', 'camera.isometric': 'Isometric', 'camera.exterior': 'Exterior', 'camera.save': 'Save view', 'camera.restore': 'Restore view',
      'control.sun': 'Sun', 'control.lighting': 'Lighting', 'lighting.daylight': 'Daylight', 'lighting.warmNight': 'Warm night', 'lighting.studio': 'Studio', 'control.realtimeMode': 'Realtime', 'control.photoMode': 'Warm photo', 'control.wholeBuilding': 'Whole building', 'control.activeLevel': 'Active level', 'control.cutaway': 'Cutaway', 'control.exterior': 'Exterior', 'control.walk': 'Walk', 'control.walkExit': 'Exit walk', 'control.exportPng': 'Export PNG',
      'control.exportPngHD': 'Export HD PNG',
      'status.selected': 'Selected', 'status.selectionCount': 'Selected {count} objects', 'message.dimensionStart': 'Click to set dimension start', 'message.dimensionEnd': 'Click to set dimension end',
      'message.dragSelected3d': 'Selected: drag to move, or double-click another item',
      'prop.type': 'Type', 'prop.length': 'Length (cm)', 'prop.angle': 'Angle (°)', 'prop.thickness': 'Thickness (cm)',
      'prop.height': 'Height (cm)', 'prop.width': 'Width (cm)', 'prop.depth': 'Depth (cm)', 'prop.rotation': 'Rotation (°)',
      'prop.color': 'Color', 'prop.position': 'Wall offset (cm)', 'prop.sillHeight': 'Sill height (cm)', 'prop.openAngle': 'Open angle (°)',
      'prop.steps': 'Steps', 'prop.maxRise': 'Max rise (cm)',
      'object.wall': 'Wall', 'object.door': 'Door', 'object.window': 'Window', 'object.furniture': 'Furniture', 'action.delete': 'Delete', 'action.deleteSelection': 'Delete selected',
      'prompt.new': 'Clear the current project?', 'error.load': 'Load failed: ',
      'message.place': 'Click the canvas to place ', 'message.placeFurniture': 'Click to place furniture; right-click to rotate', 'message.placeRoomEnd': 'Click the second corner to finish the room', 'message.dragSelect': 'Drag to select objects', 'message.deleteSelection': 'Deleted {count} objects',
      'message.overlap': 'This position overlaps another object', 'message.roomCross': 'Room crosses an existing wall', 'message.wallCross': 'Wall crosses an existing wall', 'message.furnitureRotated': 'Furniture rotated to {angle}°',
      'message.selectMaterialTarget': 'Select a wall or furniture first', 'message.noMaterialToPick': 'The selected object has no material to pick', 'message.materialPicked': 'Material picked; brush it onto another wall or furniture',
      'message.roomTemplateAdded': 'Room template added; every wall and furniture item remains editable',
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
