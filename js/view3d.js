// 3D View - Complete rewrite with materials, lighting, wall holes, first-person walk
(function() {
  let scene, camera, renderer, root, wallGroup, furnGroup, doorGroup, floorGroup;
  let _rebuildTimer = null;
  let ambientLight, dirLight, sunAngle = 60, sunIntensity = 1.0;
  let walkMode = false, walkHeight = 1.6;
  let moveF = false, moveB = false, moveL = false, moveR = false, moveSpeed = 0.08;
  let yaw = 0, pitch = 0, keysDown = {};

  function init() {
    const container = document.getElementById("canvas-3d");
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd4e8);
    scene.fog = new THREE.Fog(0xbfd4e8, 80, 300);
    camera = new THREE.PerspectiveCamera(60, w / h, 0.05, 2000);
    camera.position.set(0, 16, 22);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    dirLight = new THREE.DirectionalLight(0xfff4e0, sunIntensity);
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

    const hemi = new THREE.HemisphereLight(0xddeeff, 0x889966, 0.35);
    scene.add(hemi);

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

    buildFloor();
    setupControls();
    setupKeyboard();
    animate();
    window.addEventListener("resize", onResize);
  }

  function buildFloor() {
    clearGroup(floorGroup);
    const bounds = getHomeBounds();
    const fw = bounds.maxX - bounds.minX + 200;
    const fd = bounds.maxZ - bounds.minZ + 200;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const tex = makeFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    floor.receiveShadow = true;
    floorGroup.add(floor);
  }

  function makeFloorTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#d8c8a8";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(180,160,130,0.55)";
    ctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y < 512; y += 128) {
      const off = (y / 128) % 2 === 0 ? 0 : 32;
      for (let x = -32; x < 512; x += 64) {
        ctx.fillStyle = ((x + off) / 64 + y / 128) % 2 === 0 ? "#d2c2a2" : "#ddd0b4";
        ctx.fillRect(x + off, y, 64, 128);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const bounds = getHomeBounds();
    const fw = bounds.maxX - bounds.minX + 200;
    const fd = bounds.maxZ - bounds.maxZ + 200;
    const repX = Math.max(1, Math.round(fw / 3));
    const repZ = Math.max(1, Math.round(fd / 3));
    tex.repeat.set(repX, repZ);
    tex.needsUpdate = true;
    return tex;
  }

  function getHomeBounds() {
    let minX = -50, maxX = 50, minZ = -50, maxZ = 50;
    if (State.walls.length) {
      minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity;
      for (const w of State.walls) {
        minX = Math.min(minX, w.x1 / 100, w.x2 / 100);
        maxX = Math.max(maxX, w.x1 / 100, w.x2 / 100);
        minZ = Math.min(minZ, w.y1 / 100, w.y2 / 100);
        maxZ = Math.max(maxZ, w.y1 / 100, w.y2 / 100);
      }
    } else if (State.furnitures.length) {
      for (const f of State.furnitures) {
        minX = Math.min(minX, f.x / 100); maxX = Math.max(maxX, f.x / 100);
        minZ = Math.min(minZ, f.y / 100); maxZ = Math.max(maxZ, f.y / 100);
      }
    }
    return { minX, maxX, minZ, maxZ };
  }

  function updateSun() {
    const angleRad = (sunAngle * Math.PI) / 180;
    const r = 50;
    dirLight.position.set(r * Math.cos(angleRad), r * Math.sin(angleRad), 25);
    dirLight.intensity = sunIntensity;
    dirLight.target.position.set(0, 0, 0);
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
    let theta = Math.PI / 4, phi = Math.PI / 3, radius = 28;
    const target = new THREE.Vector3(0, 0, 0);
    const el = renderer.domElement;

    el.addEventListener("contextmenu", e => e.preventDefault());

    el.addEventListener("pointerdown", e => {
      if (walkMode) return;
      if (e.button === 1 || e.button === 2) {
        isPanning = true; lastX = e.clientX; lastY = e.clientY; e.preventDefault();
      } else if (e.button === 0) {
        isDown = true; lastX = e.clientX; lastY = e.clientY;
      }
    });
    window.addEventListener("pointerup", () => { isDown = false; isPanning = false; });
    window.addEventListener("pointermove", e => {
      if (walkMode) return;
      if (isPanning) {
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
    }
    controls = { updateCamera: () => updateCameraOrbit(target, radius, theta, phi), resetOrbit: () => { radius = 28; theta = Math.PI / 4; phi = Math.PI / 3; target.set(0,0,0); updateCameraOrbit(target, radius, theta, phi); } };
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
        camera.position.y = walkHeight;
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    renderer.render(scene, camera);
  }

  function enterWalkMode() {
    walkMode = true;
    camera.position.set(camera.position.x, walkHeight, camera.position.z);
    renderer.domElement.requestPointerLock?.();
  }
  function exitWalkMode() {
    walkMode = false;
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
      clearGroup(wallGroup); clearGroup(furnGroup); clearGroup(doorGroup);
      buildFloor();
      if (!State) return;
      State.walls.forEach(w => { if (w.id) buildWall(w); });
      State.furnitures.forEach(f => buildFurniture(f));
      State.doors.forEach(d => { if (d.wallId) buildDoor(d); });
      State.windows.forEach(w => { if (w.wallId) buildWindow(w); });
    });
  }

  // ---- Wall (reliable BoxGeometry) ----
  function buildWall(w) {
    const x1 = w.x1 / 100, z1 = w.y1 / 100, x2 = w.x2 / 100, z2 = w.y2 / 100;
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const thick = (w.thickness || 20) / 100;
    const height = (w.height || 280) / 100;
    const angle = Math.atan2(dz, dx);

    const wallColor = w.color ? new THREE.Color(w.color) : new THREE.Color(0xf5f0e8);
    const geo = new THREE.BoxGeometry(len, height, thick);
    const mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Place at wall midpoint, rotate so local X aligns with wall direction
    mesh.position.set(x1 + dx / 2, height / 2, z1 + dz / 2);
    mesh.rotation.y = -angle;
    mesh.userData = { wallId: w.id, type: "wall" };
    wallGroup.add(mesh);
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
    const wall = State.walls.find(w => w.id === d.wallId);
    if (!wall) return;
    const pos = getObjPos(d);
    if (!pos) return;
    const wallH = (wall.height || 280) / 100;
    const wallThick = (wall.thickness || 20) / 100;
    const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
    const dw = (d.width || 90) / 100;
    const dh = Math.min(2.1, wallH * 0.85);

    // Group at wall centerline, rotated to match wall direction
    const g = new THREE.Group();
    g.position.set(pos.x, 0, pos.z);
    g.rotation.y = -angle;

    const ft = 0.05;
    const fm = mat(0x6b4f2a, { roughness: 0.7 });

    // Dark opening (sits in wall, full depth)
    g.add(mkBox(dw, dh, wallThick + 0.06, mat(0x0a0a0a, {roughness:1}), 0, dh/2, 0));
    // Frame: border just proud of wall face
    g.add(mkBox(dw + ft*2, dh + ft*2, 0.03, fm, 0, dh/2, wallThick/2));
    g.add(mkBox(dw + ft*2, dh + ft*2, 0.03, fm, 0, dh/2, -wallThick/2));
    // Side frame caps
    for (const sx of [-1, 1]) {
      g.add(mkBox(ft, dh, wallThick + 0.02, fm, sx*(dw/2+ft/2), dh/2, 0));
    }
    // Door leaf: flat panel near one face
    const leafW = dw - 0.08;
    g.add(mkBox(leafW, dh - 0.1, 0.03, mat(0x8b5a2b, {roughness:0.75}), -leafW*0.2, (dh-0.1)/2, wallThick/2 - 0.015));
    // Knob
    g.add(mkSphere(0.025, mat(0xffd700, {metalness:0.6, roughness:0.3}), dw/2 - 0.1, dh*0.5, wallThick/2 + 0.02));

    doorGroup.add(g);
  }

  function buildWindow(win) {
    const wall = State.walls.find(w => w.id === win.wallId);
    if (!wall) return;
    const pos = getObjPos(win);
    if (!pos) return;
    const wallH = (wall.height || 280) / 100;
    const wallThick = (wall.thickness || 20) / 100;
    const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
    const ww = (win.width || 120) / 100;
    const wh = Math.min(0.7, wallH * 0.35);
    const wc = Math.min(wallH * 0.55, 1.0);

    const g = new THREE.Group();
    g.position.set(pos.x, wc, pos.z);
    g.rotation.y = -angle;

    const ft = 0.05;
    const fm = mat(0x3a3a3a, { roughness: 0.6 });

    // Frame (flat panel on wall face)
    g.add(mkBox(ww + ft*2, wh + ft*2, 0.02, fm, 0, 0, wallThick/2 + 0.01));
    // Glass (transparent, fills opening)
    g.add(mkBox(ww - ft*2, wh - ft*2, 0.015, new THREE.MeshStandardMaterial({color:0x87ceeb, transparent:true, opacity:0.3, roughness:0.05, metalness:0.1}), 0, 0, wallThick/2 + 0.012));
    // Mullion cross (flat bars)
    g.add(mkBox(ww - ft*2, 0.015, 0.01, fm, 0, 0, wallThick/2 + 0.02));
    g.add(mkBox(0.015, wh - ft*2, 0.01, fm, 0, 0, wallThick/2 + 0.02));
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

  // ---- Furniture ----  // ---- Furniture ----
  function buildFurniture(f) {
    const g = new THREE.Group();
    g.position.set(f.x / 100, 0, f.y / 100);
    g.rotation.y = -(f.rotation || 0);
    const col = f.color;
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
    furnGroup.add(g);
  }

  function mat(color, opts) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...(opts || {}) }); }

  function buildBox(g, f, col) {
    const w = (f.w || 60) / 100, d = (f.d || 60) / 100, h = (f.h || 60) / 100;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0xaaaaaa));
    m.position.y = h / 2; m.castShadow = true; g.add(m);
  }

  function buildSofa(g, f, col) {
    const w = (f.w || 180) / 100, d = (f.d || 85) / 100, sh = 0.45, bh = 0.4, armW = Math.min(w * 0.08, 0.1);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, sh, d), mat(col || 0x8b6f47));
    seat.position.y = sh / 2 + 0.06; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, bh, 0.08), mat(col || 0x7a5c3a));
    back.position.set(0, sh + 0.06 + bh / 2, -d / 2 + 0.04); back.castShadow = true; g.add(back);
    if (armW > 0.02) {
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, sh + bh * 0.6, d), mat(col || 0x7a5c3a));
        arm.position.set(sx * (w / 2 - armW / 2), (sh + bh * 0.6) / 2 + 0.06, 0); g.add(arm);
      }
    }
    for (const lx of [-w / 2 + 0.08, w / 2 - 0.08]) for (const lz of [-d / 2 + 0.08, d / 2 - 0.08]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6), mat(0x333333));
      leg.position.set(lx, 0.03, lz); g.add(leg);
    }
  }

  function buildBed(g, f, col) {
    const w = (f.w || 160) / 100, d = (f.d || 200) / 100, frameH = 0.2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, frameH, d), mat(col || 0x8b6f47));
    frame.position.y = frameH / 2; frame.castShadow = true; g.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.18, d - 0.04), mat(0xfaf5ef));
    mattress.position.y = frameH + 0.09; g.add(mattress);
    const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.06), mat(col || 0x6b4f2a));
    head.position.set(0, 0.35 + frameH, -d / 2 + 0.03); g.add(head);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.08, 0.25), mat(0xffffff));
    pillow.position.set(0, frameH + 0.18 + 0.04, -d / 2 + 0.2); g.add(pillow);
  }

  function buildTable(g, f, col) {
    const w = (f.w || 120) / 100, d = (f.d || 80) / 100, h = (f.h || 75) / 100, topH = h * 0.06;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), mat(col || 0xa0522d));
    top.position.y = h - topH / 2; top.castShadow = true; g.add(top);
    const legR = Math.max(0.015, w * 0.02);
    for (const lx of [-w / 2 + 0.05, w / 2 - 0.05]) for (const lz of [-d / 2 + 0.05, d / 2 - 0.05]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR * 0.8, h - topH, 8), mat(col || 0x5a3a1a));
      leg.position.set(lx, (h - topH) / 2, lz); g.add(leg);
    }
  }

  function buildWardrobe(g, f, col) {
    const w = (f.w || 180) / 100, d = (f.d || 60) / 100, h = (f.h || 200) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0x8b5a2b));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const doorW = w / 2 - 0.02;
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, h - 0.05, 0.02), mat(col ? new THREE.Color(col).multiplyScalar(0.85) : 0x6b3a1a));
      door.position.set(sx * w / 4, h / 2, d / 2 + 0.01); g.add(door);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), mat(0xffd700, { metalness: 0.6, roughness: 0.3 }));
      knob.position.set(sx * 0.06, h / 2, d / 2 + 0.03); g.add(knob);
    }
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
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.28, potH, 12), mat(0x8b4513));
    pot.position.y = potH / 2; g.add(pot);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 12, 8), mat(0x228b22));
    leaves.position.y = potH + w * 0.4 * 0.8; leaves.scale.y = 1.4; g.add(leaves);
  }

  function buildCabinet(g, f, col) {
    const w = (f.w || 80) / 100, d = (f.d || 50) / 100, h = (f.h || 90) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col || 0xc9b896));
    body.position.y = h / 2; body.castShadow = true; g.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.015), mat(0xb8860b, { metalness: 0.5 }));
    handle.position.set(0, h * 0.6, d / 2 + 0.01); g.add(handle);
  }

  function buildFridge(g, f, col) {
    const w = (f.w || 70) / 100, d = (f.d || 70) / 100, h = (f.h || 180) / 100;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xdddddd, { metalness: 0.3, roughness: 0.4 }));
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
    const screen = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x111111));
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x222222, { metalness: 0.3, roughness: 0.5 }));
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xeeeeee, { metalness: 0.2 }));
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
  window._view3d = {
    init, buildFromState, onResize,
    setSunAngle: a => { sunAngle = a; updateSun(); },
    getSunAngle: () => sunAngle,
    setSunIntensity: i => { sunIntensity = i; updateSun(); },
    getSunIntensity: () => sunIntensity,
    enterWalkMode, exitWalkMode,
    isWalkMode: () => walkMode,
    resetCamera: () => controls && controls.resetOrbit && controls.resetOrbit(),
    exportPNG: () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    highlightObject: (id) => {
      furnGroup.traverse(o => { if (o.userData?.id === id && o.material) o.material.emissive?.setHex(0x444400); });
    },
    clearHighlight: () => {
      furnGroup.traverse(o => { if (o.material?.emissive) o.material.emissive.setHex(0x000000); });
    }
  };

  if (window.THREE && document.getElementById("canvas-3d")) {
    init();
    buildFromState();
  }
})();
