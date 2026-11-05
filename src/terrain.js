import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class GaiaTerrain {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.meshes = [];
    this.bounds = new THREE.Box3();
    this.raycaster = new THREE.Raycaster();
    this.rayOrigin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
    this.loaded = false;
  }

  async load(path) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(path);

    this.root = gltf.scene;

    this.root.traverse((object) => {
      if (!object.isMesh) return;

      object.receiveShadow = true;
      object.castShadow = false;
      this.meshes.push(object);
    });

    // Blender already exported the correct rotation and scale.
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(1, 1, 1);

    this.scene.add(this.root);
    this.bounds.setFromObject(this.root);
    this.loaded = true;
  }

  getHeight(x, z) {
    if (!this.loaded || this.meshes.length === 0) return null;

    this.rayOrigin.set(
      x,
      this.bounds.max.y + 100,
      z
    );

    this.raycaster.set(this.rayOrigin, this.down);

    const hits = this.raycaster.intersectObjects(this.meshes, true);

    if (hits.length === 0) return null;

    return hits[0].point.y;
  }

  getSpawnPoint() {
    const x = (this.bounds.min.x + this.bounds.max.x) / 2;
    const z = (this.bounds.min.z + this.bounds.max.z) / 2;
    const y = this.getHeight(x, z);

    return {
      x,
      y: y ?? this.bounds.max.y + 2,
      z
    };
  }
}