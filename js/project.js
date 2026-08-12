(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CURRENT_VERSION = 3;
  const LOCAL_DRAFT_KEY = 'openfloorplan-project-v2';
  const DEFAULT_LEVEL = { id: 'level_1', name: '1F', elevation: 0, floorThickness: 20, height: 280, floorFinish: 'wood' };
  const DEFAULT_STYLE = 'modern';
  const DEFAULT_ARCHITECTURE_STYLE = 'modern';
  const DEFAULT_RENDER_MODE = 'realtime';
  const RENDER_PRESETS = {
    realtime: {
      pixelRatioCap: 1.75, shadowMapSize: 2048, anisotropy: 8, textureDetail: 512,
      exportScale: 1.5, contactShadowOpacity: 0.11,
      exposure: 1.04, ambient: 0.34, hemisphere: 0.42, sun: 1.12, practicalLights: false,
    },
    photo: {
      pixelRatioCap: 2.5, shadowMapSize: 4096, anisotropy: 16, textureDetail: 1024,
      exportScale: 2, contactShadowOpacity: 0.17,
      exposure: 1.02, ambient: 0.25, hemisphere: 0.36, sun: 0.98, practicalLights: true,
    },
  };
  const DEFAULT_LIGHTING_PRESET = 'daylight';
  const LIGHTING_PRESETS = {
    daylight: { sunAngle: 58, sun: 0.92, ambient: 1, hemisphere: 1, practical: 0.2, practicalColor: '#fff1d6', exposure: 1 },
    warmNight: { sunAngle: 14, sun: 0.16, ambient: 0.48, hemisphere: 0.42, practical: 1.35, practicalColor: '#ffd09a', exposure: 0.92 },
    studio: { sunAngle: 42, sun: 0.78, ambient: 1.18, hemisphere: 1.2, practical: 0.55, practicalColor: '#fff4e5', exposure: 1.08 },
  };
  const DEFAULT_CAMERA_PRESET = 'isometric';
  const CAMERA_PRESETS = {
    eye: { theta: 0.78, phi: 1.36, radiusScale: 1.15, fov: 58 },
    bird: { theta: 0.78, phi: 0.28, radiusScale: 1.45, fov: 52 },
    isometric: { theta: 0.78, phi: 0.92, radiusScale: 1.65, fov: 54 },
    exterior: { theta: 0.62, phi: 1.04, radiusScale: 1.9, fov: 50 },
  };
  const DEFAULT_CEILING = { enabled: false, drop: 15, thickness: 8, coveLight: false, downlights: 0, color: '#f7f3ed' };
  const MATERIAL_PRESETS = {
    oakLight: { color: '#d8bf98', colorAlt: '#b99568', pattern: 'wood', scaleCm: 18, plankLengthCm: 180, plankWidthCm: 18, boardsPerTile: 4, pbrFloorAsset: 'wood_floor_040', pbrFiles: { diff: 'WoodFloor040_1K-JPG_Color.jpg', normal: 'WoodFloor040_1K-JPG_NormalGL.jpg', roughness: 'WoodFloor040_1K-JPG_Roughness.jpg' }, pbrTint: '#fff6e8', pbrSizeCm: 190, roughness: 0.66, metalness: 0 },
    oakWarm: { color: '#b9895e', colorAlt: '#8f6242', pattern: 'wood', scaleCm: 18, plankLengthCm: 160, plankWidthCm: 18, boardsPerTile: 4, pbrFloorAsset: 'wood_floor_040', pbrFiles: { diff: 'WoodFloor040_1K-JPG_Color.jpg', normal: 'WoodFloor040_1K-JPG_NormalGL.jpg', roughness: 'WoodFloor040_1K-JPG_Roughness.jpg' }, pbrTint: '#d7aa80', pbrSizeCm: 190, roughness: 0.64, metalness: 0 },
    walnut: { color: '#6b4934', colorAlt: '#422c22', pattern: 'wood', scaleCm: 16, plankLengthCm: 140, plankWidthCm: 16, boardsPerTile: 4, pbrFloorAsset: 'wood_floor_040', pbrFiles: { diff: 'WoodFloor040_1K-JPG_Color.jpg', normal: 'WoodFloor040_1K-JPG_NormalGL.jpg', roughness: 'WoodFloor040_1K-JPG_Roughness.jpg' }, pbrTint: '#704d3d', pbrSizeCm: 190, roughness: 0.6, metalness: 0 },
    travertine: { color: '#d9c7aa', colorAlt: '#b9a17d', pattern: 'stone', scaleCm: 60, surfaceLengthCm: 120, surfaceWidthCm: 60, roughness: 0.48, metalness: 0 },
    microcement: { color: '#aaa59f', colorAlt: '#85817d', pattern: 'cement', scaleCm: 120, surfaceLengthCm: 160, surfaceWidthCm: 160, roughness: 0.88, metalness: 0 },
    linen: { color: '#c9c0b0', colorAlt: '#a99f91', pattern: 'fabric', scaleCm: 12, surfaceLengthCm: 48, surfaceWidthCm: 48, roughness: 0.96, metalness: 0 },
  };
  const ROOM_TEMPLATES = {
    living: {
      width: 520, depth: 380, floorMaterialId: 'oakLight',
      openings: [
        { type: 'window', wallIndex: 0, ratio: 0.34, width: 150, height: 130, sillHeight: 82 },
        { type: 'window', wallIndex: 1, ratio: 0.54, width: 130, height: 125, sillHeight: 85 },
        { type: 'door', wallIndex: 2, ratio: 0.82, width: 90, height: 210 },
      ],
      furnitures: [
        { type: 'sofa', x: 120, y: 250, rotation: -2.08, materialId: 'linen' },
        { type: 'cabinet', x: 440, y: 65, w: 160, d: 42, h: 55, materialId: 'walnut' },
        { type: 'tv', x: 440, y: 65, elevation: 55 },
        { type: 'table', x: 280, y: 195, w: 110, d: 60, h: 42, rotation: -0.24, materialId: 'oakWarm' },
        { type: 'plant', x: 470, y: 325 },
      ],
    },
    bedroom: {
      width: 420, depth: 360, floorMaterialId: 'oakWarm',
      openings: [
        { type: 'window', wallIndex: 0, ratio: 0.48, width: 150, height: 125, sillHeight: 85 },
        { type: 'door', wallIndex: 1, ratio: 0.78, width: 88, height: 210 },
      ],
      furnitures: [
        { type: 'bed', x: 165, y: 205, materialId: 'linen' },
        { type: 'wardrobe', x: 320, y: 45, materialId: 'walnut' },
        { type: 'lamp', x: 55, y: 305 },
      ],
    },
    dining: {
      width: 380, depth: 320, floorMaterialId: 'travertine',
      openings: [
        { type: 'window', wallIndex: 0, ratio: 0.5, width: 140, height: 125, sillHeight: 85 },
        { type: 'door', wallIndex: 2, ratio: 0.82, width: 90, height: 210 },
      ],
      furnitures: [
        { type: 'table', x: 190, y: 165, materialId: 'oakWarm' },
        { type: 'cabinet', x: 315, y: 45, materialId: 'walnut' },
        { type: 'plant', x: 48, y: 268 },
      ],
    },
    study: {
      width: 340, depth: 300, floorMaterialId: 'oakLight',
      openings: [
        { type: 'window', wallIndex: 0, ratio: 0.5, width: 130, height: 125, sillHeight: 85 },
        { type: 'door', wallIndex: 1, ratio: 0.8, width: 86, height: 210 },
      ],
      furnitures: [
        { type: 'desk', x: 170, y: 55, materialId: 'oakWarm' },
        { type: 'cabinet', x: 285, y: 215, materialId: 'walnut' },
        { type: 'plant', x: 48, y: 245 },
      ],
    },
  };

  function normalizeMaterialId(value) {
    return Object.hasOwn(MATERIAL_PRESETS, value) ? value : null;
  }

  function getMaterialRepeat(materialId, widthM, depthM) {
    const preset = MATERIAL_PRESETS[materialId];
    if (!preset) return { x: 1, y: 1 };
    const lengthCm = preset.plankLengthCm || preset.surfaceLengthCm || preset.scaleCm;
    const widthCm = preset.plankWidthCm
      ? preset.plankWidthCm * (preset.boardsPerTile || 1)
      : (preset.surfaceWidthCm || preset.scaleCm);
    return {
      x: Number((Math.max(0.01, finiteNumber(widthM, 1)) / (lengthCm / 100)).toFixed(4)),
      y: Number((Math.max(0.01, finiteNumber(depthM, 1)) / (widthCm / 100)).toFixed(4)),
    };
  }

  function getDefaultFloorMaterialId(floorFinish) {
    return { wood: 'oakLight', tile: 'travertine', concrete: 'microcement' }[floorFinish] || 'oakLight';
  }

  function computeGroundingTranslation(localMinY) {
    const minY = Number(localMinY);
    if (!Number.isFinite(minY) || Math.abs(minY) < 0.0005) return 0;
    return -minY;
  }

  function computeShadowCameraExtent(bounds) {
    const width = Math.max(0, finiteNumber(bounds?.maxX, 0) - finiteNumber(bounds?.minX, 0));
    const depth = Math.max(0, finiteNumber(bounds?.maxZ, 0) - finiteNumber(bounds?.minZ, 0));
    return Number(Math.max(4, Math.min(45, Math.max(width, depth) / 2 + 3)).toFixed(3));
  }

  function computePracticalLightIntensity(kind, strength, renderMode) {
    const base = { room: 48, downlight: 28, lamp: 20 }[kind];
    const normalizedStrength = Number(strength);
    if (!base || !Number.isFinite(normalizedStrength) || normalizedStrength <= 0) return 0;
    const qualityFactor = renderMode === 'photo' ? 1 : 0.72;
    return Number((base * normalizedStrength * qualityFactor).toFixed(2));
  }
  const FURNITURE_DEFAULTS = {
    sofa: { w: 180, d: 85, h: 80 },
    bed: { w: 160, d: 200, h: 50 },
    table: { w: 120, d: 80, h: 75 },
    wardrobe: { w: 180, d: 60, h: 200 },
    desk: { w: 120, d: 60, h: 75 },
    plant: { w: 30, d: 30, h: 100 },
    toilet: { w: 40, d: 60, h: 40 },
    bathtub: { w: 170, d: 70, h: 55 },
    cabinet: { w: 80, d: 50, h: 90 },
    fridge: { w: 70, d: 70, h: 180 },
    tv: { w: 120, d: 8, h: 70 },
    lamp: { w: 25, d: 25, h: 150 },
    stove: { w: 60, d: 60, h: 85 },
    sink: { w: 60, d: 50, h: 85 },
    washer: { w: 60, d: 60, h: 85 },
  };
  const STYLE_PRESETS = {
    modern: {
      wall: '#f4f1ec', floor: '#c8a47b', floorAlt: '#b99066', wood: '#9a6b43', roof: '#596269', ground: '#aeb9ac',
      fabric: '#65717b', metal: '#aeb7bf', accent: '#315f59', sky: '#c9d9e6', sun: '#fff0d6', wallRoughness: 0.86, furnitureProfile: 'low',
    },
    nordic: {
      wall: '#fbfbf7', floor: '#e1c9a8', floorAlt: '#d5b78e', wood: '#c79b69', roof: '#7c8790', ground: '#c4cdc7',
      fabric: '#aab7b0', metal: '#c8ced1', accent: '#78968b', sky: '#dce7ec', sun: '#fff7e8', wallRoughness: 0.9, furnitureProfile: 'tapered',
    },
    japanese: {
      wall: '#eee7d8', floor: '#b89b72', floorAlt: '#a9885f', wood: '#76563c', roof: '#66564d', ground: '#aeb4a6',
      fabric: '#9e9a82', metal: '#4f5550', accent: '#66735b', sky: '#d6d8cf', sun: '#f8e7c7', wallRoughness: 0.92, furnitureProfile: 'floor',
    },
    wabiSabi: {
      wall: '#d8cdbc', floor: '#a68b6b', floorAlt: '#93765a', wood: '#745b45', roof: '#827363', ground: '#b9b1a4',
      fabric: '#8c8173', metal: '#6c6962', accent: '#7b6d59', sky: '#c8c2b7', sun: '#ecd8b8', wallRoughness: 0.96, furnitureProfile: 'organic',
    },
    industrial: {
      wall: '#a9aaa7', floor: '#6f6b65', floorAlt: '#5d5954', wood: '#5c4635', roof: '#3e4447', ground: '#7d8885',
      fabric: '#4d5153', metal: '#363b3d', accent: '#a5643d', sky: '#aeb9bf', sun: '#e8d5b4', wallRoughness: 0.82, furnitureProfile: 'frame',
    },
    american: {
      wall: '#eadfce', floor: '#7a5136', floorAlt: '#68432d', wood: '#5b3824', roof: '#68452f', ground: '#a8b79a',
      fabric: '#58645f', metal: '#a27845', accent: '#354f49', sky: '#c6d4dc', sun: '#ffe9c2', wallRoughness: 0.88, furnitureProfile: 'classic',
    },
  };
  const ARCHITECTURE_PRESETS = {
    modern: { frameWidth: 0.035, mullions: 0, baseboard: 0.04, crown: 0, eave: 0.16, roofHeight: 0.14, doorProfile: 'flush' },
    nordic: { frameWidth: 0.045, mullions: 1, baseboard: 0.09, crown: 0.03, eave: 0.22, roofHeight: 0.16, doorProfile: 'groove' },
    japanese: { frameWidth: 0.055, mullions: 4, baseboard: 0.04, crown: 0.07, eave: 0.28, roofHeight: 0.18, doorProfile: 'slatted' },
    wabiSabi: { frameWidth: 0.07, mullions: 0, baseboard: 0.025, crown: 0, eave: 0.2, roofHeight: 0.15, doorProfile: 'organic' },
    industrial: { frameWidth: 0.03, mullions: 2, baseboard: 0.07, crown: 0.05, eave: 0.12, roofHeight: 0.12, doorProfile: 'steel' },
    american: { frameWidth: 0.075, mullions: 2, baseboard: 0.14, crown: 0.11, eave: 0.3, roofHeight: 0.2, doorProfile: 'panel' },
  };

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function computeRenderExportSize(width, height, requestedScale, maxPixels) {
    const baseWidth = Math.max(1, Math.floor(finiteNumber(width, 1)));
    const baseHeight = Math.max(1, Math.floor(finiteNumber(height, 1)));
    const desiredScale = Math.max(1, finiteNumber(requestedScale, 1));
    const budget = Math.max(baseWidth * baseHeight, finiteNumber(maxPixels, 16000000));
    const budgetScale = Math.sqrt(budget / (baseWidth * baseHeight));
    const scale = Math.min(desiredScale, budgetScale);
    return {
      width: Math.max(1, Math.floor(baseWidth * scale)),
      height: Math.max(1, Math.floor(baseHeight * scale)),
      scale,
    };
  }

  function normalizeCameraView(view) {
    if (!view || !Array.isArray(view.position) || !Array.isArray(view.target) || view.position.length !== 3 || view.target.length !== 3) return null;
    const position = view.position.map(Number);
    const target = view.target.map(Number);
    const fov = finiteNumber(view.fov, 54);
    if (![...position, ...target, fov].every(Number.isFinite)) return null;
    return { position, target, fov: Math.max(25, Math.min(90, fov)) };
  }

  function applyMaterialBrush(source, target) {
    return { ...target, materialId: normalizeMaterialId(source?.materialId) };
  }

  function createRoomTemplate(templateId, options) {
    const template = ROOM_TEMPLATES[templateId];
    if (!template) throw new Error('Unknown room template: ' + templateId);
    const levelId = String(options?.levelId || DEFAULT_LEVEL.id);
    const originX = finiteNumber(options?.originX, 0);
    const originY = finiteNumber(options?.originY, 0);
    const height = Math.max(100, finiteNumber(options?.height, DEFAULT_LEVEL.height));
    const thickness = Math.max(1, finiteNumber(options?.thickness, 20));
    let nextId = Math.max(1, Math.floor(finiteNumber(options?.startId, 1)));
    const genId = () => 'obj_' + nextId++;
    const x2 = originX + template.width;
    const y2 = originY + template.depth;
    const wall = points => ({ id: genId(), levelId, ...points, thickness, height, materialId: null });
    const walls = [
      wall({ x1: originX, y1: originY, x2, y2: originY }),
      wall({ x1: x2, y1: originY, x2, y2 }),
      wall({ x1: x2, y1: y2, x2: originX, y2 }),
      wall({ x1: originX, y1: y2, x2: originX, y2: originY }),
    ];
    const rooms = [{
      id: genId(), levelId, templateId,
      x: originX + template.width / 2, y: originY + template.depth / 2,
      w: template.width, d: template.depth, materialId: template.floorMaterialId,
    }];
    const furnitures = template.furnitures.map(item => {
      const normalized = normalizeFurniture(item);
      return { ...normalized, id: genId(), levelId, x: originX + normalized.x, y: originY + normalized.y };
    });
    const doors = [];
    const windows = [];
    for (const opening of template.openings || []) {
      const parentWall = walls[Math.max(0, Math.min(walls.length - 1, Math.floor(finiteNumber(opening.wallIndex, 0))))];
      const ratio = Math.max(0.12, Math.min(0.88, finiteNumber(opening.ratio, 0.5)));
      const item = {
        id: genId(), levelId, wallId: parentWall.id,
        x: Math.round(parentWall.x1 + (parentWall.x2 - parentWall.x1) * ratio),
        y: Math.round(parentWall.y1 + (parentWall.y2 - parentWall.y1) * ratio),
        width: finiteNumber(opening.width, opening.type === 'door' ? 90 : 120),
        height: finiteNumber(opening.height, opening.type === 'door' ? 210 : 120),
      };
      if (opening.type === 'door') doors.push({ ...item, openAngle: 90, swing: 1 });
      else windows.push({ ...item, sillHeight: finiteNumber(opening.sillHeight, 90) });
    }
    return { walls, rooms, furnitures, doors, windows, nextId };
  }

  function normalizeFurniture(item) {
    const defaults = FURNITURE_DEFAULTS[item.type] || { w: 60, d: 60, h: 60 };
    return {
      ...item,
      w: finiteNumber(item.w ?? item.width, defaults.w),
      d: finiteNumber(item.d ?? item.depth ?? item.height, defaults.d),
      h: finiteNumber(item.h, defaults.h),
      elevation: Math.max(0, finiteNumber(item.elevation, 0)),
      rotation: finiteNumber(item.rotation, 0),
      materialId: normalizeMaterialId(item.materialId),
    };
  }

  function normalizeLevel(level, index) {
    const ceiling = level.ceiling && typeof level.ceiling === 'object' ? level.ceiling : {};
    return {
      ...level,
      id: String(level.id || ('level_' + (index + 1))),
      name: String(level.name || ((index + 1) + 'F')),
      elevation: finiteNumber(level.elevation, index * 300),
      floorThickness: Math.max(1, finiteNumber(level.floorThickness, 20)),
      height: Math.max(100, finiteNumber(level.height, 280)),
      floorFinish: ['wood', 'tile', 'concrete'].includes(level.floorFinish) ? level.floorFinish : 'wood',
      materialId: normalizeMaterialId(level.materialId),
      ceiling: {
        enabled: ceiling.enabled === true,
        drop: Math.max(0, Math.min(80, finiteNumber(ceiling.drop, DEFAULT_CEILING.drop))),
        thickness: Math.max(2, Math.min(30, finiteNumber(ceiling.thickness, DEFAULT_CEILING.thickness))),
        coveLight: ceiling.coveLight === true,
        downlights: Math.max(0, Math.min(12, Math.round(finiteNumber(ceiling.downlights, DEFAULT_CEILING.downlights)))),
        color: /^#[0-9a-f]{6}$/i.test(ceiling.color || '') ? ceiling.color : DEFAULT_CEILING.color,
      },
    };
  }

  function collection(input, key) {
    if (input[key] == null) return [];
    if (!Array.isArray(input[key])) throw new Error(key + ' must be an array.');
    return input[key];
  }

  function normalizeProject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Project data must be an object.');
    }
    const levels = (input.levels == null ? [DEFAULT_LEVEL] : collection(input, 'levels')).map(normalizeLevel);
    if (!levels.length) levels.push({ ...DEFAULT_LEVEL });
    const levelIds = new Set(levels.map(level => level.id));
    const fallbackLevelId = levels[0].id;
    const activeLevelId = levelIds.has(input.activeLevelId) ? input.activeLevelId : fallbackLevelId;
    const withLevel = item => ({ ...item, levelId: levelIds.has(item.levelId) ? item.levelId : fallbackLevelId });
    const walls = collection(input, 'walls').map(wall => withLevel({ thickness: 20, height: 280, ...wall, materialId: normalizeMaterialId(wall.materialId) }));
    const wallLevels = new Map(walls.map(wall => [wall.id, wall.levelId]));
    const withOpeningLevel = item => ({ ...item, levelId: levelIds.has(item.levelId) ? item.levelId : (wallLevels.get(item.wallId) || fallbackLevelId) });
    return {
      version: CURRENT_VERSION,
      levels,
      activeLevelId,
      style: Object.hasOwn(STYLE_PRESETS, input.style) ? input.style : DEFAULT_STYLE,
      architectureStyle: Object.hasOwn(ARCHITECTURE_PRESETS, input.architectureStyle) ? input.architectureStyle : DEFAULT_ARCHITECTURE_STYLE,
      renderMode: Object.hasOwn(RENDER_PRESETS, input.renderMode) ? input.renderMode : DEFAULT_RENDER_MODE,
      lightingPreset: Object.hasOwn(LIGHTING_PRESETS, input.lightingPreset) ? input.lightingPreset : DEFAULT_LIGHTING_PRESET,
      cameraPreset: Object.hasOwn(CAMERA_PRESETS, input.cameraPreset) ? input.cameraPreset : DEFAULT_CAMERA_PRESET,
      savedCamera: normalizeCameraView(input.savedCamera),
      sunAngle: finiteNumber(input.sunAngle, 60),
      walls,
      doors: collection(input, 'doors').map(withOpeningLevel),
      windows: collection(input, 'windows').map(withOpeningLevel),
      rooms: collection(input, 'rooms').map(withLevel),
      furnitures: collection(input, 'furnitures').map(item => withLevel(normalizeFurniture(item))),
      dimensions: collection(input, 'dimensions').map(withLevel),
      stairs: collection(input, 'stairs').map(stair => withLevel({
        width: 100, length: 300, stepCount: 16, rotation: 0, ...stair,
        toLevelId: levelIds.has(stair.toLevelId) ? stair.toLevelId : null,
      })),
    };
  }

  function serializeProject(state) {
    return normalizeProject({
      version: CURRENT_VERSION,
      levels: state.levels,
      activeLevelId: state.activeLevelId,
      style: state.style,
      architectureStyle: state.architectureStyle,
      renderMode: state.renderMode,
      lightingPreset: state.lightingPreset,
      cameraPreset: state.cameraPreset,
      savedCamera: state.savedCamera,
      sunAngle: state.sunAngle,
      walls: state.walls,
      doors: state.doors,
      windows: state.windows,
      rooms: state.rooms,
      furnitures: state.furnitures,
      dimensions: state.dimensions,
      stairs: state.stairs,
    });
  }

  function saveLocalDraft(storage, state) {
    try {
      storage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(serializeProject(state)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadLocalDraft(storage) {
    try {
      const json = storage.getItem(LOCAL_DRAFT_KEY);
      if (!json) return null;
      return normalizeProject(JSON.parse(json));
    } catch (_) {
      try { storage.removeItem(LOCAL_DRAFT_KEY); } catch (_) { /* storage unavailable */ }
      return null;
    }
  }

  function getNextObjectId(project) {
    const ids = ['walls', 'doors', 'windows', 'rooms', 'furnitures', 'dimensions', 'stairs']
      .flatMap(key => Array.isArray(project[key]) ? project[key] : [])
      .map(item => Number.parseInt(String(item.id || '').split('_').pop(), 10))
      .filter(Number.isFinite);
    return Math.max(0, ...ids) + 1;
  }

  function getNextLevelId(project) {
    const ids = (project.levels || []).map(level => Number.parseInt(String(level.id).split('_').pop(), 10)).filter(Number.isFinite);
    return 'level_' + (Math.max(0, ...ids) + 1);
  }

  function getNextLevelElevation(project) {
    return Math.max(...(project.levels || [DEFAULT_LEVEL]).map(level => finiteNumber(level.elevation, 0) + finiteNumber(level.height, 280) + finiteNumber(level.floorThickness, 20)));
  }

  function duplicateLevel(project, sourceLevelId) {
    const normalized = normalizeProject(project);
    const source = normalized.levels.find(level => level.id === sourceLevelId);
    if (!source) throw new Error('Source level not found.');
    const levelId = getNextLevelId(normalized);
    const level = { ...source, id: levelId, name: (normalized.levels.length + 1) + 'F', elevation: getNextLevelElevation(normalized) };
    const next = JSON.parse(JSON.stringify(normalized));
    next.levels.push(level);
    const idMap = new Map();
    let nextId = getNextObjectId(next);
    const cloneCollection = key => {
      const clones = normalized[key].filter(item => item.levelId === sourceLevelId).map(item => {
        const id = 'obj_' + nextId++;
        idMap.set(item.id, id);
        return { ...item, id, levelId };
      });
      next[key].push(...clones);
    };
    ['walls', 'rooms', 'furnitures', 'dimensions'].forEach(cloneCollection);
    for (const key of ['doors', 'windows']) {
      const clones = normalized[key].filter(item => item.levelId === sourceLevelId).map(item => ({
        ...item, id: 'obj_' + nextId++, levelId, wallId: idMap.get(item.wallId) || item.wallId,
      }));
      next[key].push(...clones);
    }
    next.activeLevelId = levelId;
    return normalizeProject(next);
  }

  function computeFloorPolygons(walls) {
    const epsilon = 0.000001;
    const pointKey = point => point.x.toFixed(6) + ',' + point.y.toFixed(6);
    const points = new Map();
    for (const wall of Array.isArray(walls) ? walls : []) {
      for (const point of [
        { x: finiteNumber(wall.x1, 0), y: finiteNumber(wall.y1, 0) },
        { x: finiteNumber(wall.x2, 0), y: finiteNumber(wall.y2, 0) },
      ]) points.set(pointKey(point), point);
    }

    const edges = new Map();
    for (const wall of Array.isArray(walls) ? walls : []) {
      const start = { x: finiteNumber(wall.x1, 0), y: finiteNumber(wall.y1, 0) };
      const end = { x: finiteNumber(wall.x2, 0), y: finiteNumber(wall.y2, 0) };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= epsilon) continue;
      const cuts = [...points.values()].map(point => {
        const px = point.x - start.x;
        const py = point.y - start.y;
        const cross = Math.abs(px * dy - py * dx);
        const t = (px * dx + py * dy) / lengthSquared;
        return cross <= epsilon * Math.sqrt(lengthSquared) && t >= -epsilon && t <= 1 + epsilon ? Math.max(0, Math.min(1, t)) : null;
      }).filter(value => value != null).sort((a, b) => a - b);
      const uniqueCuts = cuts.filter((value, index) => index === 0 || Math.abs(value - cuts[index - 1]) > epsilon);
      for (let index = 0; index < uniqueCuts.length - 1; index += 1) {
        const a = { x: start.x + dx * uniqueCuts[index], y: start.y + dy * uniqueCuts[index] };
        const b = { x: start.x + dx * uniqueCuts[index + 1], y: start.y + dy * uniqueCuts[index + 1] };
        const aKey = pointKey(a);
        const bKey = pointKey(b);
        if (aKey === bKey) continue;
        points.set(aKey, a); points.set(bKey, b);
        const edgeKey = [aKey, bKey].sort().join('|');
        edges.set(edgeKey, [aKey, bKey]);
      }
    }

    const neighbors = new Map();
    function connect(a, b) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      neighbors.get(a).add(b);
    }
    for (const [a, b] of edges.values()) { connect(a, b); connect(b, a); }
    const sortedNeighbors = new Map([...neighbors].map(([key, values]) => {
      const origin = points.get(key);
      return [key, [...values].sort((a, b) => {
        const pointA = points.get(a); const pointB = points.get(b);
        return Math.atan2(pointA.y - origin.y, pointA.x - origin.x)
          - Math.atan2(pointB.y - origin.y, pointB.x - origin.x);
      })];
    }));

    const visited = new Set();
    const faces = [];
    const halfEdgeKey = (a, b) => a + '>' + b;
    for (const [edgeA, edgeB] of edges.values()) {
      for (const [startA, startB] of [[edgeA, edgeB], [edgeB, edgeA]]) {
        if (visited.has(halfEdgeKey(startA, startB))) continue;
        const path = [];
        let a = startA;
        let b = startB;
        let closed = false;
        for (let step = 0; step <= edges.size * 2; step += 1) {
          const directed = halfEdgeKey(a, b);
          if (visited.has(directed)) break;
          visited.add(directed);
          path.push(a);
          const options = sortedNeighbors.get(b) || [];
          const incomingIndex = options.indexOf(a);
          if (incomingIndex < 0 || !options.length) break;
          const next = options[(incomingIndex - 1 + options.length) % options.length];
          a = b;
          b = next;
          if (a === startA && b === startB) { closed = true; break; }
        }
        if (!closed || path.length < 3) continue;
        const polygon = path.map(key => points.get(key));
        const signedArea = polygon.reduce((sum, point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return sum + point.x * next.y - next.x * point.y;
        }, 0) / 2;
        if (signedArea > epsilon) faces.push(polygon);
      }
    }
    return faces;
  }

  function shouldShowRoof({ buildingViewMode, cutawayMode, walkMode }) {
    return buildingViewMode === 'all' && !cutawayMode && !walkMode;
  }

  function computeFloorArea(walls) {
    const polygons = computeFloorPolygons(walls);
    if (!polygons.length) return null;
    const areaInSquareCentimeters = polygons.reduce((total, polygon) => Math.abs(polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2), 0);
    return areaInSquareCentimeters / 10000;
  }

  function getRotatedFootprint(width, depth, rotation = 0) {
    const w = Math.max(0, finiteNumber(width, 0));
    const d = Math.max(0, finiteNumber(depth, 0));
    const angle = finiteNumber(rotation, 0);
    return {
      w: Number((Math.abs(w * Math.cos(angle)) + Math.abs(d * Math.sin(angle))).toFixed(6)),
      d: Number((Math.abs(w * Math.sin(angle)) + Math.abs(d * Math.cos(angle))).toFixed(6)),
    };
  }

  function getStairRiseLimit(walls, levelId, fallback = 280) {
    const defaultLimit = Math.max(1, finiteNumber(fallback, 280));
    const heights = (Array.isArray(walls) ? walls : [])
      .filter(wall => !levelId || wall.levelId === levelId)
      .map(wall => finiteNumber(wall.height, defaultLimit))
      .filter(height => height > 0);
    return heights.length ? Math.min(defaultLimit, ...heights) : defaultLimit;
  }

  function getPreviousLevel(levels, activeLevelId) {
    const list = Array.isArray(levels) ? levels : [];
    const active = list.find(level => level.id === activeLevelId) || list[0];
    if (!active) return null;
    const activeElevation = finiteNumber(active.elevation, 0);
    const lower = list.filter(level => finiteNumber(level.elevation, 0) < activeElevation)
      .sort((a, b) => finiteNumber(a.elevation, 0) - finiteNumber(b.elevation, 0));
    return lower[lower.length - 1] || null;
  }

  function createHistory({ capture, restore, limit = 50 }) {
    const undoStack = [];
    const redoStack = [];

    function begin() {
      return capture();
    }

    function commit(before) {
      const after = capture();
      if (before === after) return false;
      undoStack.push(before);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
      return true;
    }

    function undo() {
      if (!undoStack.length) return false;
      redoStack.push(capture());
      restore(undoStack.pop());
      return true;
    }

    function redo() {
      if (!redoStack.length) return false;
      undoStack.push(capture());
      restore(redoStack.pop());
      return true;
    }

    function clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    }

    return { begin, commit, undo, redo, clear };
  }

  function computeWallSegments(wall, doors, windows) {
    const dx = (finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0)) / 100;
    const dz = (finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0)) / 100;
    const length = Math.hypot(dx, dz);
    const wallHeight = finiteNumber(wall.height, 280) / 100;
    if (length < 0.001 || wallHeight <= 0) return [];

    const openings = [];
    function addOpening(item, bottom, height) {
      if (item.wallId !== wall.id) return;
      const px = (finiteNumber(item.x, wall.x1) - finiteNumber(wall.x1, 0)) / 100;
      const pz = (finiteNumber(item.y, wall.y1) - finiteNumber(wall.y1, 0)) / 100;
      const along = Math.max(0, Math.min(length, (px * dx + pz * dz) / length));
      const halfWidth = Math.max(0, finiteNumber(item.width, 0) / 200);
      const start = Math.max(0, along - halfWidth);
      const end = Math.min(length, along + halfWidth);
      const openingBottom = Math.max(0, Math.min(wallHeight, bottom));
      const openingTop = Math.max(openingBottom, Math.min(wallHeight, openingBottom + height));
      if (end > start && openingTop > openingBottom) openings.push({ start, end, bottom: openingBottom, top: openingTop });
    }

    doors.forEach(door => addOpening(door, 0, finiteNumber(door.height, 210) / 100));
    windows.forEach(win => addOpening(win, finiteNumber(win.sillHeight, 90) / 100, finiteNumber(win.height, 120) / 100));

    const edges = [...new Set([0, length, ...openings.flatMap(opening => [opening.start, opening.end])])].sort((a, b) => a - b);
    const result = [];
    const round = value => Number(value.toFixed(6));
    for (let index = 0; index < edges.length - 1; index += 1) {
      const start = edges[index];
      const end = edges[index + 1];
      if (end - start < 0.000001) continue;
      const midpoint = (start + end) / 2;
      const blocked = openings
        .filter(opening => midpoint > opening.start && midpoint < opening.end)
        .map(opening => [opening.bottom, opening.top])
        .sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      for (const [bottom, top] of blocked) {
        if (bottom > cursor) result.push({ start: round(start), end: round(end), bottom: round(cursor), top: round(bottom) });
        cursor = Math.max(cursor, top);
      }
      if (cursor < wallHeight) result.push({ start: round(start), end: round(end), bottom: round(cursor), top: round(wallHeight) });
    }
    return result;
  }

  function computeCutawayWallIds(walls, cameraPosition) {
    if (!Array.isArray(walls) || !walls.length) return [];
    const points = walls.flatMap(wall => [
      { x: finiteNumber(wall.x1, 0) / 100, z: finiteNumber(wall.y1, 0) / 100 },
      { x: finiteNumber(wall.x2, 0) / 100, z: finiteNumber(wall.y2, 0) / 100 },
    ]);
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minZ = Math.min(...points.map(point => point.z));
    const maxZ = Math.max(...points.map(point => point.z));
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const viewX = finiteNumber(cameraPosition && cameraPosition.x, centerX) - centerX;
    const viewZ = finiteNumber(cameraPosition && cameraPosition.z, centerZ) - centerZ;

    return walls
      .filter(wall => {
        const midX = (finiteNumber(wall.x1, 0) + finiteNumber(wall.x2, 0)) / 200;
        const midZ = (finiteNumber(wall.y1, 0) + finiteNumber(wall.y2, 0)) / 200;
        return (midX - centerX) * viewX + (midZ - centerZ) * viewZ > 0.000001;
      })
      .map(wall => wall.id)
      .filter(Boolean);
  }

  function computeDoorPose(door, wall) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const centerX = finiteNumber(door.x, wall.x1);
    const centerY = finiteNumber(door.y, wall.y1);
    const width = Math.max(0, finiteNumber(door.width, 90));
    const distanceToStart = Math.hypot(centerX - wall.x1, centerY - wall.y1);
    const distanceToEnd = Math.hypot(centerX - wall.x2, centerY - wall.y2);
    const hingeSide = door.hingeSide === -1 || door.hingeSide === 1
      ? door.hingeSide
      : (distanceToStart <= distanceToEnd ? -1 : 1);
    const hingeX = centerX + ux * width / 2 * hingeSide;
    const hingeY = centerY + uy * width / 2 * hingeSide;
    const openAngle = Math.max(0, Math.min(110, finiteNumber(door.openAngle, 75)));
    const swing = door.swing === -1 ? -1 : 1;
    const rotation = -hingeSide * swing * openAngle * Math.PI / 180;
    const closedX = -hingeSide * ux * width;
    const closedY = -hingeSide * uy * width;
    const openEndX = hingeX + closedX * Math.cos(rotation) - closedY * Math.sin(rotation);
    const openEndY = hingeY + closedX * Math.sin(rotation) + closedY * Math.cos(rotation);
    const round = value => Number(value.toFixed(6));
    return {
      centerX: round(centerX), centerY: round(centerY),
      hingeX: round(hingeX), hingeY: round(hingeY),
      openEndX: round(openEndX), openEndY: round(openEndY),
      hingeSide, openAngle,
    };
  }

  function getOpeningOffset(opening, wall) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const px = finiteNumber(opening.x, wall.x1) - finiteNumber(wall.x1, 0);
    const py = finiteNumber(opening.y, wall.y1) - finiteNumber(wall.y1, 0);
    return Math.max(0, Math.min(length, (px * dx + py * dy) / length));
  }

  function placeOpeningOnWall(opening, wall, requestedOffset) {
    const dx = finiteNumber(wall.x2, 0) - finiteNumber(wall.x1, 0);
    const dy = finiteNumber(wall.y2, 0) - finiteNumber(wall.y1, 0);
    const length = Math.hypot(dx, dy) || 1;
    const halfWidth = Math.max(0, finiteNumber(opening.width, 0) / 2);
    const minOffset = Math.min(halfWidth, length / 2);
    const maxOffset = Math.max(minOffset, length - halfWidth);
    const offset = Math.max(minOffset, Math.min(maxOffset, finiteNumber(requestedOffset, minOffset)));
    const round = value => Number(value.toFixed(6));
    return {
      x: round(finiteNumber(wall.x1, 0) + dx / length * offset),
      y: round(finiteNumber(wall.y1, 0) + dy / length * offset),
      offset: round(offset),
    };
  }

  function hitTestFurniture(furniture, x, y) {
    const dx = finiteNumber(x, 0) - finiteNumber(furniture.x, 0);
    const dy = finiteNumber(y, 0) - finiteNumber(furniture.y, 0);
    const rotation = finiteNumber(furniture.rotation, 0);
    const localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return Math.abs(localX) <= finiteNumber(furniture.w, 0) / 2
      && Math.abs(localY) <= finiteNumber(furniture.d, furniture.h || 0) / 2;
  }

  function normalizeSelectionRect(rect) {
    const start = rect?.start || rect?.a || rect;
    const end = rect?.end || rect?.b || rect;
    const x1 = finiteNumber(start?.x, 0);
    const y1 = finiteNumber(start?.y, 0);
    const x2 = finiteNumber(end?.x, x1);
    const y2 = finiteNumber(end?.y, y1);
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), right: Math.max(x1, x2), bottom: Math.max(y1, y2) };
  }

  function selectionRectContainsPoint(rect, point) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function rotatedBoxCorners(item, width, depth) {
    const x = finiteNumber(item.x, 0);
    const y = finiteNumber(item.y, 0);
    const halfWidth = Math.max(0, finiteNumber(width, 0)) / 2;
    const halfDepth = Math.max(0, finiteNumber(depth, 0)) / 2;
    const rotation = finiteNumber(item.rotation, 0);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]]
      .map(([localX, localY]) => ({ x: x + localX * cos - localY * sin, y: y + localX * sin + localY * cos }));
  }

  function selectionRectContainsObject(rect, type, item) {
    if (type === 'wall' || type === 'dimension') {
      return selectionRectContainsPoint(rect, { x: finiteNumber(item.x1, 0), y: finiteNumber(item.y1, 0) })
        && selectionRectContainsPoint(rect, { x: finiteNumber(item.x2, 0), y: finiteNumber(item.y2, 0) });
    }
    if (type === 'door' || type === 'window') {
      return selectionRectContainsPoint(rect, { x: finiteNumber(item.x, 0), y: finiteNumber(item.y, 0) });
    }
    if (type === 'furniture') {
      return rotatedBoxCorners(item, item.w, item.d ?? item.h).every(point => selectionRectContainsPoint(rect, point));
    }
    if (type === 'stair') {
      return rotatedBoxCorners(item, item.width, item.length).every(point => selectionRectContainsPoint(rect, point));
    }
    if (Number.isFinite(Number(item.x1)) && Number.isFinite(Number(item.y1))
      && Number.isFinite(Number(item.x2)) && Number.isFinite(Number(item.y2))) {
      return selectionRectContainsObject(rect, 'dimension', item);
    }
    if (Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))) {
      const width = item.w ?? item.width;
      const depth = item.d ?? item.length ?? item.h;
      if (width != null && depth != null) return rotatedBoxCorners(item, width, depth).every(point => selectionRectContainsPoint(rect, point));
      return selectionRectContainsPoint(rect, item);
    }
    return false;
  }

  function getVisibleLevelIds(levels, activeLevelId, mode) {
    const list = Array.isArray(levels) ? levels : [];
    if (mode === 'all') return list.map(level => level.id).filter(Boolean);
    const active = list.find(level => level.id === activeLevelId) || list[0];
    if (!active) return [];
    const activeElevation = finiteNumber(active.elevation, 0);
    return list.filter(level => finiteNumber(level.elevation, 0) <= activeElevation).map(level => level.id).filter(Boolean);
  }

  function selectObjectsInRect(project, rect, levelId) {
    const normalizedRect = normalizeSelectionRect(rect);
    const selected = [];
    const sameLevel = item => !levelId || !item.levelId || item.levelId === levelId;
    const add = (type, items) => {
      for (const item of Array.isArray(items) ? items : []) {
        if (sameLevel(item) && item.id && selectionRectContainsObject(normalizedRect, type, item)) selected.push({ type, id: item.id });
      }
    };
    add('wall', project?.walls);
    add('door', project?.doors);
    add('window', project?.windows);
    add('room', project?.rooms);
    add('furniture', project?.furnitures);
    add('dimension', project?.dimensions);
    add('stair', project?.stairs);
    return selected;
  }

  function computeObjectSnap(item, options) {
    const threshold = Math.max(0, finiteNumber(options?.threshold, 12));
    const rawX = finiteNumber(item?.x, 0);
    const rawY = finiteNumber(item?.y, 0);
    const width = Math.max(0, finiteNumber(item?.w, item?.width || 0));
    const depth = Math.max(0, finiteNumber(item?.d, item?.length || 0));
    const walls = Array.isArray(options?.walls) ? options.walls : [];
    const objects = Array.isArray(options?.objects) ? options.objects : [];

    let nearestWall = null;
    for (const wall of walls) {
      const x1 = finiteNumber(wall.x1, 0); const y1 = finiteNumber(wall.y1, 0);
      const dx = finiteNumber(wall.x2, 0) - x1; const dy = finiteNumber(wall.y2, 0) - y1;
      const length = Math.hypot(dx, dy);
      if (length < 0.001) continue;
      const tx = dx / length; const ty = dy / length;
      const nx = -ty; const ny = tx;
      const projection = Math.max(0, Math.min(length, (rawX - x1) * tx + (rawY - y1) * ty));
      const px = x1 + tx * projection; const py = y1 + ty * projection;
      const support = Math.abs(nx) * width / 2 + Math.abs(ny) * depth / 2 + finiteNumber(wall.thickness, 20) / 2;
      for (const side of [-1, 1]) {
        const x = px + nx * support * side; const y = py + ny * support * side;
        const distance = Math.hypot(x - rawX, y - rawY);
        if (distance <= threshold && (!nearestWall || distance < nearestWall.distance)) nearestWall = { x, y, distance, wall };
      }
    }
    if (nearestWall) return {
      x: Number(nearestWall.x.toFixed(6)), y: Number(nearestWall.y.toFixed(6)), kind: 'wall',
      guides: [{ type: 'wall', x1: nearestWall.wall.x1, y1: nearestWall.wall.y1, x2: nearestWall.wall.x2, y2: nearestWall.wall.y2 }],
    };

    function snapAxis(raw, size, axis) {
      let best = null;
      for (const other of objects) {
        const otherCenter = finiteNumber(other[axis], 0);
        const otherSize = Math.max(0, finiteNumber(axis === 'x' ? (other.w ?? other.width) : (other.d ?? other.length), 0));
        for (const position of [otherCenter, otherCenter + (otherSize + size) / 2, otherCenter - (otherSize + size) / 2]) {
          const distance = Math.abs(position - raw);
          if (distance <= threshold && (!best || distance < best.distance)) best = { position, distance, kind: 'object' };
        }
      }
      if (best) return best;
      const grid = Math.max(0, finiteNumber(options?.gridSize, 0));
      if (grid > 0) {
        const position = Math.round(raw / grid) * grid;
        const distance = Math.abs(position - raw);
        if (distance <= threshold) return { position, distance, kind: 'grid' };
      }
      return { position: raw, distance: Infinity, kind: null };
    }

    const snapX = snapAxis(rawX, width, 'x');
    const snapY = snapAxis(rawY, depth, 'y');
    const guides = [];
    if (snapX.kind) guides.push({ type: 'x', value: Number(snapX.position.toFixed(6)) });
    if (snapY.kind) guides.push({ type: 'y', value: Number(snapY.position.toFixed(6)) });
    return {
      x: Number(snapX.position.toFixed(6)), y: Number(snapY.position.toFixed(6)),
      kind: snapX.kind === 'object' || snapY.kind === 'object' ? 'object' : (snapX.kind || snapY.kind), guides,
    };
  }

  function filterFurnitureCatalog(items, category, query) {
    const selectedCategory = category || 'all';
    const term = String(query || '').trim().toLocaleLowerCase();
    return items.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const haystack = (String(item.label || '') + ' ' + String(item.type || '')).toLocaleLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }

  return { CURRENT_VERSION, LOCAL_DRAFT_KEY, DEFAULT_LEVEL, DEFAULT_CEILING, DEFAULT_STYLE, DEFAULT_ARCHITECTURE_STYLE, DEFAULT_RENDER_MODE, RENDER_PRESETS, DEFAULT_LIGHTING_PRESET, LIGHTING_PRESETS, DEFAULT_CAMERA_PRESET, CAMERA_PRESETS, MATERIAL_PRESETS, ROOM_TEMPLATES, FURNITURE_DEFAULTS, STYLE_PRESETS, ARCHITECTURE_PRESETS, shouldShowRoof, normalizeCameraView, computeRenderExportSize, getMaterialRepeat, getDefaultFloorMaterialId, computeGroundingTranslation, computeShadowCameraExtent, computePracticalLightIntensity, applyMaterialBrush, createRoomTemplate, normalizeProject, serializeProject, saveLocalDraft, loadLocalDraft, getNextObjectId, getNextLevelId, getNextLevelElevation, duplicateLevel, computeFloorPolygons, computeFloorArea, getRotatedFootprint, getStairRiseLimit, getPreviousLevel, createHistory, computeWallSegments, computeCutawayWallIds, computeDoorPose, getOpeningOffset, placeOpeningOnWall, hitTestFurniture, getVisibleLevelIds, selectObjectsInRect, computeObjectSnap, filterFurnitureCatalog };
});
