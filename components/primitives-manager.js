export const ALLOWED_PRIMITIVES = [
  "box",
  "sphere",
  "cylinder",
  "cone",
  "plane",
  "circle",
  "torus"
];

AFRAME.registerComponent("primitives-manager", {
  init() {
    this.scene = this.el.sceneEl;
  },

  createPrimitive(prim, floorY = 0, index = null) {
    if (!prim?.primitive || !ALLOWED_PRIMITIVES.includes(prim.primitive)) {
      console.warn("Primitiva no permitida:", prim);
      return null;
    }

    const el = document.createElement(`a-${prim.primitive}`);

    const pos = prim.position || { x: 0, y: 2, z: 0 };
    const rot = prim.rotation || { x: 0, y: 0, z: 0 };
    const scale = prim.scale || { x: 3, y: 3, z: 3 };

    el.setAttribute("position", `${pos.x} ${floorY + pos.y} ${pos.z}`);
    el.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
    el.setAttribute("scale", `${scale.x} ${scale.y} ${scale.z}`);

    if (prim.color) {
      el.setAttribute("color", prim.color);
    }

    if (prim.name) {
      el.setAttribute("data-name", prim.name);
    }

    if (index !== null) {
      el.setAttribute("id", `primitive-${index}`);
    }

    return el;
  },

  clearPrimitives(container) {
    if (!container) return;

    ALLOWED_PRIMITIVES.forEach((type) => {
      container.querySelectorAll(`a-${type}`).forEach((el) => el.remove());
    });
  }
});