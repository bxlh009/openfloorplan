// 3D View - Complete rewrite with materials, lighting, wall holes, first-person walk
(function() {
  let scene, camera, renderer, root, wallGroup, furnGroup, doorGroup, floorGroup;
  let controls = null;
  let _rebuildTimer = null;
  let ambientLight, dirLight, hemiLight, sunAngle = 60, sunIntensity = 1.0;
  let cutawayMode = true;
  let buildingViewMode = 'active';
  let walkMode = false, walkHeight = 1.6, walkFloorY = 0;
  let moveF = false, moveB = false, moveL = false, moveR = false, moveSpeed = 0.08;
  let yaw = 0, pitch = 0, keysDown = {};
  let furnitureDrag = null;

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
    scene.background = new THREE.Color(preset.sky);
    scene.fog = new THREE.Fog(preset.sky, 80, 300);
    camera = new THREE.PerspectiveCamera(60, w / h, 0.05, 2000);
    camera.position.set(0, 16, 22);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(preset.wall, 0.45);
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
    root.add(floorGroup);
    root.add(wallGroup);
    root.add(doorGroup);
    root.add(furnGroup);

    clearGroup(floorGroup);
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
    const tex = makeFloorTexture(currentLevel.floorFinish);
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    const polygons = ProjectModel.computeFloorPolygons(State.walls.filter(wall => wall.levelId === currentLevel.id));
    if (polygons.length) {
      for (const polygon of polygons) {
        const shape = new THREE.Shape();
        polygon.forEach((point, index) => {
          const method = index === 0 ? 'moveTo' : 'lineTo';
          shape[method](point.x / 100, -point.y / 100);
        });
        shape.closePath();
        const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat.clone());
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = baseY + 0.002;
        floor.receiveShadow = true;
        floorGroup.add(floor);
      }
      return;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, baseY, cz);
    floor.receiveShadow = true;
    floorGroup.add(floor);
  }

  function makeFloorTexture(finish) {
    const preset = getStylePreset();
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    if (finish === 'wood') {
      for (let y = 0; y < 512; y += 128) {
        const off = (y / 128) % 2 === 0 ? 0 : 32;
        for (let x = -32; x < 512; x += 64) {
          ctx.fillStyle = ((x + off) / 64 + y / 128) % 2 === 0 ? preset.floor : preset.floorAlt;
          ctx.fillRect(x + off, y, 64, 128);
        }
      }
    } else {
      ctx.fillStyle = finish === 'tile' ? '#d9d7d2' : '#aaa8a3';
      ctx.fillRect(0, 0, 512, 512);
    }
    ctx.strokeStyle = finish === 'concrete' ? 'rgba(255,255,255,0.08)' : 'rgba(40,32,24,0.22)';
    ctx.lineWidth = 2;
    const spacing = finish === 'tile' ? 128 : 64;
    for (let x = 0; x < 512; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    if (finish !== 'concrete') for (let y = 0; y < 512; y += (finish === 'tile' ? 128 : 128)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const bounds = getHomeBounds();
    const fw = Math.max(0.5, bounds.maxX - bounds.minX);
    const fd = Math.max(0.5, bounds.maxZ - bounds.minZ);
    const repX = Math.max(1, Math.round(fw / 3));
    const repZ = Math.max(1, Math.round(fd / 3));
    tex.repeat.set(repX, repZ);
    tex.needsUpdate = true;
    return tex;
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
    dirLight.position.set(r * Math.cos(angleRad), r * Math.sin(angleRad), 25);
    dirLight.intensity = sunIntensity;
    dirLight.target.position.set(0, 0, 0);
  }

  function applyStyleEnvironment() {
    const preset = getStylePreset();
    scene.background.set(preset.sky);
    scene.fog.color.set(preset.sky);
    ambientLight.color.set(preset.wall);
    dirLight.color.set(preset.sun);
    hemiLight.color.set(preset.sky);
    hemiLight.groundColor.set(preset.floor);
  }

  function updateCutaway() {
    if (!wallGroup || !doorGroup || !camera) return;
    const hiddenWallIds = cutawayMode && !walkMode
      ? new Set(ProjectModel.computeCutawayWallIds(State.walls.filter(isVisibleItem), camera.position))
      : new Set();
    wallGroup.children.forEach(mesh => { mesh.visible = !hiddenWallIds.has(mesh.userData.wallId); });
    doorGroup.children.forEach(group => { group.visible = !hiddenWallIds.has(group.userData.wallId); });
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
          const raw = { x: (point.x + furnitureDrag.offsetX) * 100, y: (point.z + furnitureDrag.offsetZ) * 100, w: furniture.w, d: furniture.d || furniture.h };
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
    function fitHome() {
      const bounds = getHomeBounds();
      const vertical = getBuildingVerticalBounds();
      const focus = buildingViewMode === 'all' ? vertical : getFocusVerticalBounds();
      const visibleHeightFromFocus = Math.max(focus.maxY - vertical.minY, focus.maxY - focus.minY);
      target.set((bounds.minX + bounds.maxX) / 2, (focus.minY + focus.maxY) / 2, (bounds.minZ + bounds.maxZ) / 2);
      radius = Math.max(6, Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, visibleHeightFromFocus) * 1.65);
      theta = Math.PI / 4;
      phi = Math.PI / 6;
      updateCameraOrbit(target, radius, theta, phi);
    }
    controls = { updateCamera: () => updateCameraOrbit(target, radius, theta, phi), fitHome, resetOrbit: fitHome };
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
    while (g.children.length) {
      const c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
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
      clearGroup(floorGroup);
      visibleLevels().forEach(buildFloor);
      if (!State) return;
      State.walls.filter(isVisibleItem).forEach(w => { if (w.id) buildWall(w); });
      State.furnitures.filter(isVisibleItem).forEach(f => buildFurniture(f));
      State.stairs.filter(isVisibleItem).forEach(buildStair);
      State.doors.filter(isVisibleItem).forEach(d => { if (d.wallId) buildDoor(d); });
      State.windows.filter(isVisibleItem).forEach(w => { if (w.wallId) buildWindow(w); });
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
    for (const segment of segments) {
      const width = segment.end - segment.start;
      const height = segment.top - segment.bottom;
      const center = (segment.start + segment.end) / 2;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, thick),
        new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.0 }),
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
    g.add(mkBox(ww - ft*2, wh - ft*2, 0.015, new THREE.MeshStandardMaterial({color:0x87ceeb, transparent:true, opacity:0.3, roughness:0.05, metalness:0.1}), 0, 0, wallThick/2 + 0.012));
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
  function mkSphere(r, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), material);
    m.position.set(x, y, z);
    return m;
  }

  function buildStair(stair) {
    const current = State.levels.find(level => level.id === stair.levelId) || ProjectModel.DEFAULT_LEVEL;
    const target = State.levels.find(level => level.id === stair.toLevelId);
    const totalRise = Math.max(1, ((target?.elevation ?? (current.elevation + current.height + current.floorThickness)) - current.elevation) / 100);
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
    g.position.set(f.x / 100, levelElevation(f.levelId), f.y / 100);
    g.rotation.y = -(f.rotation || 0);
    const col = f.color || defaultFurnitureColor(f.type);
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
    addFurnitureSelectionRing(g, f);
    furnGroup.add(g);
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

  function mat(color, opts) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...(opts || {}) }); }

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
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat(profile === 'frame' ? getStylePreset().metal : getStylePreset().wood));
    base.position.y = legH + 0.06; base.castShadow = true; g.add(base);
    const cushionCount = w > 1.5 ? 3 : 2;
    for (let i = 0; i < cushionCount; i += 1) {
      const cushionW = (w - armW * 2 - 0.05) / cushionCount;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(cushionW - 0.015, sh, d - 0.11), mat(col || 0x8b6f47, { roughness: profile === 'organic' ? 0.95 : 0.78 }));
      cushion.position.set(-w/2 + armW + cushionW*(i+0.5), legH + 0.12 + sh/2, 0.035); cushion.castShadow = true; g.add(cushion);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(w - armW*2, bh, profile === 'classic' ? 0.14 : 0.09), mat(col || 0x7a5c3a));
    back.position.set(0, legH + 0.12 + sh + bh/2 - 0.06, -d/2 + 0.06); back.castShadow = true; g.add(back);
    if (armW > 0.02) {
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, sh * 0.72, d - 0.05), mat(col || 0x7a5c3a));
        arm.position.set(sx * (w / 2 - armW / 2), legH + 0.12 + sh * 0.36, 0); g.add(arm);
      }
    }
    if (legH > 0.03) for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) for (const lz of [-d / 2 + 0.09, d / 2 - 0.09]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, profile === 'tapered' ? 0.022 : 0.012, legH, 8), mat(profile === 'frame' || profile === 'low' ? getStylePreset().metal : getStylePreset().wood));
      leg.position.set(lx, legH/2, lz); g.add(leg);
    }
  }

  function buildBed(g, f, col) {
    const w = (f.w || 160) / 100, d = (f.d || 200) / 100, frameH = 0.2;
    const profile = getStylePreset().furnitureProfile;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, frameH, d), mat(col || 0x8b6f47));
    frame.position.y = frameH / 2; frame.castShadow = true; g.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.18, d - 0.04), mat(0xfaf5ef));
    mattress.position.y = frameH + 0.09; g.add(mattress);
    const headH = { low:0.55, tapered:0.72, floor:0.46, organic:0.62, frame:0.74, classic:0.88 }[profile];
    const head = new THREE.Mesh(new THREE.BoxGeometry(w, headH, profile === 'classic' ? 0.11 : 0.055), mat(col || 0x6b4f2a));
    head.position.set(0, headH/2 + frameH, -d / 2 + 0.03); g.add(head);
    if (profile === 'floor') for (const x of [-0.36,-0.18,0,0.18,0.36]) {
      const slat = mkBox(0.025, headH * 0.8, 0.018, mat(getStylePreset().wood), x*w, frameH + headH/2, -d/2 - 0.006); g.add(slat);
    }
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.08, 0.25), mat(0xffffff));
    pillow.position.set(0, frameH + 0.18 + 0.04, -d / 2 + 0.2); g.add(pillow);
  }

  function buildTable(g, f, col) {
    const w = (f.w || 120) / 100, d = (f.d || 80) / 100, h = (f.h || 75) / 100, topH = h * 0.06;
    const profile = getStylePreset().furnitureProfile;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), mat(col || 0xa0522d));
    top.position.y = h - topH / 2; top.castShadow = true; g.add(top);
    const legMat = mat(profile === 'low' || profile === 'frame' ? getStylePreset().metal : getStylePreset().wood, { metalness: profile === 'frame' ? 0.55 : 0.05 });
    if (profile === 'low' || profile === 'frame') {
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0x8b5a2b));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const doorW = w / 2 - 0.02;
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, h - 0.05, 0.02), mat(col ? new THREE.Color(col).multiplyScalar(0.85) : 0x6b3a1a));
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
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xffffff));
    base.position.y = h / 2; base.castShadow = true; g.add(base);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, h - 0.08, d - 0.12), mat(0xadd8e6));
    inner.position.y = h / 2 + 0.03; g.add(inner);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat(0xeeeeee));
    rim.position.y = h; g.add(rim);
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
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 16, 10), mat(0x3f6d4a, { roughness: 0.95 }));
    leaves.position.y = potH + w * 0.4 * 0.8; leaves.scale.y = 1.4; g.add(leaves);
  }

  function buildCabinet(g, f, col) {
    const w = (f.w || 80) / 100, d = (f.d || 50) / 100, h = (f.h || 90) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0xc9b896));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.012, 0.015), mat(getStylePreset().metal, { metalness: 0.65, roughness: 0.3 }));
    handle.position.set(0, h * 0.6, d / 2 + 0.01); g.add(handle);
  }

  function buildFridge(g, f, col) {
    const w = (f.w || 70) / 100, d = (f.d || 70) / 100, h = (f.h || 180) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || getStylePreset().metal, { metalness: 0.3, roughness: 0.4 }));
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
    const screen = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || getStylePreset().metal));
    screen.position.set(0, h / 2 + 0.8, 0); g.add(screen);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, d + 0.01), mat(0x222222));
    bezel.position.copy(screen.position); g.add(bezel);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.04, d + 0.1), mat(0x333333));
    stand.position.set(0, 0.4, 0); g.add(stand);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.04), mat(0x333333));
    neck.position.set(0, 0.6, 0); g.add(neck);
  }

  function buildLamp(g, f, col) {
    const h = (f.h || 150) / 100, r = (f.w || 25) / 100;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.6, 0.03, 12), mat(0x333333));
    base.position.y = 0.015; g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.2, 8), mat(0x555555, { metalness: 0.4 }));
    pole.position.y = (h - 0.2) / 2 + 0.03; g.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(r, 0.18, 16, 1, true), mat(col || 0xfff8e0, { side: THREE.DoubleSide, emissive: col || 0xfff8e0, emissiveIntensity: 0.4 }));
    shade.position.y = h - 0.12; g.add(shade);
    const bulbPoint = new THREE.PointLight(0xfff0d0, 0.6, 4, 2);
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

  window._view3d = {
    init, buildFromState, onResize,
    setSunAngle: a => { sunAngle = a; updateSun(); },
    getSunAngle: () => sunAngle,
    setSunIntensity: i => { sunIntensity = i; updateSun(); },
    getSunIntensity: () => sunIntensity,
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
    exportPNG: () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    highlightObject: id => { State.activeObject = id; State.activeType = 'furniture'; sync3DSelection(); },
    clearHighlight: sync3DSelection,
  };

  if (window.THREE && document.getElementById("canvas-3d")) {
    init();
    buildFromState();
  }
})();
