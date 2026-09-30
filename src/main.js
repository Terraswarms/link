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
  scene.background = new THREE.Color(0x9cc7d8);
  scene.fog = new THREE.Fog(0x9cc7d8, 45, 150);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 250);
  camera.position.set(0, 6.5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xcceaff, 0x514633, 2.3));
  const sun = new THREE.DirectionalLight(0xffe7bd, 3.2);
  sun.position.set(-25, 35, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ color: 0x6f9561, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 180),
    new THREE.MeshStandardMaterial({ color: 0xb99c70, roughness: 1 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.012;
  scene.add(path);

  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.1, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd76f48, roughness: 0.8 })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  player.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0bd91, roughness: 0.9 })
  );
  head.position.y = 2.25;
  head.castShadow = true;
  player.add(head);
  player.position.set(0, 0, 8);
  scene.add(player);

  const capeGeometry = new THREE.PlaneGeometry(1.8, 2.2, 6, 5);

const capeMaterial = new THREE.MeshStandardMaterial({
  color: 0x7d3042,
  roughness: 0.85,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95
});

const cape = new THREE.Mesh(capeGeometry, capeMaterial);
cape.position.set(0, 1.1, -0.48);
cape.castShadow = true;
player.add(cape);

const capeBasePositions =
  capeGeometry.attributes.position.array.slice();

  // Simple landmarks make movement and scale visible in the prototype.
  const landmarkMaterial = new THREE.MeshStandardMaterial({ color: 0x607b8b, roughness: 0.95 });
  for (let z = -60; z <= 60; z += 12) {
    for (const x of [-7, 7]) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 2.6, 8), landmarkMaterial);
      stone.position.set(x, 1.3, z);
      stone.rotation.z = (x + z) * 0.01;
      stone.castShadow = true;
      scene.add(stone);
    }
  }

  const keys = new Set();
  const movementKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
  const playerHeight = 0;
  const jumpVelocity = 8.5;
  const gravity = 22;
  let verticalVelocity = 0;
  let isGrounded = true;

  // Camera orbit state. Dragging the canvas changes the horizontal and vertical view angles.
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let cameraYaw = 0;
  let cameraPitch = 0.42;
  const normalSpeed = 8;
  const sprintSpeed = 14;
  const flightSpeed = 10;

  const maxEnergy = 100;
  const energyRegenerationRate = 18;
  const sprintEnergyDrain = 20;
  const flightEnergyDrain = 28;

  const flightRiseSpeed = 4;
  const sprintKeys = new Set(["ShiftLeft", "ShiftRight"]);

  let energy = maxEnergy;
  let isSprinting = false;
  let isFlying = false;
  const cameraDistance = 10;
  const cameraHeight = 2.2;

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
  window.addEventListener("keyup", (event) => keys.delete(event.code));

  const clock = new THREE.Clock();
  const cameraTarget = new THREE.Vector3();
  const desiredCameraPosition = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const maxWorldDistance = 75;

  function updateCapeAnimation(hasMovementInput) {
  const positions = capeGeometry.attributes.position;
  const elapsed = clock.elapsedTime;

  const windStrength = isFlying
    ? 0.9
    : isSprinting
      ? 0.65
      : hasMovementInput
        ? 0.35
        : 0.08;

  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
    const offset = vertexIndex * 3;

    const baseX = capeBasePositions[offset];
    const baseY = capeBasePositions[offset + 1];
    const baseZ = capeBasePositions[offset + 2];

    // The bottom of the cape moves more than the top.
    const heightPercent = (baseY + 1.1) / 2.2;
    const looseAmount = 1 - heightPercent;

    const wave =
      Math.sin(
        elapsed * 7 +
        baseX * 3 +
        baseY * 2
      ) *
      windStrength *
      looseAmount *
      looseAmount;

    const backwardWind =
      -windStrength *
      0.55 *
      looseAmount;

    positions.setX(
      vertexIndex,
      baseX + Math.sin(elapsed * 4 + baseY) * 0.08 * looseAmount
    );

    positions.setY(vertexIndex, baseY);

    positions.setZ(
      vertexIndex,
      baseZ + backwardWind + wave
    );
  }

  positions.needsUpdate = true;
  capeGeometry.computeVertexNormals();
}

  function update(delta) {
    direction.set(0, 0, 0);

    if (keys.has("KeyW") || keys.has("ArrowUp")) direction.z -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) direction.z += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) direction.x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) direction.x += 1;

    const hasMovementInput = direction.lengthSq() > 0;
    updateCapeAnimation(hasMovementInput);

    if (hasMovementInput) {
      direction.normalize();

      // Keep movement relative to the camera direction.
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

      player.rotation.y = Math.atan2(direction.x, direction.z);
    }

    const wantsToFly = keys.has("Space") && energy > 0;

    if (wantsToFly) {
      isFlying = true;
      isGrounded = false;
      verticalVelocity = 0;

      if (player.position.y <= 0) {
        player.position.y = 1.5;
      }

      player.position.y += flightRiseSpeed * delta;
      energy -= flightEnergyDrain * delta;

      if (energy <= 0) {
        energy = 0;
        isFlying = false;

        // Immediately begin falling.
        verticalVelocity = -1.5;
      }
    } else {
      isFlying = false;
    }

    isSprinting =
      !isFlying &&
      hasMovementInput &&
      (sprintKeys.has("ShiftLeft") && keys.has("ShiftLeft")) ||
      (sprintKeys.has("ShiftRight") && keys.has("ShiftRight")) &&
      energy > 0;

    if (isSprinting) {
      energy -= sprintEnergyDrain * delta;
    } else if (!isFlying) {
      energy += energyRegenerationRate * delta;
    }

    // Keep energy safely between zero and maxEnergy.
    energy = THREE.MathUtils.clamp(energy, 0, maxEnergy);

    // Stop flight immediately when energy runs out.
    if (energy <= 0) {
      isFlying = false;
    }

    const movementSpeed = isFlying
      ? flightSpeed
      : isSprinting
        ? sprintSpeed
        : normalSpeed;

    if (hasMovementInput) {
      player.position.addScaledVector(direction, delta * movementSpeed);
    }

    // Normal gravity applies whenever the player is not flying.
    if (!isFlying) {
      if (!isGrounded || verticalVelocity > 0) {
        verticalVelocity -= gravity * delta;
        player.position.y += verticalVelocity * delta;

        if (player.position.y <= playerHeight) {
          player.position.y = playerHeight;
          verticalVelocity = 0;
          isGrounded = true;
        }
      }
    }

    player.position.x = THREE.MathUtils.clamp(
      player.position.x,
      -maxWorldDistance,
      maxWorldDistance
    );

    player.position.z = THREE.MathUtils.clamp(
      player.position.z,
      -maxWorldDistance,
      maxWorldDistance
    );

    updateEnergyHud();

    cameraTarget.set(player.position.x, 1.3, player.position.z);

    const horizontalDistance = Math.cos(cameraPitch) * cameraDistance;

    desiredCameraPosition.set(
      player.position.x + Math.sin(cameraYaw) * horizontalDistance,
      player.position.y +
        cameraHeight +
        Math.sin(cameraPitch) * cameraDistance,
      player.position.z + Math.cos(cameraYaw) * horizontalDistance
    );

    camera.position.lerp(
      desiredCameraPosition,
      1 - Math.pow(0.001, delta)
    );

    camera.lookAt(cameraTarget);

    positionReadout.textContent =
      `X ${player.position.x.toFixed(1)}   Z ${player.position.z.toFixed(1)}`;
  }
  
  function updateEnergyHud() {
    const energyPercent = (energy / maxEnergy) * 100;

    energyFill.style.width = `${energyPercent}%`;
    energyReadout.textContent =
      `${Math.ceil(energy)} / ${maxEnergy}`;

    if (isFlying) {
      movementState.textContent = "Flying";
    } else if (isSprinting) {
      movementState.textContent = "Sprinting";
    } else {
      movementState.textContent = "Grounded";
    }
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
