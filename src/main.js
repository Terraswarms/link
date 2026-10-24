import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const container = document.querySelector("#game-canvas-container");
const loadingMessage = document.querySelector("#loading-message");
const errorMessage = document.querySelector("#error-message");
const positionReadout = document.querySelector("#position-readout");
const energyFill = document.querySelector("#energy-fill");
const energyReadout = document.querySelector("#energy-readout");
const movementState = document.querySelector("#movement-state");

try {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc6df);
  scene.fog = new THREE.Fog(0x8fc6df, 55, 145);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 250);
  camera.position.set(0, 6.5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xd8f2ff, 0x304a3d, 2.4));
  const sun = new THREE.DirectionalLight(0xffe7bd, 3.2);
  sun.position.set(-30, 42, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  scene.add(sun);

  function terrainHeight(x, z) {
    const broadHills = Math.sin(x * 0.065) * 1.1 + Math.cos(z * 0.052) * 0.85;
    const softRidges = Math.sin((x + z) * 0.035) * 0.55;
    const valley = -Math.exp(-((x * x) / 150 + ((z - 7) * (z - 7)) / 500)) * 0.55;
    return broadHills + softRidges + valley;
  }

  const terrainGeometry = new THREE.PlaneGeometry(180, 180, 64, 64);
  const terrainPositions = terrainGeometry.attributes.position;
  for (let i = 0; i < terrainPositions.count; i++) {
    const x = terrainPositions.getX(i);
    const z = -terrainPositions.getY(i);
    terrainPositions.setZ(i, terrainHeight(x, z));
  }
  terrainGeometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ color: 0x5f925e, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  function createWindingPath() {
    const segments = 48;
    const width = 3.2;
    const positions = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const z = -82 + (i / segments) * 164;
      const x = Math.sin(z * 0.045) * 4.2;
      const nextX = Math.sin((z + 0.2) * 0.045) * 4.2;
      const tangent = new THREE.Vector2(nextX - x, 0.2).normalize();
      const side = new THREE.Vector2(-tangent.y, tangent.x);
      const leftX = x + side.x * width;
      const leftZ = z + side.y * width;
      const rightX = x - side.x * width;
      const rightZ = z - side.y * width;
      positions.push(leftX, terrainHeight(leftX, leftZ) + 0.035, leftZ);
      positions.push(rightX, terrainHeight(rightX, rightZ) + 0.035, rightZ);
    }

    for (let i = 0; i < segments; i++) {
      const row = i * 2;
      indices.push(row, row + 1, row + 2, row + 1, row + 3, row + 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const path = new THREE.Mesh(
    createWindingPath(),
    new THREE.MeshStandardMaterial({ color: 0xc4a477, roughness: 1 })
  );
  path.receiveShadow = true;
  scene.add(path);

  const terrainLandmarks = [];
  const landmarkMaterial = new THREE.MeshStandardMaterial({ color: 0x5d7180, roughness: 0.95 });
  for (let z = -60; z <= 60; z += 12) {
    for (const x of [-7, 7]) {
      const baseY = terrainHeight(x, z);
      const stoneHeight = 2.6;
      const stoneRadius = 1.15;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.1, stoneHeight, 8),
        landmarkMaterial
      );
      stone.position.set(x, baseY + stoneHeight / 2, z);
      stone.rotation.z = (x + z) * 0.01;
      stone.castShadow = true;
      stone.receiveShadow = true;
      scene.add(stone);
      terrainLandmarks.push({ x, z, radius: stoneRadius, topY: baseY + stoneHeight });
    }
  }

  function addTree(x, z, scale = 1, leafColor = 0x397b57) {
    const tree = new THREE.Group();
    tree.position.set(x, terrainHeight(x, z), z);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 2.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x70523e, roughness: 1 })
    );
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    tree.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.15, 1),
      new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9 })
    );
    leaves.position.y = 2.35;
    leaves.scale.set(1.25, 0.85, 1.1);
    leaves.castShadow = true;
    tree.add(leaves);
    scene.add(tree);
  }

  function addRock(x, z, scale = 1, color = 0x718b91) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 1 })
    );
    rock.position.set(x, terrainHeight(x, z) + 0.45 * scale, z);
    rock.scale.set(1.25 * scale, 0.8 * scale, 0.95 * scale);
    rock.rotation.set((x + z) * 0.03, z * 0.02, x * 0.02);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  function addFlowerPatch(x, z, color) {
    const count = 34;
    const flowers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 6, 4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
      count
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = i * 2.41;
      const radius = 1.2 + (i % 7) * 0.32;
      const flowerX = x + Math.cos(angle) * radius;
      const flowerZ = z + Math.sin(angle) * radius;
      matrix.makeTranslation(flowerX, terrainHeight(flowerX, flowerZ) + 0.16, flowerZ);
      flowers.setMatrixAt(i, matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
    flowers.castShadow = true;
    scene.add(flowers);
  }

  [
    [-18, -28, 1.3, 0x3f8658], [-30, -4, 0.9, 0x4b8d5c], [22, -24, 1.4, 0x34744f],
    [29, 5, 1.1, 0x4f9560], [-25, 25, 1.2, 0x3d7e55], [23, 33, 0.85, 0x5a9c63],
    [-45, 9, 1.4, 0x467f55], [45, -15, 1.25, 0x3e7651]
  ].forEach(([x, z, scale, color]) => addTree(x, z, scale, color));

  [
    [-12, -18, 1.1], [15, -7, 0.8], [18, 18, 1.35], [-20, 14, 0.75],
    [32, 22, 1.15], [-36, -18, 1.3], [37, 38, 0.8], [-40, 35, 1.1]
  ].forEach(([x, z, scale]) => addRock(x, z, scale));

  addFlowerPatch(-10, -13, 0xf2b6c7);
  addFlowerPatch(13, 14, 0xf5d47f);
  addFlowerPatch(-26, 8, 0xdca6ef);

  const distantMaterial = new THREE.MeshStandardMaterial({ color: 0x759baa, roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const distance = 68 + (i % 3) * 8;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(8 + (i % 3) * 3, 18 + (i % 4) * 5, 7),
      distantMaterial
    );
    mountain.position.set(Math.cos(angle) * distance, 8, Math.sin(angle) * distance);
    mountain.rotation.y = angle;
    scene.add(mountain);
  }

  const player = new THREE.Group();
  const visualRoot = new THREE.Group();
  player.add(visualRoot);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.1, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd76f48, roughness: 0.8 })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  visualRoot.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0bd91, roughness: 0.9 })
  );
  head.position.y = 2.25;
  head.castShadow = true;
  visualRoot.add(head);

  function createCapeGeometry() {
    const columns = 5;
    const rows = 4;
    const positions = [];
    const indices = [];

    for (let row = 0; row <= rows; row++) {
      const verticalProgress = row / rows;
      const width = THREE.MathUtils.lerp(0.55, 1.65, verticalProgress);
      const y = 2.1 - verticalProgress * 1.9;
      const z = -0.72 - verticalProgress * 0.08;
      for (let column = 0; column <= columns; column++) {
        const horizontalProgress = column / columns;
        const x = THREE.MathUtils.lerp(-width, width, horizontalProgress);
        positions.push(x, y, z);
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const current = row * (columns + 1) + column;
        const nextRow = current + columns + 1;
        indices.push(current, nextRow, current + 1, current + 1, nextRow, nextRow + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  const capeGeometry = createCapeGeometry();
  const cape = new THREE.Mesh(
    capeGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x7d3042,
      roughness: 0.85,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    })
  );
  cape.castShadow = true;
  visualRoot.add(cape);
  const capeBasePositions = capeGeometry.attributes.position.array.slice();

  player.position.set(0, terrainHeight(0, 8), 8);
  scene.add(player);

  const keys = new Set();
  const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
  const sprintKeys = new Set(["ShiftLeft", "ShiftRight"]);
  const turnSpeed = 2.5;
  const normalSpeed = 8;
  const sprintSpeed = 14;
  const flightSpeed = 10;
  const gravity = 22;
  const maxEnergy = 100;
  const energyRegenerationRate = 18;
  const sprintEnergyDrain = 20;
  const flightEnergyDrain = 28;
  const flightRiseSpeed = 4;
  const cameraDistance = 10;
  const cameraHeight = 2.2;
  const maxWorldDistance = 75;

  let verticalVelocity = 0;
  let isGrounded = true;
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let cameraYaw = 0;
  let cameraPitch = 0.42;
  let energy = maxEnergy;
  let isSprinting = false;
  let isFlying = false;
  let sprintLocked = false;
  let flightLocked = false;
  let energyConsumedThisFrame = false;

  const clock = new THREE.Clock();
  const cameraTarget = new THREE.Vector3();
  const desiredCameraPosition = new THREE.Vector3();
  const direction = new THREE.Vector3();

  function getSurfaceHeight(x, z) {
    let surfaceHeight = terrainHeight(x, z);
    for (const landmark of terrainLandmarks) {
      if (Math.hypot(x - landmark.x, z - landmark.z) <= landmark.radius) {
        surfaceHeight = Math.max(surfaceHeight, landmark.topY);
      }
    }
    return surfaceHeight;
  }

  function resolveTerrainCollision() {
    if (isFlying) return;
    for (const landmark of terrainLandmarks) {
      const offsetX = player.position.x - landmark.x;
      const offsetZ = player.position.z - landmark.z;
      const distance = Math.hypot(offsetX, offsetZ);
      const minimumDistance = landmark.radius + 0.6;

      if (distance > 0 && distance < minimumDistance && player.position.y < landmark.topY - 0.25) {
        const pushAmount = (minimumDistance - distance) / distance;
        player.position.x += offsetX * pushAmount;
        player.position.z += offsetZ * pushAmount;
      }
    }
  }

  function isSprintHeld() {
    return keys.has("ShiftLeft") || keys.has("ShiftRight");
  }

  function updateCapeAnimation(hasMovementInput) {
    const positions = capeGeometry.attributes.position;
    const elapsed = clock.elapsedTime;
    const windStrength = isFlying ? 1.2 : isSprinting ? 0.75 : hasMovementInput ? 0.38 : 0.08;

    for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
      const offset = vertexIndex * 3;
      const baseX = capeBasePositions[offset];
      const baseY = capeBasePositions[offset + 1];
      const baseZ = capeBasePositions[offset + 2];
      const verticalProgress = THREE.MathUtils.clamp((2.1 - baseY) / 1.9, 0, 1);
      const looseAmount = verticalProgress * verticalProgress;
      const wave = Math.sin(elapsed * 7 + baseX * 3 + baseY * 2) * windStrength * looseAmount * 0.22;
      const windBack = -windStrength * looseAmount * 0.6;

      positions.setX(vertexIndex, baseX + Math.sin(elapsed * 4 + baseY) * 0.08 * looseAmount);
      positions.setY(vertexIndex, baseY);
      positions.setZ(vertexIndex, baseZ + windBack + wave);
    }

    positions.needsUpdate = true;
    capeGeometry.computeVertexNormals();
  }

  function updateFlyingPose(delta) {
    const targetRotationX = isFlying ? 0.95 : 0;
    visualRoot.rotation.x = THREE.MathUtils.lerp(
      visualRoot.rotation.x,
      targetRotationX,
      1 - Math.pow(0.001, delta)
    );
  }

  renderer.domElement.style.cursor = "grab";
  renderer.domElement.addEventListener("pointerdown", (event) => {
    isDragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    renderer.domElement.style.cursor = "grabbing";
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const sensitivity = 0.006;
    cameraYaw -= (event.clientX - lastPointerX) * sensitivity;
    cameraPitch -= (event.clientY - lastPointerY) * sensitivity;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch, 0.12, 1.25);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    isDragging = false;
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.releasePointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointercancel", () => {
    isDragging = false;
    renderer.domElement.style.cursor = "grab";
  });

  window.addEventListener("keydown", (event) => {
    if (movementKeys.has(event.code) || event.code === "Space" || sprintKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
    if (event.code === "Space") flightLocked = false;
    if (sprintKeys.has(event.code)) sprintLocked = false;
  });

  function update(delta) {
    direction.set(0, 0, 0);
    energyConsumedThisFrame = false;

    if (keys.has("KeyW") || keys.has("ArrowUp")) direction.z -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) direction.z += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) cameraYaw += turnSpeed * delta;
    if (keys.has("KeyD") || keys.has("ArrowRight")) cameraYaw -= turnSpeed * delta;

    const hasMovementInput = direction.lengthSq() > 0;
    if (hasMovementInput) {
      direction.normalize();
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    }
    player.rotation.y = cameraYaw + Math.PI;

    const wantsToFly = keys.has("Space") && !flightLocked && energy > 0;
    if (wantsToFly) {
      isFlying = true;
      isGrounded = false;
      verticalVelocity = 0;
      const currentSurface = getSurfaceHeight(player.position.x, player.position.z);
      if (player.position.y <= currentSurface + 0.05) player.position.y = currentSurface + 1.5;
      player.position.y += flightRiseSpeed * delta;
      energy -= flightEnergyDrain * delta;
      energyConsumedThisFrame = true;

      if (energy <= 0) {
        energy = 0;
        isFlying = false;
        flightLocked = true;
        verticalVelocity = -1.5;
      }
    } else {
      isFlying = false;
    }

    isSprinting = !isFlying && !sprintLocked && hasMovementInput && isSprintHeld() && energy > 0;
    if (isSprinting) {
      energy -= sprintEnergyDrain * delta;
      energyConsumedThisFrame = true;
      if (energy <= 0) {
        energy = 0;
        isSprinting = false;
        sprintLocked = true;
      }
    }

    if (!isFlying && !isSprinting && !energyConsumedThisFrame) energy += energyRegenerationRate * delta;
    energy = THREE.MathUtils.clamp(energy, 0, maxEnergy);

    updateCapeAnimation(hasMovementInput);
    updateFlyingPose(delta);

    const movementSpeed = isFlying ? flightSpeed : isSprinting ? sprintSpeed : normalSpeed;
    if (hasMovementInput) player.position.addScaledVector(direction, delta * movementSpeed);

    player.position.x = THREE.MathUtils.clamp(player.position.x, -maxWorldDistance, maxWorldDistance);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -maxWorldDistance, maxWorldDistance);
    resolveTerrainCollision();

    const surfaceHeight = getSurfaceHeight(player.position.x, player.position.z);
    if (!isFlying) {
      if (isGrounded) {
        player.position.y = surfaceHeight;
      } else {
        verticalVelocity -= gravity * delta;
        player.position.y += verticalVelocity * delta;
        if (player.position.y <= surfaceHeight) {
          player.position.y = surfaceHeight;
          verticalVelocity = 0;
          isGrounded = true;
        }
      }
    }

    updateEnergyHud();

    cameraTarget.set(player.position.x, player.position.y + 1.3, player.position.z);
    const horizontalDistance = Math.cos(cameraPitch) * cameraDistance;
    desiredCameraPosition.set(
      player.position.x + Math.sin(cameraYaw) * horizontalDistance,
      player.position.y + cameraHeight + Math.sin(cameraPitch) * cameraDistance,
      player.position.z + Math.cos(cameraYaw) * horizontalDistance
    );
    camera.position.lerp(desiredCameraPosition, 1 - Math.pow(0.001, delta));
    camera.lookAt(cameraTarget);
    positionReadout.textContent = `X ${player.position.x.toFixed(1)}   Z ${player.position.z.toFixed(1)}`;
  }

  function updateEnergyHud() {
    const energyPercent = (energy / maxEnergy) * 100;
    energyFill.style.width = `${energyPercent}%`;
    energyReadout.textContent = `${Math.ceil(energy)} / ${maxEnergy}`;
    movementState.textContent = isFlying ? "Flying" : isSprinting ? "Sprinting" : "Grounded";
  }

  function animate() {
    requestAnimationFrame(animate);
    update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  loadingMessage.hidden = true;
  animate();
} catch (error) {
  console.error(error);
  loadingMessage.hidden = true;
  errorMessage.hidden = false;
}
