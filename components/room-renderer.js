import { OBJECT_CATALOG } from "./objects-catalog.js";
import { ALLOWED_PRIMITIVES } from "./primitives-manager.js";

AFRAME.registerComponent("room-renderer", {
  schema: {
    yaml: { type: "string", default: "" }
  },

  init() {
    this.root = this.el;

    this.el.sceneEl.addEventListener("yaml-generated", (e) => {
      const roomData = e.detail?.room;
      if (!roomData) return;
      this.renderRoom(roomData);
    });
  },

  renderRoom(roomData) {
    if (!roomData) {
      console.warn("⚠️ room inválido", roomData);
      return;
    }

    const room = roomData.room || roomData;

    if (!room.width || !room.depth || !room.height || !room.walls) {
      console.warn("⚠️ room con propiedades incompletas", room);
      return;
    }

    this.root.innerHTML = "";

    this.renderEntorno(this.root, room);
    this.renderLuces(this.root, room);
    this.renderCajaRoom(this.root, room);
    this.renderCamera(this.root, room);
  },

  renderEntorno(root, room) {
    const env = room.environment || {};

    if (env.skyColor) {
      const sky = document.createElement("a-sky");
      sky.setAttribute("color", env.skyColor);
      root.appendChild(sky);
    }

    if (env.stars) {
      const stars = document.createElement("a-entity");
      stars.setAttribute("star-sky", "");
      root.appendChild(stars);
    }
  },

  renderLuces(root, room) {
    (room.lights || []).forEach((light) => {
      const e = document.createElement("a-entity");
      e.setAttribute(
        "light",
        `type:${light.type}; color:${light.color}; intensity:${light.intensity}`
      );
      root.appendChild(e);
    });
  },

  renderCajaRoom(root, room) {
    const lounge = document.createElement("a-entity");
    lounge.setAttribute("id", "lounge");
    lounge.setAttribute(
      "lounge",
      `
      width:${room.width};
      depth:${room.depth};
      height:${room.height};
      ceiling:${room.ceiling};
      north:${room.walls.north};
      east:${room.walls.east};
      south:${room.walls.south};
      west:${room.walls.west};
      floorTexture:${room.textures.floor};
      wallTexture:${room.textures.wall};
      ceilingTexture:${room.textures.ceiling};
    `
    );

    lounge.addEventListener("loaded", () => {
      this.renderObjectsInsideLounge(lounge, room, -room.height / 2);
    });

    root.appendChild(lounge);
  },

  renderCamera(root, room) {
    const cam = document.createElement("a-entity");
    cam.setAttribute("camera", "");
    cam.setAttribute("look-controls", "");
    cam.setAttribute("wasd-controls", "");
    cam.setAttribute(
      "position",
      `${room.entryPoint.x} ${-room.height / 2 + 5} ${room.entryPoint.z}`
    );
    root.appendChild(cam);
  },

  renderObjectsInsideLounge(loungeEl, room, floorY) {
    if (!Array.isArray(room.objects)) return;

    const primitivesManager = this.el.sceneEl.querySelector("[primitives-manager]")?.components["primitives-manager"];

    for (let index = 0; index < room.objects.length; index++) {
      const obj = room.objects[index];

      if (obj.primitive && ALLOWED_PRIMITIVES.includes(obj.primitive)) {
        if (!primitivesManager) {
          console.warn("No se encontró primitives-manager");
          continue;
        }

        const primitiveEl = primitivesManager.createPrimitive(obj, floorY, index);
        if (primitiveEl) {
          loungeEl.appendChild(primitiveEl);
        }
        continue;
      }

      if (obj.model && OBJECT_CATALOG[obj.model]) {
        const entity = document.createElement("a-entity");
        entity.setAttribute("id", `object-${index}`);

        const catalogEntry = OBJECT_CATALOG[obj.model];
        entity.setAttribute("gltf-model", `url(${catalogEntry.src})`);

        const pos = obj.position || { x: 0, y: 0, z: 0 };
        const rot = obj.rotation || { x: 0, y: 0, z: 0 };
        const requestedScale = obj.scale || { x: 1, y: 1, z: 1 };
        const baseScale = catalogEntry.scale || { x: 1, y: 1, z: 1 };
        const floorOffset = catalogEntry.floorOffset || 0;

        entity.setAttribute("position", `${pos.x} ${floorY + floorOffset + pos.y} ${pos.z}`);
        entity.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
        entity.setAttribute(
          "scale",
          `${baseScale.x * requestedScale.x} ${baseScale.y * requestedScale.y} ${baseScale.z * requestedScale.z}`
        );

        if (obj.name) {
          entity.setAttribute("data-name", obj.name);
        }

        loungeEl.appendChild(entity);
      }
    }
  }
});