// 3D View - Complete rewrite with materials, lighting, wall holes, first-person walk
(function() {
  let scene, camera, renderer, root, wallGroup, furnGroup, doorGroup, floorGroup, roofGroup, siteGroup, photoLightGroup, ceilingGroup, contactShadowGroup;
  let controls = null;
  let _rebuildTimer = null;
  let ambientLight, dirLight, hemiLight, sunAngle = 60, sunIntensity = 1.0;
  let cutawayMode = true;
  let buildingViewMode = 'active';
  let walkMode = false, walkHeight = 1.6, walkFloorY = 0;
  let moveF = false, moveB = false, moveL = false, moveR = false, moveSpeed = 0.08;
  let yaw = 0, pitch = 0, keysDown = {};
  let furnitureDrag = null;
  let activeFurnitureMaterialPreset = null;
  let activeFurnitureMaterialId = null;
  const textureCache = new Map();
  const furnitureModelCache = new Map();
  const FURNITURE_MODEL_SPECS = {
    coffeeTable: { url: 'assets/models/coffee_table_round_01/coffee_table_round_01_1k.gltf', rotationY: 0 },
    mediaCabinet: { url: 'assets/models/modern_wooden_cabinet/modern_wooden_cabinet_1k.gltf', rotationY: Math.PI },
  };

  function visibleLevels() {
    const levels = State.levels || [ProjectModel.DEFAULT_LEVEL];
    const visibleIds = new Set(ProjectModel.getVisibleLevelIds(levels, State.activeLevelId, buildingViewMode));
    return levels.filter(level => visibleIds.has(level.id));
  }
  function visibleLevelIds() { return new Set(visibleLevels().map(level => level.id)); }
  function isVisibleItem(item) { return !item.levelId || visibleLevelIds().has(item.levelId); }
  function levelElevation(levelId) {
    return ((State.levels || []).find(level => level.id === levelId)?.elevation || 0) / 100;
  }

  function init() {
    const container = document.getElementById("canvas-3d");
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    scene = new THREE.Scene();
    const preset = getStylePreset();
    scene.background = makeSkyTexture(preset.sky);
    scene.fog = new THREE.Fog(preset.sky, 70, 260);
    camera = new THREE.PerspectiveCamera(60, w / h, 0.05, 2000);
    camera.position.set(0, 16, 22);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, ProjectModel.RENDER_PRESETS.realtime.pixelRatioCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.useLegacyLights = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    dirLight = new THREE.DirectionalLight(preset.sun, sunIntensity);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.bias = -0.00035;
    dirLight.shadow.normalBias = 0.025;
    scene.add(dirLight);
    scene.add(dirLight.target);

    hemiLight = new THREE.HemisphereLight(preset.sky, preset.floor, 0.35);
    scene.add(hemiLight);

    root = new THREE.Group();
    scene.add(root);
    floorGroup = new THREE.Group();
    wallGroup = new THREE.Group();
    furnGroup = new THREE.Group();
    doorGroup = new THREE.Group();
    roofGroup = new THREE.Group();
    siteGroup = new THREE.Group();
    photoLightGroup = new THREE.Group();
    ceilingGroup = new THREE.Group();
    contactShadowGroup = new THREE.Group();
    root.add(floorGroup);
    root.add(wallGroup);
    root.add(doorGroup);
    root.add(furnGroup);
    root.add(roofGroup);
    root.add(siteGroup);
    root.add(photoLightGroup);
    root.add(ceilingGroup);
    root.add(contactShadowGroup);

    clearGroup(floorGroup);
    clearGroup(roofGroup);
    clearGroup(siteGroup);
    clearGroup(ceilingGroup);
    clearGroup(contactShadowGroup);
    buildSite();
    visibleLevels().forEach(buildFloor);
    setupControls();
    setupKeyboard();
    animate();
    window.addEventListener("resize", onResize);
  }

  function buildFloor(level) {
    const bounds = getHomeBounds();
    const fw = Math.max(0.5, bounds.maxX - bounds.minX);
    const fd = Math.max(0.5, bounds.maxZ - bounds.minZ);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const currentLevel = level || State.levels.find(item => item.id === State.activeLevelId) || ProjectModel.DEFAULT_LEVEL;
    const baseY = levelElevation(currentLevel.id);
    const floorThickness = Math.max(0.02, (currentLevel.floorThickness || 20) / 100);
    const floorMaterialId = currentLevel.materialId || ProjectModel.getDefaultFloorMaterialId(currentLevel.floorFinish);
    const floorTopMat = makePresetMaterial(floorMaterialId, fw, fd, { photoScannedFloor: true });
    const floorSideMat = mat(getStylePreset().floor, { roughness: 0.92, metalness: 0 });
    const polygons = ProjectModel.computeFloorPolygons(State.walls.filter(wall => wall.levelId === currentLevel.id));
    if (polygons.length) {
      for (const polygon of polygons) {
        // Walls are drawn on their center lines. Expand the slab a little so
        // the floor remains underneath the wall thickness instead of exposing
        // a dark hairline at the wall/floor junction.
        const floorPolygon = expandFloorPolygon(polygon, Math.max(0.045, getAverageWallThickness(currentLevel.id) / 2 + 0.018));
        const shape = new THREE.Shape();
        floorPolygon.forEach((point, index) => {
          const method = index === 0 ? 'moveTo' : 'lineTo';
          shape[method](point.x / 100, -point.y / 100);
        });
        shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: floorThickness, bevelEnabled: false });
        const floor = new THREE.Mesh(geometry, [floorTopMat, floorSideMat]);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = baseY - floorThickness + 0.001;
        floor.receiveShadow = true;
        floorGroup.add(floor);
      }
      return;
    }
    const slabPad = Math.max(0.045, getAverageWallThickness(currentLevel.id) / 2 + 0.018);
    const geometry = new THREE.BoxGeometry(fw + slabPad * 2, floorThickness, fd + slabPad * 2);
    geometry.groups.forEach(group => { group.materialIndex = group.materialIndex === 2 ? 0 : 1; });
    const floor = new THREE.Mesh(geometry, [floorTopMat, floorSideMat]);
    floor.position.set(cx, baseY - floorThickness / 2 + 0.001, cz);
    floor.receiveShadow = true;
    floorGroup.add(floor);
  }

  function makeFloorTexture(finish) {
    const preset = getStylePreset();
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    if (finish === 'wood') {
      for (let y = 0; y < 512; y += 82) {
        const off = (y / 82) % 2 === 0 ? 0 : 74;
        for (let x = -74; x < 512; x += 148) {
          ctx.fillStyle = ((x + off) / 148 + y / 82) % 3 === 0 ? preset.floorAlt : preset.floor;
          ctx.fillRect(x + off, y, 144, 78);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          for (let grain = 12; grain < 140; grain += 22) {
            ctx.beginPath();
            ctx.moveTo(x + off + grain, y + 8);
            ctx.lineTo(x + off + grain + 9, y + 70);
            ctx.stroke();
          }
        }
      }
    } else {
      ctx.fillStyle = finish === 'tile' ? '#d9d7d2' : '#aaa8a3';
      ctx.fillRect(0, 0, 512, 512);
    }
    ctx.strokeStyle = finish === 'concrete' ? 'rgba(255,255,255,0.1)' : 'rgba(40,32,24,0.16)';
    ctx.lineWidth = finish === 'tile' ? 2 : 1;
    const spacing = finish === 'tile' ? 128 : 82;
    for (let x = 0; x < 512; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    if (finish !== 'concrete') for (let y = 0; y < 512; y += (finish === 'tile' ? 128 : 82)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const bounds = getHomeBounds();
    const fw = Math.max(0.5, bounds.maxX - bounds.minX);
    const fd = Math.max(0.5, bounds.maxZ - bounds.minZ);
    const repX = Math.max(1, Math.round(fw / 3));
    const repZ = Math.max(1, Math.round(fd / 3));
    tex.repeat.set(repX, repZ);
    tex.colorSpace = THREE.SRGBColorSpace;
    return configureTexture(tex);
  }

  function configureTexture(texture) {
    if (!texture) return texture;
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || renderPreset.anisotropy;
    texture.anisotropy = Math.min(renderPreset.anisotropy, maxAnisotropy);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  function makePresetTexture(materialId, widthM, depthM) {
    const preset = ProjectModel.MATERIAL_PRESETS[materialId];
    if (!preset) return null;
    const repeat = ProjectModel.getMaterialRepeat(materialId, widthM, depthM);
    const repeatX = Math.max(0.125, repeat.x);
    const repeatY = Math.max(0.125, repeat.y);
    const detail = Math.min(1024, ProjectModel.RENDER_PRESETS[State.renderMode]?.textureDetail || 512);
    const key = ['material-base', materialId, detail].join(':');
    let baseTexture = textureCache.get(key);
    if (baseTexture) {
      const texture = baseTexture.clone();
      texture.repeat.set(repeatX, repeatY);
      texture.userData.surfaceClone = true;
      return configureTexture(texture);
    }
    const c = document.createElement('canvas');
    c.width = c.height = detail;
    const ctx = c.getContext('2d');
    ctx.fillStyle = preset.color;
    ctx.fillRect(0, 0, detail, detail);
    ctx.strokeStyle = preset.colorAlt;
    ctx.lineWidth = Math.max(2, detail / 128);
    if (preset.pattern === 'wood') {
      const boards = preset.boardsPerTile || 4;
      const board = detail / boards;
      const baseColor = new THREE.Color(preset.color);
      const altColor = new THREE.Color(preset.colorAlt);
      for (let row = 0; row < boards; row += 1) {
        const y = row * board;
        const rowColor = baseColor.clone().lerp(altColor, [0.07, 0.17, 0.03, 0.12][row % 4]);
        const highlight = rowColor.clone().lerp(new THREE.Color('#ffffff'), 0.07);
        const gradient = ctx.createLinearGradient(0, y, detail, y + board);
        gradient.addColorStop(0, '#' + rowColor.getHexString());
        gradient.addColorStop(0.48, '#' + highlight.getHexString());
        gradient.addColorStop(1, '#' + rowColor.clone().lerp(altColor, 0.08).getHexString());
        ctx.globalAlpha = 1;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y, detail, board);
        ctx.strokeStyle = 'rgba(48,31,18,0.32)';
        ctx.lineWidth = Math.max(1.2, detail / 420);
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(detail, y + 0.5); ctx.stroke();
        const jointX = row % 2 === 0 ? detail * 0.72 : detail * 0.28;
        ctx.beginPath(); ctx.moveTo(jointX, y); ctx.lineTo(jointX, y + board); ctx.stroke();
        ctx.strokeStyle = 'rgba(73,47,27,0.18)';
        ctx.lineWidth = Math.max(0.7, detail / 700);
        for (let grain = 0; grain < 9; grain += 1) {
          const gy = y + board * (0.12 + grain * 0.09);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          for (let x = 0; x <= detail; x += detail / 8) {
            ctx.lineTo(x, gy + Math.sin((x / detail) * Math.PI * 4 + row + grain * 0.7) * board * 0.035);
          }
          ctx.stroke();
        }
      }
    } else if (preset.pattern === 'stone') {
      const stoneGradient = ctx.createLinearGradient(0, 0, detail, detail);
      stoneGradient.addColorStop(0, preset.color);
      stoneGradient.addColorStop(0.52, '#' + new THREE.Color(preset.color).lerp(new THREE.Color('#ffffff'), 0.08).getHexString());
      stoneGradient.addColorStop(1, preset.color);
      ctx.fillStyle = stoneGradient;
      ctx.fillRect(0, 0, detail, detail);
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = preset.colorAlt;
      for (let y = detail * 0.09; y < detail; y += detail * 0.16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(detail * 0.27, y - detail * 0.06, detail * 0.59, y + detail * 0.07, detail, y - detail * 0.02); ctx.stroke();
      }
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = 'rgba(85,68,48,0.45)';
      ctx.strokeRect(1, 1, detail - 2, detail - 2);
    } else if (preset.pattern === 'fabric') {
      ctx.globalAlpha = 0.22; ctx.lineWidth = Math.max(1, detail / 512);
      for (let p = 0; p < detail; p += detail / 32) {
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, detail); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(detail, p); ctx.stroke();
      }
    } else {
      ctx.globalAlpha = 0.18; ctx.lineWidth = 2;
      for (let i = 0; i < 84; i += 1) {
        const x = (i * 61) % detail; const y = (i * 97) % detail;
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, detail / 256) + (i % 5), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    baseTexture = new THREE.CanvasTexture(c);
    baseTexture.wrapS = baseTexture.wrapT = THREE.RepeatWrapping;
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    configureTexture(baseTexture);
    textureCache.set(key, baseTexture);
    const texture = baseTexture.clone();
    texture.repeat.set(repeatX, repeatY);
    texture.userData.surfaceClone = true;
    return configureTexture(texture);
  }

  function makePresetMaterial(materialId, widthM, depthM, options) {
    const preset = ProjectModel.MATERIAL_PRESETS[materialId];
    if (!preset) return null;
    const map = makePresetTexture(materialId, widthM, depthM);
    const bumpMap = new THREE.CanvasTexture(map.image);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.copy(map.repeat);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumpMap.userData.surfaceClone = true;
    configureTexture(bumpMap);
    const material = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: preset.pattern === 'stone' ? 0.035 : preset.pattern === 'fabric' ? 0.012 : 0.022,
      color: 0xffffff,
      roughness: preset.roughness,
      metalness: preset.metalness,
    });
    if (options?.photoScannedFloor && preset.pbrFloorAsset) applyPhotoScannedFloorMaps(material, preset, widthM, depthM);
    return material;
  }

  function applyPhotoScannedFloorMaps(material, preset, widthM, depthM) {
    const folder = 'assets/materials/' + preset.pbrFloorAsset + '/';
    const files = preset.pbrFiles || { diff: 'diff.jpg', normal: 'normal.jpg', roughness: 'roughness.jpg' };
    const repeatX = Math.max(0.125, widthM / (preset.pbrSizeCm / 100));
    const repeatY = Math.max(0.125, depthM / (preset.pbrSizeCm / 100));
    const load = (file, colorSpace, ready) => {
      new THREE.TextureLoader().load(folder + file, texture => {
        if (material.userData.disposed) { texture.dispose(); return; }
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatX, repeatY);
        texture.colorSpace = colorSpace;
        texture.userData.surfaceClone = true;
        configureTexture(texture);
        ready(texture);
      }, undefined, () => { /* Keep the procedural fallback when a local asset is unavailable. */ });
    };
    load(files.diff, THREE.SRGBColorSpace, texture => {
      if (material.map?.userData?.surfaceClone) material.map.dispose();
      material.map = texture;
      material.color.set(preset.pbrTint || '#ffffff');
      material.needsUpdate = true;
    });
    load(files.normal, THREE.NoColorSpace, texture => {
      if (material.bumpMap?.userData?.surfaceClone) material.bumpMap.dispose();
      material.bumpMap = null;
      material.normalMap = texture;
      material.normalScale = new THREE.Vector2(0.72, 0.72);
      material.needsUpdate = true;
    });
    load(files.roughness, THREE.NoColorSpace, texture => {
      material.roughnessMap = texture;
      material.roughness = 0.92;
      material.needsUpdate = true;
    });
  }

  function getAverageWallThickness(levelId) {
    const walls = State.walls.filter(wall => wall.levelId === levelId);
    if (!walls.length) return 0.2;
    return walls.reduce((sum, wall) => sum + Number(wall.thickness || 20) / 100, 0) / walls.length;
  }

  function expandFloorPolygon(polygon, padding) {
    if (!Array.isArray(polygon) || polygon.length < 3 || padding <= 0) return polygon || [];
    const center = polygon.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    center.x /= polygon.length;
    center.y /= polygon.length;
    return polygon.map(point => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.001) return { ...point };
      const scale = (distance + padding) / distance;
      return { x: center.x + dx * scale, y: center.y + dy * scale };
    });
  }

  function getHomeBounds() {
    let minX = -2.5, maxX = 2.5, minZ = -2.5, maxZ = 2.5;
    const walls = State.walls.filter(isVisibleItem);
    const furnitures = State.furnitures.filter(isVisibleItem);
    if (walls.length) {
      minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
      for (const w of walls) {
        minX = Math.min(minX, w.x1 / 100, w.x2 / 100);
        maxX = Math.max(maxX, w.x1 / 100, w.x2 / 100);
        minZ = Math.min(minZ, w.y1 / 100, w.y2 / 100);
        maxZ = Math.max(maxZ, w.y1 / 100, w.y2 / 100);
      }
    } else if (furnitures.length) {
      minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
      for (const f of furnitures) {
        minX = Math.min(minX, f.x / 100); maxX = Math.max(maxX, f.x / 100);
        minZ = Math.min(minZ, f.y / 100); maxZ = Math.max(maxZ, f.y / 100);
      }
    }
    return { minX, maxX, minZ, maxZ };
  }

  function getLevelBounds(levelId) {
    const walls = State.walls.filter(wall => wall.levelId === levelId);
    if (!walls.length) return getHomeBounds();
    return {
      minX: Math.min(...walls.flatMap(wall => [wall.x1, wall.x2]).map(value => value / 100)),
      maxX: Math.max(...walls.flatMap(wall => [wall.x1, wall.x2]).map(value => value / 100)),
      minZ: Math.min(...walls.flatMap(wall => [wall.y1, wall.y2]).map(value => value / 100)),
      maxZ: Math.max(...walls.flatMap(wall => [wall.y1, wall.y2]).map(value => value / 100)),
    };
  }

  function buildSite() {
    if (!siteGroup) return;
    const bounds = getHomeBounds();
    const vertical = getBuildingVerticalBounds();
    const width = Math.max(12, bounds.maxX - bounds.minX + 12);
    const depth = Math.max(12, bounds.maxZ - bounds.minZ + 12);
    const material = new THREE.MeshStandardMaterial({
      map: makeSiteTexture(),
      color: getStylePreset().ground || '#aeb9ac',
      roughness: 0.96,
      metalness: 0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((bounds.minX + bounds.maxX) / 2, vertical.minY - 0.045, (bounds.minZ + bounds.maxZ) / 2);
    ground.receiveShadow = true;
    ground.userData = { type: 'site-ground' };
    siteGroup.add(ground);
  }

  function makeSiteTexture() {
    const preset = getStylePreset();
    const key = 'site:' + (preset.ground || '#aeb9ac');
    if (textureCache.has(key)) return textureCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = preset.ground || '#aeb9ac';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.11)';
    ctx.lineWidth = 1;
    for (let i = -256; i < 512; i += 48) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(55,65,55,0.08)';
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    tex.colorSpace = THREE.SRGBColorSpace;
    configureTexture(tex);
    textureCache.set(key, tex);
    return tex;
  }

  function makeSkyTexture(skyColor) {
    const key = 'sky:' + skyColor;
    if (textureCache.has(key)) return textureCache.get(key);
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    const top = new THREE.Color(skyColor).lerp(new THREE.Color('#7fa7c4'), 0.34);
    const horizon = new THREE.Color(skyColor).lerp(new THREE.Color('#ffffff'), 0.62);
    const gradient = ctx.createLinearGradient(0, 0, 0, c.height);
    gradient.addColorStop(0, '#' + top.getHexString());
    gradient.addColorStop(0.68, '#' + horizon.getHexString());
    gradient.addColorStop(1, '#' + new THREE.Color(skyColor).getHexString());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, c.width, c.height);
    const glow = ctx.createRadialGradient(c.width * 0.72, c.height * 0.28, 0, c.width * 0.72, c.height * 0.28, c.height * 0.24);
    glow.addColorStop(0, 'rgba(255,244,216,0.72)');
    glow.addColorStop(0.22, 'rgba(255,238,198,0.22)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    textureCache.set(key, texture);
    return texture;
  }

  function buildCeiling(level) {
    const config = level.ceiling || ProjectModel.DEFAULT_CEILING;
    if (!config.enabled || !ceilingGroup) return;
    const bounds = getLevelBounds(level.id);
    const width = Math.max(0.6, bounds.maxX - bounds.minX);
    const depth = Math.max(0.6, bounds.maxZ - bounds.minZ);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const ceilingY = levelElevation(level.id) + (level.height || 280) / 100 - config.drop / 100;
    const thickness = Math.max(0.02, config.thickness / 100);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), mat(config.color, { roughness: 0.92, metalness: 0 }));
    panel.position.set(centerX, ceilingY + thickness / 2, centerZ);
    panel.receiveShadow = true;
    panel.userData = { type: 'ceiling-panel', levelId: level.id };
    ceilingGroup.add(panel);

    const lighting = ProjectModel.LIGHTING_PRESETS[State.lightingPreset] || ProjectModel.LIGHTING_PRESETS.daylight;
    if (config.coveLight) {
      const glowMat = mat(lighting.practicalColor, { emissive: lighting.practicalColor, emissiveIntensity: 1.4, roughness: 0.35 });
      const inset = 0.16;
      const line = 0.025;
      const y = ceilingY - 0.035;
      [[width - inset * 2, line, centerX, bounds.minZ + inset], [width - inset * 2, line, centerX, bounds.maxZ - inset], [line, depth - inset * 2, bounds.minX + inset, centerZ], [line, depth - inset * 2, bounds.maxX - inset, centerZ]].forEach(([w, d, x, z]) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.max(line, w), 0.018, Math.max(line, d)), glowMat);
        strip.position.set(x, y, z);
        strip.userData = { type: 'cove-light', levelId: level.id };
        ceilingGroup.add(strip);
      });
    }

    const count = Math.max(0, Math.min(12, config.downlights || 0));
    const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / columns));
    for (let index = 0; index < count; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = centerX + ((column + 1) / (columns + 1) - 0.5) * width * 0.72;
      const z = centerZ + ((row + 1) / (rows + 1) - 0.5) * depth * 0.72;
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 16), mat(lighting.practicalColor, { emissive: lighting.practicalColor, emissiveIntensity: 1.2, roughness: 0.3 }));
      fixture.position.set(x, ceilingY - 0.018, z);
      fixture.userData = { type: 'downlight', levelId: level.id };
      ceilingGroup.add(fixture);
      if (State.renderMode === 'photo' || State.lightingPreset === 'warmNight') {
        const light = new THREE.PointLight(
          lighting.practicalColor,
          ProjectModel.computePracticalLightIntensity('downlight', Math.max(0.22, lighting.practical * 0.42), State.renderMode),
          4.5,
          2,
        );
        light.position.set(x, ceilingY - 0.08, z);
        ceilingGroup.add(light);
      }
    }
  }

  function buildRoof() {
    if (!roofGroup) return;
    const levels = visibleLevels();
    if (!levels.length) return;
    const top = levels.reduce((highest, level) => (level.elevation || 0) > (highest.elevation || 0) ? level : highest, levels[0]);
    const bounds = getLevelBounds(top.id);
    const architecture = getArchitecturePreset();
    const preset = getStylePreset();
    const eave = Math.max(0.08, architecture.eave || 0.16);
    const roofHeight = Math.max(0.08, architecture.roofHeight || 0.14);
    const width = Math.max(0.6, bounds.maxX - bounds.minX + eave * 2);
    const depth = Math.max(0.6, bounds.maxZ - bounds.minZ + eave * 2);
    const roofBottom = levelElevation(top.id) + (top.height || 280) / 100 + 0.003;
    const topMat = new THREE.MeshStandardMaterial({ map: makeRoofTexture(), color: preset.roof || preset.wood, roughness: 0.8, metalness: 0.02 });
    const sideMat = mat(preset.roof || preset.wood, { roughness: 0.88, metalness: 0 });
    const geometry = new THREE.BoxGeometry(width, roofHeight, depth);
    geometry.groups.forEach(group => { group.materialIndex = group.materialIndex === 2 ? 0 : 1; });
    const roof = new THREE.Mesh(geometry, [topMat, sideMat]);
    roof.position.set((bounds.minX + bounds.maxX) / 2, roofBottom + roofHeight / 2, (bounds.minZ + bounds.maxZ) / 2);
    roof.castShadow = true;
    roof.receiveShadow = true;
    roof.userData = { type: 'roof' };
    roofGroup.add(roof);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(width + 0.025, 0.045, depth + 0.025), sideMat);
    fascia.position.set(roof.position.x, roofBottom - 0.018, roof.position.z);
    fascia.castShadow = true;
    roofGroup.add(fascia);
  }

  function makeRoofTexture() {
    const preset = getStylePreset();
    const key = 'roof:' + (preset.roof || preset.wood);
    if (textureCache.has(key)) return textureCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = preset.roof || preset.wood;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,30,30,0.12)';
    ctx.lineWidth = 1;
    for (let i = -256; i < 512; i += 28) {
      ctx.beginPath(); ctx.moveTo(i + 12, 0); ctx.lineTo(i + 268, 256); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    configureTexture(tex);
    textureCache.set(key, tex);
    return tex;
  }

  function getBuildingVerticalBounds() {
    const levels = visibleLevels();
    if (!levels.length) return { minY: 0, maxY: 3 };
    return {
      minY: Math.min(...levels.map(level => level.elevation || 0)) / 100,
      maxY: Math.max(...levels.map(level => (level.elevation || 0) + (level.height || 280) + (level.floorThickness || 20))) / 100,
    };
  }

  function getFocusVerticalBounds() {
    const active = (State.levels || []).find(level => level.id === State.activeLevelId) || ProjectModel.DEFAULT_LEVEL;
    const minY = levelElevation(active.id);
    return {
      minY,
      maxY: minY + ((active.height || 280) + (active.floorThickness || 20)) / 100,
    };
  }

  function updateSun() {
    const angleRad = (sunAngle * Math.PI) / 180;
    const r = 50;
    const bounds = getHomeBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    dirLight.position.set(r * Math.cos(angleRad), r * Math.sin(angleRad), 25);
    dirLight.position.x += centerX;
    dirLight.position.z += centerZ;
    const shadowExtent = ProjectModel.computeShadowCameraExtent(bounds);
    dirLight.shadow.camera.left = -shadowExtent;
    dirLight.shadow.camera.right = shadowExtent;
    dirLight.shadow.camera.top = shadowExtent;
    dirLight.shadow.camera.bottom = -shadowExtent;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = Math.max(80, shadowExtent * 8);
    dirLight.shadow.camera.updateProjectionMatrix();
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const lighting = ProjectModel.LIGHTING_PRESETS[State.lightingPreset] || ProjectModel.LIGHTING_PRESETS.daylight;
    dirLight.intensity = sunIntensity * renderPreset.sun * lighting.sun;
    dirLight.target.position.set(centerX, 0, centerZ);
  }

  function applyStyleEnvironment() {
    const preset = getStylePreset();
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const lighting = ProjectModel.LIGHTING_PRESETS[State.lightingPreset] || ProjectModel.LIGHTING_PRESETS.daylight;
    const skyTexture = makeSkyTexture(preset.sky);
    scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.backgroundBlurriness = State.renderMode === 'photo' ? 0.12 : 0;
    scene.fog.color.set(preset.sky);
    ambientLight.color.set(0xffffff);
    dirLight.color.set(preset.sun);
    hemiLight.color.set(preset.sky);
    hemiLight.groundColor.set(preset.ground || preset.floor);
    ambientLight.intensity = renderPreset.ambient * lighting.ambient;
    hemiLight.intensity = renderPreset.hemisphere * lighting.hemisphere;
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderPreset.pixelRatioCap));
      renderer.toneMappingExposure = renderPreset.exposure * lighting.exposure * (State.architectureStyle === 'industrial' ? 0.94 : 1);
      const shadowSize = Math.min(renderPreset.shadowMapSize, renderer.capabilities.maxTextureSize || renderPreset.shadowMapSize);
      if (dirLight.shadow.mapSize.width !== shadowSize) {
        dirLight.shadow.mapSize.set(shadowSize, shadowSize);
        dirLight.shadow.map?.dispose();
        dirLight.shadow.map = null;
      }
    }
    updateSun();
  }

  function buildPhotoLights() {
    clearGroup(photoLightGroup);
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const lighting = ProjectModel.LIGHTING_PRESETS[State.lightingPreset] || ProjectModel.LIGHTING_PRESETS.daylight;
    if (!renderPreset.practicalLights && lighting.practical <= 0.2) return;
    visibleLevels().forEach(level => {
      const ceilingY = levelElevation(level.id) + Math.max(2.1, (level.height || 280) / 100 - 0.25);
      const levelWalls = State.walls.filter(wall => wall.levelId === level.id);
      const roomPolygons = ProjectModel.computeFloorPolygons(levelWalls);
      const fallbackBounds = getLevelBounds(level.id);
      const centers = roomPolygons.length
        ? roomPolygons.map(polygon => polygon.reduce((sum, point) => ({ x: sum.x + point.x / 100, z: sum.z + point.y / 100 }), { x: 0, z: 0 }))
          .map((sum, index) => ({ x: sum.x / roomPolygons[index].length, z: sum.z / roomPolygons[index].length }))
        : [{ x: (fallbackBounds.minX + fallbackBounds.maxX) / 2, z: (fallbackBounds.minZ + fallbackBounds.maxZ) / 2 }];
      centers.slice(0, 8).forEach((center, index) => {
        const strength = lighting.practical * (renderPreset.practicalLights ? 1 : 0.65) / Math.max(1, Math.sqrt(centers.length));
        const light = new THREE.PointLight(
          lighting.practicalColor,
          ProjectModel.computePracticalLightIntensity('room', strength, State.renderMode),
          10,
          2,
        );
        light.position.set(center.x, ceilingY, center.z);
        light.castShadow = State.renderMode === 'photo' && index === 0;
        if (light.castShadow) {
          light.shadow.mapSize.set(1024, 1024);
          light.shadow.bias = -0.001;
          light.shadow.normalBias = 0.035;
        }
        light.userData = { type: 'photo-practical-light', levelId: level.id };
        photoLightGroup.add(light);
      });
    });
  }

  function updateCutaway() {
    if (!wallGroup || !doorGroup || !camera) return;
    const hiddenWallIds = cutawayMode && !walkMode
      ? new Set(ProjectModel.computeCutawayWallIds(State.walls.filter(isVisibleItem), camera.position))
      : new Set();
    wallGroup.children.forEach(mesh => { mesh.visible = !hiddenWallIds.has(mesh.userData.wallId); });
    doorGroup.children.forEach(group => { group.visible = !hiddenWallIds.has(group.userData.wallId); });
    if (roofGroup) roofGroup.visible = ProjectModel.shouldShowRoof({ buildingViewMode, cutawayMode, walkMode });
    if (ceilingGroup) ceilingGroup.children.forEach(object => {
      if (object.userData?.type === 'ceiling-panel') object.visible = walkMode || State.cameraPreset === 'eye';
    });
    if (siteGroup) siteGroup.visible = true;
  }

  function onResize() {
    const container = document.getElementById("canvas-3d");
    if (!container || !renderer) return;
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function setupControls() {
    let isDown = false, isPanning = false;
    let lastX = 0, lastY = 0;
    let theta = Math.PI / 4, phi = Math.PI / 3, radius = 12;
    const target = new THREE.Vector3(0, 0, 0);
    const el = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let pendingFurnitureClick = null;

    function setRayFromPointer(e) {
      const rect = el.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    }
    function floorPoint(e) {
      setRayFromPointer(e);
      const point = new THREE.Vector3();
      return raycaster.ray.intersectPlane(floorPlane, point) ? point : null;
    }
    function furnitureRoot(object) {
      let current = object;
      while (current && current !== furnGroup) {
        if (current.userData && current.userData.type === 'furniture') return current;
        current = current.parent;
      }
      return null;
    }
    function pickFurniture(e) {
      if (buildingViewMode === 'all' && State.levels.length > 1) return null;
      setRayFromPointer(e);
      const hit = raycaster.intersectObjects(furnGroup.children, true)[0];
      const group = hit ? furnitureRoot(hit.object) : null;
      if (group && buildingViewMode === 'active' && group.userData.levelId !== State.activeLevelId) return null;
      return group;
    }
    function selectFurniture(group) {
      State.selectedTool = 'select';
      State.dimensionStart = null;
      document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === 'select'));
      if (window.updateToolLabel) window.updateToolLabel();
      State.activeObject = group.userData.id;
      State.activeType = 'furniture';
      if (window.setSelection) window.setSelection([{ id: group.userData.id, type: 'furniture' }]);
      sync3DSelection();
      requestRedraw();
      if (window.renderProps) window.renderProps();
      const status = document.getElementById('status-info');
      if (status) status.textContent = t('message.dragSelected3d');
    }

    el.addEventListener("contextmenu", e => e.preventDefault());

    el.addEventListener("pointerdown", e => {
      if (walkMode) return;
      if (e.button === 0) {
        const group = pickFurniture(e);
        const alreadySelected = group && State.activeType === 'furniture' && State.activeObject === group.userData.id;
        const now = performance.now();
        const isDoubleClick = group && !alreadySelected && pendingFurnitureClick
          && pendingFurnitureClick.id === group.userData.id
          && now - pendingFurnitureClick.time <= 500;
        if (isDoubleClick) {
          pendingFurnitureClick = null;
          selectFurniture(group);
          e.preventDefault();
          return;
        }
        pendingFurnitureClick = group && !alreadySelected
          ? { id: group.userData.id, time: now }
          : null;
        const point = alreadySelected ? floorPoint(e) : null;
        if (alreadySelected && point) {
          furnitureDrag = {
            id: group.userData.id,
            group,
            offsetX: group.position.x - point.x,
            offsetZ: group.position.z - point.z,
            history: beginHistory(),
          };
          el.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      }
      if (e.button === 1 || e.button === 2) {
        isPanning = true; lastX = e.clientX; lastY = e.clientY; e.preventDefault();
      } else if (e.button === 0) {
        isDown = true; lastX = e.clientX; lastY = e.clientY;
      }
    });
    window.addEventListener("pointerup", () => {
      isDown = false; isPanning = false;
      if (furnitureDrag) {
        commitHistory(furnitureDrag.history);
        furnitureDrag = null;
        State.snapGuides = [];
        el.style.cursor = '';
        buildFromState();
      }
    });
    window.addEventListener("pointermove", e => {
      if (walkMode) return;
      if (furnitureDrag) {
        const point = floorPoint(e);
        const furniture = State.furnitures.find(item => item.id === furnitureDrag.id);
        if (point && furniture) {
          const footprint = ProjectModel.getRotatedFootprint(furniture.w, furniture.d || furniture.h, furniture.rotation);
          const raw = { x: (point.x + furnitureDrag.offsetX) * 100, y: (point.z + furnitureDrag.offsetZ) * 100, w: footprint.w, d: footprint.d };
          const snapped = window._tools?.snapObject ? window._tools.snapObject(raw, furniture.id) : raw;
          furniture.x = Math.round(snapped.x);
          furniture.y = Math.round(snapped.y);
          furnitureDrag.group.position.set(furniture.x / 100, levelElevation(furniture.levelId), furniture.y / 100);
          requestRedraw();
          if (window.renderProps) window.renderProps();
        }
      } else if (isPanning) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        const ps = radius * 0.006;
        const r = new THREE.Vector3();
        const u = new THREE.Vector3();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        r.crossVectors(dir, camera.up).normalize();
        u.crossVectors(r, dir).normalize();
        r.multiplyScalar(-dx * ps); u.multiplyScalar(dy * ps);
        target.add(r); target.add(u);
        updateCameraOrbit(target, radius, theta, phi);
      } else if (isDown) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        theta -= dx * 0.005;
        phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, phi - dy * 0.005));
        updateCameraOrbit(target, radius, theta, phi);
      }
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      if (walkMode) return;
      radius = Math.max(3, Math.min(200, radius * (1 + e.deltaY * 0.002)));
      updateCameraOrbit(target, radius, theta, phi);
    }, { passive: false });

    function updateCameraOrbit(t, r, th, ph) {
      camera.position.set(
        t.x + r * Math.sin(ph) * Math.cos(th),
        t.y + r * Math.cos(ph),
        t.z + r * Math.sin(ph) * Math.sin(th)
      );
      camera.lookAt(t);
      updateCutaway();
    }
    function applyCameraPreset(id) {
      const preset = ProjectModel.CAMERA_PRESETS[id] || ProjectModel.CAMERA_PRESETS.isometric;
      const bounds = getHomeBounds();
      const vertical = getBuildingVerticalBounds();
      const focus = buildingViewMode === 'all' ? vertical : getFocusVerticalBounds();
      if (id === 'eye' && buildingViewMode === 'active') {
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const depth = Math.max(1, bounds.maxZ - bounds.minZ);
        const eyeY = focus.minY + Math.min(1.62, Math.max(1.35, (focus.maxY - focus.minY) * 0.56));
        const eye = new THREE.Vector3(bounds.minX - width * 0.08, eyeY, bounds.minZ - depth * 0.08);
        target.set(bounds.minX + width * 0.55, eyeY - 0.28, bounds.minZ + depth * 0.52);
        const delta = eye.clone().sub(target);
        radius = Math.max(0.01, delta.length());
        theta = Math.atan2(delta.z, delta.x);
        phi = Math.acos(Math.max(-1, Math.min(1, delta.y / radius)));
        camera.fov = preset.fov;
        camera.updateProjectionMatrix();
        updateCameraOrbit(target, radius, theta, phi);
        return;
      }
      const visibleHeightFromFocus = Math.max(focus.maxY - vertical.minY, focus.maxY - focus.minY);
      target.set((bounds.minX + bounds.maxX) / 2, (focus.minY + focus.maxY) / 2, (bounds.minZ + bounds.maxZ) / 2);
      radius = Math.max(6, Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, visibleHeightFromFocus) * preset.radiusScale);
      theta = preset.theta;
      phi = preset.phi;
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
      updateCameraOrbit(target, radius, theta, phi);
    }
    function captureView() {
      return { position: camera.position.toArray(), target: target.toArray(), fov: camera.fov };
    }
    function restoreView(view) {
      const normalized = ProjectModel.normalizeCameraView(view);
      if (!normalized) return false;
      target.fromArray(normalized.target);
      const dx = normalized.position[0] - target.x;
      const dy = normalized.position[1] - target.y;
      const dz = normalized.position[2] - target.z;
      radius = Math.max(0.01, Math.hypot(dx, dy, dz));
      theta = Math.atan2(dz, dx);
      phi = Math.acos(Math.max(-1, Math.min(1, dy / radius)));
      camera.fov = normalized.fov;
      camera.updateProjectionMatrix();
      updateCameraOrbit(target, radius, theta, phi);
      return true;
    }
    const fitHome = () => applyCameraPreset(State.cameraPreset || ProjectModel.DEFAULT_CAMERA_PRESET);
    controls = { updateCamera: () => updateCameraOrbit(target, radius, theta, phi), fitHome, resetOrbit: fitHome, applyCameraPreset, captureView, restoreView };
    updateSun();
    controls.updateCamera();
  }

  function setupKeyboard() {
    window.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT") return;
      keysDown[e.code] = true;
      if (walkMode) return;
      // handled in app.js
    });
    window.addEventListener("keyup", e => {
      keysDown[e.code] = false;
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    if (walkMode) {
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const v = new THREE.Vector3();
      if (keysDown["KeyW"] || keysDown["ArrowUp"]) v.add(fwd);
      if (keysDown["KeyS"] || keysDown["ArrowDown"]) v.sub(fwd);
      if (keysDown["KeyD"] || keysDown["ArrowRight"]) v.add(right);
      if (keysDown["KeyA"] || keysDown["ArrowLeft"]) v.sub(right);
      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(moveSpeed);
        camera.position.add(v);
        camera.position.y = walkFloorY + walkHeight;
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    renderer.render(scene, camera);
  }

  function enterWalkMode() {
    walkFloorY = levelElevation(State.activeLevelId);
    walkMode = true;
    updateCutaway();
    camera.position.set(camera.position.x, walkFloorY + walkHeight, camera.position.z);
    renderer.domElement.requestPointerLock?.();
  }
  function exitWalkMode() {
    walkMode = false;
    updateCutaway();
    document.exitPointerLock?.();
  }

  function clearGroup(g) {
    if (!g) return;
    while (g.children.length) disposeObject(g.children.pop());
  }

  function disposeObject(object) {
    if (!object) return;
    object.userData = { ...(object.userData || {}), disposed: true };
    [...(object.children || [])].forEach(disposeObject);
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const disposeMaterial = material => {
        material.userData.disposed = true;
        ['map', 'bumpMap', 'normalMap', 'roughnessMap'].forEach(key => {
          if (material[key]?.userData?.surfaceClone) material[key].dispose();
        });
        material.dispose();
      };
      if (Array.isArray(object.material)) object.material.forEach(disposeMaterial);
      else disposeMaterial(object.material);
    }
  }

  // Project 2D point onto wall -> distance along wall (meters) + perpendicular info
  function projectOnWall(wall, px2d, py2d) {
    const wx1 = wall.x1 / 100, wy1 = wall.y1 / 100;
    const wx2 = wall.x2 / 100, wy2 = wall.y2 / 100;
    const wdx = wx2 - wx1, wdy = wy2 - wy1;
    const wlen = Math.hypot(wdx, wdy);
    if (wlen < 0.001) return null;
    const t = Math.max(0, Math.min(1, ((px2d - wx1) * wdx + (py2d - wy1) * wdy) / (wlen * wlen)));
    const along = t * wlen;
    const cx = (wx1 + wx2) / 2, cz = (wy1 + wy2) / 2;
    const x = wx1 + t * wdx, z = wy1 + t * wdy;
    return { x, z, along, wlen };
  }

  function buildFromState() {
    if (!root) return;
    if (_rebuildTimer) cancelAnimationFrame(_rebuildTimer);
    _rebuildTimer = requestAnimationFrame(() => {
      _rebuildTimer = null;
      applyStyleEnvironment();
      clearGroup(wallGroup); clearGroup(furnGroup); clearGroup(doorGroup);
      clearGroup(floorGroup); clearGroup(roofGroup); clearGroup(siteGroup); clearGroup(ceilingGroup); clearGroup(contactShadowGroup);
      buildSite();
      visibleLevels().forEach(buildFloor);
      visibleLevels().forEach(buildCeiling);
      buildRoof();
      if (!State) return;
      State.walls.filter(isVisibleItem).forEach(w => { if (w.id) buildWall(w); });
      State.furnitures.filter(isVisibleItem).forEach(f => buildFurniture(f));
      State.stairs.filter(isVisibleItem).forEach(buildStair);
      State.doors.filter(isVisibleItem).forEach(d => { if (d.wallId) buildDoor(d); });
      State.windows.filter(isVisibleItem).forEach(w => { if (w.wallId) buildWindow(w); });
      buildPhotoLights();
      updateCutaway();
      sync3DSelection();
    });
  }

  // ---- Wall (reliable BoxGeometry) ----
  function buildWall(w) {
    const baseY = levelElevation(w.levelId);
    const x1 = w.x1 / 100, z1 = w.y1 / 100, x2 = w.x2 / 100, z2 = w.y2 / 100;
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const thick = (w.thickness || 20) / 100;
    const angle = Math.atan2(dz, dx);
    const ux = dx / len, uz = dz / len;
    const wallColor = w.color || getStylePreset().wall;
    const architecture = getArchitecturePreset();
    const trimColor = State.architectureStyle === 'industrial' ? getStylePreset().metal : getStylePreset().wood;
    const segments = ProjectModel.computeWallSegments(
      w,
      State.doors.filter(door => door.levelId === w.levelId),
      State.windows.filter(win => win.levelId === w.levelId),
    );
    buildWallContactShadow(w, len, thick, angle, baseY);
    for (const segment of segments) {
      const width = segment.end - segment.start;
      const height = segment.top - segment.bottom;
      const center = (segment.start + segment.end) / 2;
      const wallMaterial = makePresetMaterial(w.materialId, width, height)
        || new THREE.MeshStandardMaterial({
          map: makeWallTexture(wallColor),
          color: 0xffffff,
          roughness: getStylePreset().wallRoughness || 0.88,
          metalness: 0.0,
        });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, thick),
        wallMaterial,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x1 + ux * center, baseY + segment.bottom + height / 2, z1 + uz * center);
      mesh.rotation.y = -angle;
      mesh.userData = { wallId: w.id, type: "wall" };
      wallGroup.add(mesh);
      if (segment.bottom === 0 && architecture.baseboard > 0) {
        const trimH = Math.min(architecture.baseboard, height);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(width, trimH, thick + 0.035), mat(trimColor, { roughness: 0.65 }));
        trim.position.set(x1 + ux * center, baseY + trimH / 2, z1 + uz * center);
        trim.rotation.y = -angle; trim.userData = { wallId: w.id, type: 'baseboard' }; wallGroup.add(trim);
      }
      if (Math.abs(segment.top - (w.height || 280) / 100) < 0.001 && architecture.crown > 0) {
        const trimH = Math.min(architecture.crown, height);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(width, trimH, thick + 0.04), mat(trimColor, { roughness: 0.65 }));
        trim.position.set(x1 + ux * center, baseY + segment.top - trimH / 2, z1 + uz * center);
        trim.rotation.y = -angle; trim.userData = { wallId: w.id, type: 'crown' }; wallGroup.add(trim);
      }
    }
  }

  function makeContactShadowTexture() {
    const key = 'contact-shadow:soft';
    if (textureCache.has(key)) return textureCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
    gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.82, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    configureTexture(texture);
    textureCache.set(key, texture);
    return texture;
  }

  function contactShadowMaterial(opacity) {
    return new THREE.MeshBasicMaterial({
      color: 0x17120e,
      alphaMap: makeContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
  }

  function buildWallContactShadow(wall, length, thickness, angle, baseY) {
    if (!contactShadowGroup) return;
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(length + 0.12, thickness + 0.22),
      contactShadowMaterial(renderPreset.contactShadowOpacity * 0.7),
    );
    shadow.position.set((wall.x1 + wall.x2) / 200, baseY + 0.007, (wall.y1 + wall.y2) / 200);
    shadow.rotation.x = -Math.PI / 2;
    shadow.rotation.z = -angle;
    shadow.renderOrder = 1;
    shadow.userData = { type: 'wall-contact-shadow', levelId: wall.levelId };
    contactShadowGroup.add(shadow);
  }

  function makeWallTexture(color) {
    const key = 'wall:' + color;
    if (textureCache.has(key)) return textureCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 28; i += 1) {
      const x = (i * 47) % 128;
      const y = (i * 71) % 128;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo((x + 13) % 128, (y + 5) % 128); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    configureTexture(tex);
    textureCache.set(key, tex);
    return tex;
  }

  // ---- Door ----
  // Helper: make a door/window object aligned to a wall, returns a mesh
  function makeAligned(wallObj, widthM, heightM, yCenterM, color, depthFactor) {
    // wall centerline
    const x1 = wallObj.x1/100, z1 = wallObj.y1/100, x2 = wallObj.x2/100, z2 = wallObj.y2/100;
    const dx = x2-x1, dz = z2-z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const thick = (wallObj.thickness || 20)/100;
    // Build in local frame: X along wall, Y up, Z perpendicular
    const g = new THREE.Group();
    const frameT = 0.05;
    // frame border
    const fm = mat(color || 0x6b4f2a, { roughness: 0.7 });
    g.add(mkBox(widthM + frameT*2, heightM + frameT*2, thick*depthFactor, fm, 0, 0, 0));
    // dark opening behind
    g.add(mkBox(widthM, heightM, thick*depthFactor + 0.02, mat(0x111111, {roughness:1}), 0, 0, 0));
    // rotate + position
    const m = new THREE.Mesh(); // placeholder
    g.rotation.y = -angle;
    g.userData = { isDW: true };
    return g;
  }

  function buildDoor(d) {
    const baseY = levelElevation(d.levelId);
    const wall = State.walls.find(w => w.id === d.wallId);
    if (!wall) return;
    const pos = getObjPos(d);
    if (!pos) return;
    const wallH = (wall.height || 280) / 100;
    const wallThick = (wall.thickness || 20) / 100;
    const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
    const dw = (d.width || 90) / 100;
    const dh = Math.min((d.height || 210) / 100, wallH);
    const pose = ProjectModel.computeDoorPose(d, wall);

    // Group at wall centerline, rotated to match wall direction
    const g = new THREE.Group();
    g.position.set(pos.x, baseY, pos.z);
    g.rotation.y = -angle;
    g.userData.wallId = wall.id;

    const architecture = getArchitecturePreset();
    const ft = architecture.frameWidth;
    const fm = mat(getStylePreset().wood, { roughness: 0.7 });

    // Frame strips line the actual wall opening.
    for (const sx of [-1, 1]) {
      g.add(mkBox(ft, dh, wallThick + 0.02, fm, sx*(dw/2+ft/2), dh/2, 0));
    }
    g.add(mkBox(dw + ft*2, ft, wallThick + 0.02, fm, 0, dh + ft/2, 0));
    // Door leaf pivots from the nearest jamb, matching the 2D opening arc.
    const leafW = dw - 0.08;
    const leaf = new THREE.Group();
    leaf.position.x = pose.hingeSide * dw / 2;
    leaf.rotation.y = pose.hingeSide * (d.swing === -1 ? -1 : 1) * pose.openAngle * Math.PI / 180;
    leaf.add(mkBox(leafW, dh - 0.1, 0.035, mat(getStylePreset().wood, {roughness:0.75}), -pose.hingeSide * leafW / 2, (dh-0.1)/2, 0));
    decorateDoorLeaf(leaf, leafW, dh - 0.1, pose.hingeSide, architecture.doorProfile);
    leaf.add(mkSphere(0.025, mat(getStylePreset().metal, {metalness:0.65, roughness:0.25}), -pose.hingeSide * (leafW - 0.12), dh*0.5, 0.035));
    g.add(leaf);

    doorGroup.add(g);
  }

  function decorateDoorLeaf(leaf, width, height, hingeSide, profile) {
    const cx = -hingeSide * width / 2;
    const accent = mat(getStylePreset().metal, { metalness: profile === 'steel' ? 0.65 : 0.15, roughness: 0.45 });
    if (profile === 'groove') {
      for (const x of [-0.22, 0, 0.22]) leaf.add(mkBox(0.012, height * 0.78, 0.012, accent, cx + x * width, height * 0.52, 0.024));
    } else if (profile === 'slatted') {
      for (let y = height * 0.18; y < height * 0.9; y += height * 0.12) leaf.add(mkBox(width * 0.82, 0.018, 0.014, accent, cx, y, 0.024));
    } else if (profile === 'organic') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(width, height) * 0.2, 0.012, 8, 28), accent);
      ring.position.set(cx, height * 0.56, 0.025); leaf.add(ring);
    } else if (profile === 'steel') {
      for (const rotation of [-0.55, 0.55]) {
        const brace = mkBox(width * 0.82, 0.025, 0.018, accent, cx, height * 0.52, 0.026);
        brace.rotation.z = rotation; leaf.add(brace);
      }
    } else if (profile === 'panel') {
      for (const cy of [height * 0.3, height * 0.68]) {
        leaf.add(mkBox(width * 0.66, 0.025, 0.016, accent, cx, cy - height * 0.12, 0.025));
        leaf.add(mkBox(width * 0.66, 0.025, 0.016, accent, cx, cy + height * 0.12, 0.025));
        for (const sx of [-1, 1]) leaf.add(mkBox(0.025, height * 0.24, 0.016, accent, cx + sx * width * 0.33, cy, 0.025));
      }
    }
  }

  function buildWindow(win) {
    const baseY = levelElevation(win.levelId);
    const wall = State.walls.find(w => w.id === win.wallId);
    if (!wall) return;
    const pos = getObjPos(win);
    if (!pos) return;
    const wallH = (wall.height || 280) / 100;
    const wallThick = (wall.thickness || 20) / 100;
    const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
    const ww = (win.width || 120) / 100;
    const wh = Math.min((win.height || 120) / 100, wallH);
    const sill = Math.min((win.sillHeight || 90) / 100, Math.max(0, wallH - wh));
    const wc = sill + wh / 2;

    const g = new THREE.Group();
    g.position.set(pos.x, baseY + wc, pos.z);
    g.rotation.y = -angle;
    g.userData.wallId = wall.id;

    const architecture = getArchitecturePreset();
    const ft = architecture.frameWidth;
    const frameColor = ['japanese', 'nordic', 'american'].includes(State.architectureStyle) ? getStylePreset().wood : getStylePreset().metal;
    const fm = mat(frameColor, { roughness: 0.6 });

    for (const sx of [-1, 1]) g.add(mkBox(ft, wh, wallThick + 0.02, fm, sx*(ww/2+ft/2), 0, 0));
    for (const sy of [-1, 1]) g.add(mkBox(ww + ft*2, ft, wallThick + 0.02, fm, 0, sy*(wh/2+ft/2), 0));
    // Glass (transparent, fills opening)
    const glass = mkBox(ww - ft*2, wh - ft*2, 0.015, new THREE.MeshPhysicalMaterial({
      color: 0xc8e4ef,
      transparent: true,
      opacity: 0.42,
      transmission: 0.32,
      thickness: 0.012,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }), 0, 0, wallThick/2 + 0.012);
    glass.castShadow = false;
    glass.receiveShadow = false;
    glass.renderOrder = 2;
    g.add(glass);
    // Style-specific mullion geometry, not a color filter.
    const addVertical = x => g.add(mkBox(Math.max(0.012, ft * 0.45), wh - ft*2, 0.012, fm, x, 0, wallThick/2 + 0.02));
    const addHorizontal = y => g.add(mkBox(ww - ft*2, Math.max(0.012, ft * 0.45), 0.012, fm, 0, y, wallThick/2 + 0.02));
    if (architecture.mullions === 1) addVertical(0);
    if (architecture.mullions === 2) { addVertical(0); addHorizontal(0); }
    if (architecture.mullions === 4) {
      for (const x of [-ww/4, 0, ww/4]) addVertical(x);
      for (const y of [-wh/4, 0, wh/4]) addHorizontal(y);
    }
    // Sill (small ledge below)
    g.add(mkBox(ww + 0.1, 0.04, 0.06, mat(0x555555, {roughness:0.7}), 0, -wh/2 - 0.02, wallThick/2 + 0.03));

    doorGroup.add(g);
  }
  function mkBox(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function mkRoundedBox(w, h, d, radius, material) {
    const safeRadius = Math.max(0.005, Math.min(radius, w / 5, h / 5));
    const shape = new THREE.Shape();
    const left = -w / 2; const right = w / 2; const bottom = -h / 2; const top = h / 2;
    shape.moveTo(left + safeRadius, bottom);
    shape.lineTo(right - safeRadius, bottom);
    shape.quadraticCurveTo(right, bottom, right, bottom + safeRadius);
    shape.lineTo(right, top - safeRadius);
    shape.quadraticCurveTo(right, top, right - safeRadius, top);
    shape.lineTo(left + safeRadius, top);
    shape.quadraticCurveTo(left, top, left, top - safeRadius);
    shape.lineTo(left, bottom + safeRadius);
    shape.quadraticCurveTo(left, bottom, left + safeRadius, bottom);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: true,
      bevelSegments: State.renderMode === 'photo' ? 3 : 2,
      bevelSize: safeRadius * 0.34,
      bevelThickness: Math.min(safeRadius * 0.34, d * 0.12),
      curveSegments: State.renderMode === 'photo' ? 8 : 5,
      steps: 1,
    });
    geometry.translate(0, 0, -d / 2);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  function mkSphere(r, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), material);
    m.position.set(x, y, z);
    return m;
  }

  function buildStair(stair) {
    const current = State.levels.find(level => level.id === stair.levelId) || ProjectModel.DEFAULT_LEVEL;
    const target = State.levels.find(level => level.id === stair.toLevelId);
    const desiredRise = ((target?.elevation ?? (current.elevation + current.height + current.floorThickness)) - current.elevation) / 100;
    const riseLimit = ProjectModel.getStairRiseLimit(State.walls, stair.levelId, current.height) / 100;
    const totalRise = Math.max(0.01, Math.min(desiredRise, riseLimit));
    const stepCount = Math.max(2, Math.round(stair.stepCount || 16));
    const width = Math.max(0.5, (stair.width || 100) / 100);
    const length = Math.max(1, (stair.length || 300) / 100);
    const group = new THREE.Group();
    const material = mat(getStylePreset().wood, { roughness: 0.78 });
    for (let index = 0; index < stepCount; index += 1) {
      const depth = length / stepCount;
      const height = totalRise * (index + 1) / stepCount;
      const step = mkBox(width, height, depth, material, 0, height / 2, -length / 2 + depth * (index + 0.5));
      group.add(step);
    }
    group.position.set((stair.x || 0) / 100, levelElevation(stair.levelId), (stair.y || 0) / 100);
    group.rotation.y = -(stair.rotation || 0);
    group.userData = { id: stair.id, type: 'stair', levelId: stair.levelId };
    furnGroup.add(group);
  }

  // ---- Furniture ----  // ---- Furniture ----
  function defaultFurnitureColor(type) {
    const preset = getStylePreset();
    if (['sofa', 'lamp'].includes(type)) return preset.fabric;
    if (['fridge', 'tv', 'stove', 'washer'].includes(type)) return preset.metal;
    if (type === 'plant') return preset.accent;
    return preset.wood;
  }

  function buildFurniture(f) {
    const g = new THREE.Group();
    g.userData = { id: f.id, type: 'furniture', levelId: f.levelId };
    g.position.set(f.x / 100, levelElevation(f.levelId) + Math.max(0, Number(f.elevation) || 0) / 100, f.y / 100);
    g.rotation.y = -(f.rotation || 0);
    const materialPreset = ProjectModel.MATERIAL_PRESETS[f.materialId];
    const col = f.color || materialPreset?.color || defaultFurnitureColor(f.type);
    activeFurnitureMaterialPreset = materialPreset || null;
    activeFurnitureMaterialId = materialPreset ? f.materialId : null;
    switch (f.type) {
      case "sofa": buildSofa(g, f, col); break;
      case "bed": buildBed(g, f, col); break;
      case "table": buildTable(g, f, col); break;
      case "wardrobe": buildWardrobe(g, f, col); break;
      case "toilet": buildToilet(g, f, col); break;
      case "bathtub": buildBathtub(g, f, col); break;
      case "desk": buildDesk(g, f, col); break;
      case "plant": buildPlant(g, f, col); break;
      case "cabinet": buildCabinet(g, f, col); break;
      case "fridge": buildFridge(g, f, col); break;
      case "tv": buildTV(g, f, col); break;
      case "lamp": buildLamp(g, f, col); break;
      case "stove": buildStove(g, f, col); break;
      case "sink": buildSink(g, f, col); break;
      case "washer": buildWasher(g, f, col); break;
      default: buildBox(g, f, col); break;
    }
    groundFurnitureGroup(g);
    activeFurnitureMaterialPreset = null;
    activeFurnitureMaterialId = null;
    addFurnitureContactShadow(g, f);
    addFurnitureSelectionRing(g, f);
    furnGroup.add(g);
    queueCatalogFurnitureModel(g, f);
  }

  function getFurnitureModelSpec(furniture) {
    if (furniture.type === 'table' && Number(furniture.h || 75) <= 55) return FURNITURE_MODEL_SPECS.coffeeTable;
    if (furniture.type === 'cabinet' && Number(furniture.w || 80) >= 120) return FURNITURE_MODEL_SPECS.mediaCabinet;
    return null;
  }

  function loadCatalogFurnitureModel(spec) {
    if (furnitureModelCache.has(spec.url)) return furnitureModelCache.get(spec.url);
    const promise = Promise.resolve(window.modelLoaderReady)
      .then(LoaderClass => new Promise((resolve, reject) => new LoaderClass().load(spec.url, gltf => resolve(gltf.scene), undefined, reject)));
    furnitureModelCache.set(spec.url, promise);
    return promise;
  }

  function cloneCatalogFurnitureModel(source) {
    const clone = source.clone(true);
    clone.traverse(object => {
      if (!object.isMesh) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
      object.castShadow = true;
      object.receiveShadow = true;
    });
    return clone;
  }

  function queueCatalogFurnitureModel(group, furniture) {
    const spec = getFurnitureModelSpec(furniture);
    if (!spec || !window.modelLoaderReady) return;
    loadCatalogFurnitureModel(spec).then(source => {
      if (group.userData.disposed || !group.parent) return;
      const model = cloneCatalogFurnitureModel(source);
      model.rotation.y = spec.rotationY || 0;
      model.updateMatrixWorld(true);
      const rawBounds = new THREE.Box3().setFromObject(model);
      const rawSize = rawBounds.getSize(new THREE.Vector3());
      const target = {
        x: Math.max(0.1, Number(furniture.w || 60) / 100),
        y: Math.max(0.1, Number(furniture.h || 60) / 100),
        z: Math.max(0.1, Number(furniture.d || 60) / 100),
      };
      const scale = Math.min(target.x / Math.max(0.001, rawSize.x), target.y / Math.max(0.001, rawSize.y), target.z / Math.max(0.001, rawSize.z));
      model.scale.multiplyScalar(scale);
      model.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      const center = scaledBounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.y -= scaledBounds.min.y;
      model.position.z -= center.z;
      [...group.children].forEach(child => {
        const keep = child.name === 'selection-ring' || child.userData?.type === 'furniture-contact-shadow';
        if (!keep) { group.remove(child); disposeObject(child); }
      });
      model.userData = { ...model.userData, type: 'catalog-model' };
      group.add(model);
    }).catch(() => { /* The procedural furniture remains as the offline-safe fallback. */ });
  }

  function groundFurnitureGroup(group) {
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    group.children.filter(child => child.isMesh).forEach(child => bounds.expandByObject(child));
    if (bounds.isEmpty()) return 0;
    const localMinY = bounds.min.y - group.position.y;
    const translation = ProjectModel.computeGroundingTranslation(localMinY);
    if (translation) group.children.forEach(child => { child.position.y += translation; });
    return translation;
  }

  function addFurnitureContactShadow(group, furniture) {
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const width = Math.max(0.2, (furniture.w || 60) / 100);
    const depth = Math.max(0.2, (furniture.d || 60) / 100);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), contactShadowMaterial(renderPreset.contactShadowOpacity));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.renderOrder = 1;
    shadow.userData = { type: 'furniture-contact-shadow' };
    group.add(shadow);
  }

  function addFurnitureSelectionRing(group, furniture) {
    const w = (furniture.w || 60) / 100 + 0.08;
    const d = (furniture.d || 60) / 100 + 0.08;
    const points = [
      new THREE.Vector3(-w/2, 0.018, -d/2), new THREE.Vector3(w/2, 0.018, -d/2),
      new THREE.Vector3(w/2, 0.018, d/2), new THREE.Vector3(-w/2, 0.018, d/2),
    ];
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x0071e3 }));
    ring.name = 'selection-ring';
    ring.visible = State.activeType === 'furniture' && State.activeObject === furniture.id;
    group.add(ring);
  }

  function sync3DSelection() {
    if (!furnGroup) return;
    furnGroup.children.forEach(group => {
      const ring = group.getObjectByName('selection-ring');
      if (ring) ring.visible = State.activeType === 'furniture' && State.activeObject === group.userData.id;
    });
  }

  function mat(color, opts) {
    const usesActiveSurface = activeFurnitureMaterialId && color != null
      && new THREE.Color(color).getHex() === new THREE.Color(activeFurnitureMaterialPreset.color).getHex();
    const texture = usesActiveSurface ? getFurnitureSurfaceTexture(activeFurnitureMaterialId) : null;
    return new THREE.MeshStandardMaterial({
      color,
      map: texture,
      roughness: activeFurnitureMaterialPreset?.roughness ?? 0.7,
      metalness: activeFurnitureMaterialPreset?.metalness ?? 0.05,
      ...(opts || {}),
    });
  }

  function getFurnitureSurfaceTexture(materialId) {
    const detail = ProjectModel.RENDER_PRESETS[State.renderMode]?.textureDetail || 512;
    const key = ['furniture-material', materialId, detail].join(':');
    if (textureCache.has(key)) return textureCache.get(key);
    const texture = makePresetTexture(materialId, 1, 1);
    texture.userData.surfaceClone = false;
    textureCache.set(key, texture);
    return texture;
  }

  function buildBox(g, f, col) {
    const w = (f.w || 60) / 100, d = (f.d || 60) / 100, h = (f.h || 60) / 100;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0xaaaaaa));
    m.position.y = h / 2; m.castShadow = true; g.add(m);
  }

  function buildSofa(g, f, col) {
    const w = (f.w || 180) / 100, d = (f.d || 85) / 100;
    const profile = getStylePreset().furnitureProfile;
    const sh = { low:0.32, tapered:0.38, floor:0.24, organic:0.34, frame:0.35, classic:0.46 }[profile];
    const bh = { low:0.34, tapered:0.42, floor:0.3, organic:0.38, frame:0.4, classic:0.5 }[profile];
    const legH = profile === 'floor' ? 0.025 : profile === 'classic' ? 0.05 : 0.11;
    const armW = profile === 'floor' ? 0 : Math.min(w * (profile === 'classic' ? 0.1 : 0.045), profile === 'classic' ? 0.16 : 0.075);
    const base = mkRoundedBox(w, 0.12, d, 0.025, mat(profile === 'frame' ? getStylePreset().metal : getStylePreset().wood));
    base.position.y = legH + 0.06; base.castShadow = true; g.add(base);
    const cushionCount = w > 1.5 ? 3 : 2;
    for (let i = 0; i < cushionCount; i += 1) {
      const cushionW = (w - armW * 2 - 0.05) / cushionCount;
      const cushion = mkRoundedBox(cushionW - 0.015, sh, d - 0.11, 0.035, mat(col || 0x8b6f47, { roughness: profile === 'organic' ? 0.95 : 0.78 }));
      cushion.position.set(-w/2 + armW + cushionW*(i+0.5), legH + 0.12 + sh/2, 0.035); cushion.castShadow = true; g.add(cushion);
    }
    const backCount = cushionCount;
    const backW = (w - armW * 2 - 0.04) / backCount;
    for (let i = 0; i < backCount; i += 1) {
      const back = mkRoundedBox(backW - 0.018, bh, profile === 'classic' ? 0.16 : 0.11, 0.035, mat(col || 0x7a5c3a, { roughness: 0.86 }));
      back.position.set(-w / 2 + armW + backW * (i + 0.5), legH + 0.12 + sh + bh / 2 - 0.08, -d / 2 + 0.08);
      back.rotation.x = -0.08;
      g.add(back);
    }
    if (armW > 0.02) {
      for (const sx of [-1, 1]) {
        const arm = mkRoundedBox(armW, sh * 0.72, d - 0.05, 0.02, mat(col || 0x7a5c3a));
        arm.position.set(sx * (w / 2 - armW / 2), legH + 0.12 + sh * 0.36, 0); g.add(arm);
      }
    }
    if (legH > 0.03) for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) for (const lz of [-d / 2 + 0.09, d / 2 - 0.09]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, profile === 'tapered' ? 0.022 : 0.012, legH, 8), mat(profile === 'frame' || profile === 'low' ? getStylePreset().metal : getStylePreset().wood));
      leg.position.set(lx, legH/2, lz); g.add(leg);
    }
    if (w > 1.35) for (const sx of [-1, 1]) {
      const pillow = mkRoundedBox(Math.min(0.34, w * 0.19), 0.3, 0.1, 0.045, mat(sx < 0 ? '#ded4c6' : '#8b9b91', { roughness: 0.94 }));
      pillow.position.set(sx * (w * 0.34), legH + 0.12 + sh + 0.12, -d * 0.2);
      pillow.rotation.z = sx * 0.12;
      g.add(pillow);
    }
  }

  function buildBed(g, f, col) {
    const w = (f.w || 160) / 100, d = (f.d || 200) / 100, frameH = 0.2;
    const profile = getStylePreset().furnitureProfile;
    const frame = mkRoundedBox(w, frameH, d, 0.025, mat(col || 0x8b6f47));
    frame.position.y = frameH / 2; frame.castShadow = true; g.add(frame);
    const mattress = mkRoundedBox(w - 0.04, 0.18, d - 0.04, 0.035, mat(0xfaf5ef, { roughness: 0.92 }));
    mattress.position.y = frameH + 0.09; g.add(mattress);
    const headH = { low:0.55, tapered:0.72, floor:0.46, organic:0.62, frame:0.74, classic:0.88 }[profile];
    const head = new THREE.Mesh(new THREE.BoxGeometry(w, headH, profile === 'classic' ? 0.11 : 0.055), mat(col || 0x6b4f2a));
    head.position.set(0, headH/2 + frameH, -d / 2 + 0.03); g.add(head);
    if (profile === 'floor') for (const x of [-0.36,-0.18,0,0.18,0.36]) {
      const slat = mkBox(0.025, headH * 0.8, 0.018, mat(getStylePreset().wood), x*w, frameH + headH/2, -d/2 - 0.006); g.add(slat);
    }
    const duvet = mkRoundedBox(w - 0.08, 0.11, d * 0.62, 0.045, mat('#e9e2d8', { roughness: 0.96 }));
    duvet.position.set(0, frameH + 0.23, d * 0.13); g.add(duvet);
    for (const sx of [-1, 1]) {
      const pillow = mkRoundedBox(w * 0.38, 0.09, 0.3, 0.04, mat(0xfaf8f3, { roughness: 0.98 }));
      pillow.position.set(sx * w * 0.22, frameH + 0.25, -d / 2 + 0.23); pillow.rotation.y = sx * 0.04; g.add(pillow);
    }
  }

  function buildTable(g, f, col) {
    const w = (f.w || 120) / 100, d = (f.d || 80) / 100, h = (f.h || 75) / 100, topH = h * 0.06;
    const profile = getStylePreset().furnitureProfile;
    const top = mkRoundedBox(w, topH, d, Math.min(0.025, topH * 0.35), mat(col || 0xa0522d, { roughness: 0.56 }));
    top.position.y = h - topH / 2; top.castShadow = true; g.add(top);
    const legMat = mat(profile === 'low' || profile === 'frame' ? getStylePreset().metal : getStylePreset().wood, { metalness: profile === 'frame' ? 0.55 : 0.05 });
    if (profile === 'frame') {
      for (const lx of [-w * 0.32, w * 0.32]) g.add(mkBox(0.035, h - topH, d * 0.72, legMat, lx, (h-topH)/2, 0));
    } else if (profile === 'organic') {
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(w*0.12, w*0.2, h-topH, 20), legMat);
      pedestal.position.y = (h-topH)/2; g.add(pedestal);
    } else {
      const legR = Math.max(0.015, w * 0.018);
      for (const lx of [-w / 2 + 0.06, w / 2 - 0.06]) for (const lz of [-d / 2 + 0.06, d / 2 - 0.06]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR * 0.65, legR, h - topH, 8), legMat);
        leg.position.set(lx, (h - topH) / 2, lz); g.add(leg);
      }
    }
  }

  function buildWardrobe(g, f, col) {
    const w = (f.w || 180) / 100, d = (f.d || 60) / 100, h = (f.h || 200) / 100;
    const profile = getStylePreset().furnitureProfile;
    const body = mkRoundedBox(w, h, d, 0.018, mat(col || 0x8b5a2b));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const doorW = w / 2 - 0.02;
    for (const sx of [-1, 1]) {
      const door = mkRoundedBox(doorW, h - 0.07, 0.024, 0.008, mat(col ? new THREE.Color(col).multiplyScalar(0.85) : 0x6b3a1a));
      door.position.set(sx * w / 4, h / 2, d / 2 + 0.01); g.add(door);
      const handle = mkBox(profile === 'classic' ? 0.035 : 0.018, profile === 'classic' ? 0.09 : h * 0.34, 0.018, mat(getStylePreset().metal, { metalness: 0.65, roughness: 0.3 }), sx * 0.045, h * 0.52, d / 2 + 0.032);
      g.add(handle);
      if (profile === 'classic') {
        for (const y of [h*0.28,h*0.68]) g.add(mkBox(doorW*0.72, 0.018, 0.012, mat(getStylePreset().wood), sx*w/4, y, d/2+0.035));
      }
    }
    if (profile === 'floor') for (let x = -w*0.42; x <= w*0.42; x += w*0.12) g.add(mkBox(0.018, h*0.88, 0.012, mat(getStylePreset().wood), x, h/2, d/2+0.04));
  }

  function buildToilet(g, f, col) {
    const w = (f.w || 40) / 100, d = (f.d || 60) / 100;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.03, 0.35, 16), mat(0xffffff));
    base.position.y = 0.175; base.castShadow = true; g.add(base);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.02, w / 2, 0.12, 16), mat(0xf8f8f8));
    bowl.position.y = 0.41; g.add(bowl);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.35, 0.12), mat(0xffffff));
    tank.position.set(0, 0.5, -d / 2 + 0.06); g.add(tank);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.02, 0.02, 8, 16), mat(0xeeeeee));
    seat.rotation.x = Math.PI / 2; seat.position.y = 0.48; g.add(seat);
  }

  function buildBathtub(g, f, col) {
    const w = (f.w || 170) / 100, d = (f.d || 70) / 100, h = (f.h || 55) / 100;
    const base = mkRoundedBox(w, h, d, 0.09, mat(0xf8f7f4, { roughness: 0.32 }));
    base.position.y = h / 2; base.castShadow = true; g.add(base);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.18, d - 0.18), new THREE.MeshPhysicalMaterial({ color: 0x91c1cc, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0, transmission: 0.22 }));
    water.rotation.x = -Math.PI / 2; water.position.y = h + 0.008; g.add(water);
    const rimMat = mat(0xffffff, { roughness: 0.28 });
    const rimFront = mkRoundedBox(w, 0.055, 0.07, 0.018, rimMat); rimFront.position.set(0, h + 0.027, d / 2 - 0.035); g.add(rimFront);
    const rimBack = mkRoundedBox(w, 0.055, 0.07, 0.018, rimMat); rimBack.position.set(0, h + 0.027, -d / 2 + 0.035); g.add(rimBack);
    for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) {
      const side = mkRoundedBox(0.07, 0.055, d - 0.12, 0.018, rimMat); side.position.set(x, h + 0.027, 0); g.add(side);
    }
  }

  function buildDesk(g, f, col) {
    const w = (f.w || 120) / 100, d = (f.d || 60) / 100, h = (f.h || 75) / 100, topH = h * 0.05;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), mat(col || 0x6b4f2a));
    top.position.y = h - topH / 2; g.add(top);
    for (const lx of [-w / 2 + 0.05, w / 2 - 0.05]) for (const lz of [-d / 2 + 0.05, d / 2 - 0.05]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - topH, 0.03), mat(0x333333));
      leg.position.set(lx, (h - topH) / 2, lz); g.add(leg);
    }
  }

  function buildPlant(g, f, col) {
    const w = (f.w || 30) / 100, h = (f.h || 100) / 100, potH = h * 0.25;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.28, potH, 16), mat(getStylePreset().accent, { roughness: 0.9 }));
    pot.position.y = potH / 2; g.add(pot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h * 0.55, 8), mat(0x556b3f, { roughness: 0.96 }));
    stem.position.y = potH + h * 0.27; g.add(stem);
    const leafMat = mat(0x3f6d4a, { roughness: 0.95, side: THREE.DoubleSide });
    for (let i = 0; i < 11; i += 1) {
      const angle = i * 2.399;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(w * 0.18, 12, 8), leafMat);
      leaf.scale.set(0.55, 2.2 + (i % 3) * 0.25, 0.34);
      leaf.position.set(Math.cos(angle) * w * 0.28, potH + h * (0.42 + (i % 4) * 0.09), Math.sin(angle) * w * 0.28);
      leaf.rotation.z = Math.cos(angle) * 0.65; leaf.rotation.x = Math.sin(angle) * 0.65; g.add(leaf);
    }
  }

  function buildCabinet(g, f, col) {
    const w = (f.w || 80) / 100, d = (f.d || 50) / 100, h = (f.h || 90) / 100;
    const body = mkRoundedBox(w, h - 0.05, d, 0.018, mat(col || 0xc9b896));
    body.position.y = (h - 0.05) / 2 + 0.05; body.castShadow = true; g.add(body);
    const plinth = mkRoundedBox(w * 0.88, 0.05, d * 0.82, 0.01, mat(0x383633, { roughness: 0.7 })); plinth.position.y = 0.025; g.add(plinth);
    const door = mkRoundedBox(w - 0.035, h * 0.72, 0.022, 0.008, mat(col || 0xc9b896)); door.position.set(0, h * 0.52, d / 2 + 0.012); g.add(door);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.012, 0.015), mat(getStylePreset().metal, { metalness: 0.65, roughness: 0.3 }));
    handle.position.set(0, h * 0.6, d / 2 + 0.01); g.add(handle);
  }

  function buildFridge(g, f, col) {
    const w = (f.w || 70) / 100, d = (f.d || 70) / 100, h = (f.h || 180) / 100;
    const body = mkRoundedBox(w, h, d, 0.025, mat(col || getStylePreset().metal, { metalness: 0.32, roughness: 0.32 }));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.005, 0.005, d + 0.005), mat(0x999999));
    seam.position.y = h * 0.6; g.add(seam);
    for (const fy of [0.3, 0.8]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.025), mat(0x444444, { metalness: 0.4 }));
      handle.position.set(w / 2 - 0.03, h * fy, d / 2 + 0.01); g.add(handle);
    }
  }

  function buildTV(g, f, col) {
    const w = (f.w || 120) / 100, h = (f.h || 70) / 100, d = (f.d || 8) / 100;
    const screen = mkRoundedBox(w, h, d, 0.018, mat(col || getStylePreset().metal, { metalness: 0.28, roughness: 0.24 }));
    screen.position.set(0, h / 2 + 0.48, 0); g.add(screen);
    const bezel = mkRoundedBox(w - 0.024, h - 0.024, d + 0.012, 0.012, new THREE.MeshPhysicalMaterial({ color: 0x101318, roughness: 0.08, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }));
    bezel.position.copy(screen.position); g.add(bezel);
    const stand = mkRoundedBox(w * 0.38, 0.035, d + 0.14, 0.012, mat(0x26292d, { metalness: 0.55, roughness: 0.26 }));
    stand.position.set(0, 0.018, 0); g.add(stand);
    const neck = mkRoundedBox(0.055, 0.46, 0.04, 0.01, mat(0x26292d, { metalness: 0.55, roughness: 0.26 }));
    neck.position.set(0, 0.25, 0); g.add(neck);
  }

  function buildLamp(g, f, col) {
    const h = (f.h || 150) / 100, r = (f.w || 25) / 100;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.6, 0.03, 12), mat(0x333333));
    base.position.y = 0.015; g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.2, 8), mat(0x555555, { metalness: 0.4 }));
    pole.position.y = (h - 0.2) / 2 + 0.03; g.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(r, 0.18, 16, 1, true), mat(col || 0xfff8e0, { side: THREE.DoubleSide, emissive: col || 0xfff8e0, emissiveIntensity: 0.4 }));
    shade.position.y = h - 0.12; g.add(shade);
    const bulbPoint = new THREE.PointLight(0xfff0d0, ProjectModel.computePracticalLightIntensity('lamp', 1, State.renderMode), 4, 2);
    bulbPoint.position.y = h - 0.2; g.add(bulbPoint);
  }

  function buildStove(g, f, col) {
    const w = (f.w || 60) / 100, d = (f.d || 60) / 100, h = (f.h || 85) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || getStylePreset().metal, { metalness: 0.3, roughness: 0.5 }));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    for (const px of [-0.12, 0.12]) for (const pz of [-0.12, 0.12]) {
      const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), mat(0x111111));
      burner.position.set(px, h + 0.005, pz); g.add(burner);
    }
  }

  function buildSink(g, f, col) {
    const w = (f.w || 60) / 100, d = (f.d || 50) / 100, h = (f.h || 85) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0xc9b896));
    body.position.y = h / 2; g.add(body);
    const basin = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.12, d - 0.06), mat(0xeeeeee, { metalness: 0.4 }));
    basin.position.set(0, h - 0.06, 0); g.add(basin);
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), mat(0xaaaaaa, { metalness: 0.6, roughness: 0.3 }));
    faucet.position.set(0, h + 0.09, -d / 2 + 0.05); g.add(faucet);
  }

  function buildWasher(g, f, col) {
    const w = (f.w || 60) / 100, d = (f.d || 60) / 100, h = (f.h || 85) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || getStylePreset().metal, { metalness: 0.2 }));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24, 1, false, -Math.PI * 0.4, Math.PI * 0.8), mat(0x4488cc, { metalness: 0.3, transparent: true, opacity: 0.6 }));
    door.rotation.x = Math.PI / 2; door.position.set(0, h * 0.6, d / 2 + 0.01); g.add(door);
  }

function getObjPos(obj) {
    const wall = State.walls.find(w => w.id === obj.wallId);
    if (wall) return projectOnWall(wall, obj.x / 100, obj.y / 100);
    return { x: obj.x / 100, z: obj.y / 100, along: 0, wlen: 1 };
  }

  // ---- Public API ----
  function setBuildingViewMode(mode) {
    buildingViewMode = mode === 'active' ? 'active' : 'all';
    buildFromState();
    requestAnimationFrame(() => controls?.fitHome?.());
    return buildingViewMode;
  }
  function focusActiveLevel() { return setBuildingViewMode('active'); }
  function setRenderMode(mode) {
    State.renderMode = mode === 'photo' ? 'photo' : 'realtime';
    applyStyleEnvironment();
    buildFromState();
    onResize();
    return State.renderMode;
  }
  function setLightingPreset(id) {
    State.lightingPreset = ProjectModel.LIGHTING_PRESETS[id] ? id : ProjectModel.DEFAULT_LIGHTING_PRESET;
    sunAngle = ProjectModel.LIGHTING_PRESETS[State.lightingPreset].sunAngle;
    State.sunAngle = sunAngle;
    applyStyleEnvironment();
    buildPhotoLights();
    return State.lightingPreset;
  }
  function setCameraPreset(id) {
    State.cameraPreset = ProjectModel.CAMERA_PRESETS[id] ? id : ProjectModel.DEFAULT_CAMERA_PRESET;
    controls?.applyCameraPreset?.(State.cameraPreset);
    return State.cameraPreset;
  }
  function saveCurrentCamera() {
    State.savedCamera = controls?.captureView?.() || null;
    return State.savedCamera;
  }
  function restoreSavedCamera() {
    return Boolean(State.savedCamera && controls?.restoreView?.(State.savedCamera));
  }

  function exportPNG() {
    const renderPreset = ProjectModel.RENDER_PRESETS[State.renderMode] || ProjectModel.RENDER_PRESETS.realtime;
    const previousSize = renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = renderer.getPixelRatio();
    const previousAspect = camera.aspect;
    const output = ProjectModel.computeRenderExportSize(previousSize.x, previousSize.y, renderPreset.exportScale, 16000000);
    renderer.setPixelRatio(1);
    renderer.setSize(output.width, output.height, false);
    camera.aspect = output.width / output.height;
    camera.updateProjectionMatrix();
    let dataUrl;
    try {
      renderer.render(scene, camera);
      dataUrl = renderer.domElement.toDataURL('image/png');
    } finally {
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(previousSize.x, previousSize.y, false);
      camera.aspect = previousAspect;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    return dataUrl;
  }

  window._view3d = {
    init, buildFromState, onResize,
    setSunAngle: a => { sunAngle = a; updateSun(); },
    getSunAngle: () => sunAngle,
    setSunIntensity: i => { sunIntensity = i; updateSun(); },
    getSunIntensity: () => sunIntensity,
    setRenderMode,
    getRenderMode: () => State.renderMode,
    setLightingPreset,
    getLightingPreset: () => State.lightingPreset,
    setCameraPreset,
    getCameraPreset: () => State.cameraPreset,
    saveCurrentCamera,
    restoreSavedCamera,
    enterWalkMode, exitWalkMode,
    isWalkMode: () => walkMode,
    isCutaway: () => cutawayMode,
    getBuildingViewMode: () => buildingViewMode,
    setBuildingViewMode,
    focusActiveLevel,
    toggleBuildingViewMode: () => setBuildingViewMode(buildingViewMode === 'all' ? 'active' : 'all'),
    toggleCutaway: () => { cutawayMode = !cutawayMode; updateCutaway(); return cutawayMode; },
    resetCamera: () => controls && controls.resetOrbit && controls.resetOrbit(),
    fitHome: () => controls && controls.fitHome && controls.fitHome(),
    exportPNG,
    highlightObject: id => { State.activeObject = id; State.activeType = 'furniture'; sync3DSelection(); },
    clearHighlight: sync3DSelection,
  };

  if (window.THREE && document.getElementById("canvas-3d")) {
    init();
    buildFromState();
  }
})();
