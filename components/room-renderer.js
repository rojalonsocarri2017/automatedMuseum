import { OBJECT_CATALOG } from "./objects-catalog.js";
import { ALLOWED_PRIMITIVES } from "./primitives-manager.js";

AFRAME.registerComponent("room-renderer", {
  schema: {
    yaml: { type: "string", default: "" },
    inputEvent: { type: "string", default: "yaml-generated" },
    preservePlayerPosition: { type: "boolean", default: true }
  },

  init() {
    this.root = this.el;
    this.scene = document.getElementById("vr-scene");
    this.vrPartial = document.getElementById("vrPartial");

    this.currentRoom = null;
    this.loungeEl = null;
    this.skyEl = null;
    this.starsEl = null;
    this.lightsContainer = null;

    this.onYamlGenerated = (e) => {
      const roomData = e.detail?.room;
      if (!roomData) return;
      this.renderRoom(roomData);
    };

    this.el.sceneEl.addEventListener(this.data.inputEvent, this.onYamlGenerated);
  },

  remove() {
    this.el.sceneEl.removeEventListener(this.data.inputEvent, this.onYamlGenerated);
  },

  renderRoom(roomData) {
    const room = roomData.room || roomData;
    if (!room?.width || !room?.depth || !room?.height || !room?.walls) return;

    const isFirstRender = !this.currentRoom;
    this.activeRoom = room;

    this.ensureBaseContainers();
    this.updateEnvironment(room);
    this.updateLights(room);

    const loungeWasRebuilt = this.updateLounge(room);

    const renderObjects = () => {
      this.updateObjects(room);
    };

    if (isFirstRender || loungeWasRebuilt) {
      this.loungeEl.addEventListener("loaded", renderObjects, { once: true });
    } else {
      renderObjects();
    }

    if (isFirstRender || !this.data.preservePlayerPosition) {
      this.syncPlayerRig(room);
    } else {
      this.syncPlayerHeightOnly(room);
    }

    this.currentRoom = structuredClone(roomData);
  },

  ensureBaseContainers() {
    if (!this.lightsContainer) {
      this.lightsContainer = document.createElement("a-entity");
      this.lightsContainer.setAttribute("id", "lights-container");
      this.root.appendChild(this.lightsContainer);
    }

    if (!this.loungeEl) {
      this.loungeEl = document.createElement("a-entity");
      this.loungeEl.setAttribute("id", "lounge");
      this.root.appendChild(this.loungeEl);
    }
  },

  updateEnvironment(room) {
    const env = room.environment || {};

    if (env.skyColor) {
      if (!this.skyEl) {
        this.skyEl = document.createElement("a-sky");
        this.skyEl.setAttribute("id", "room-sky");
        this.root.prepend(this.skyEl);
      }
      this.skyEl.setAttribute("color", env.skyColor);
    } else if (this.skyEl) {
      this.skyEl.remove();
      this.skyEl = null;
    }

    if (env.stars) {
      if (!this.starsEl) {
        this.starsEl = document.createElement("a-entity");
        this.starsEl.setAttribute("id", "room-stars");
        this.starsEl.setAttribute("star-sky", "");
        this.root.appendChild(this.starsEl);
      }
    } else if (this.starsEl) {
      this.starsEl.remove();
      this.starsEl = null;
    }
  },

  updateLights(room) {
    const lights = room.lights || [];

    this.lightsContainer.innerHTML = "";

    lights.forEach((light, index) => {
      const el = document.createElement("a-entity");
      el.setAttribute("id", `room-light-${index}`);
      el.setAttribute(
        "light",
        `type:${light.type}; color:${light.color}; intensity:${light.intensity}`
      );
      this.lightsContainer.appendChild(el);
    });
  },

  updateLounge(room) {
    const textures = room.textures || {};

    const loungeConfig = `
      width:${room.width};
      depth:${room.depth};
      height:${room.height};
      ceiling:${room.ceiling};
      north:${room.walls.north};
      east:${room.walls.east};
      south:${room.walls.south};
      west:${room.walls.west};
      floorTexture:${textures.floor || ""};
      wallTexture:${textures.wall || ""};
      ceilingTexture:${textures.ceiling || ""};
    `;

    const previousRoom = this.currentRoom?.room;

    const mustRebuild =
      !this.loungeEl ||
      !previousRoom ||
      previousRoom.width !== room.width ||
      previousRoom.depth !== room.depth ||
      previousRoom.height !== room.height ||
      previousRoom.ceiling !== room.ceiling ||
      JSON.stringify(previousRoom.walls || {}) !== JSON.stringify(room.walls || {}) ||
      JSON.stringify(previousRoom.textures || {}) !== JSON.stringify(room.textures || {});

    if (!mustRebuild) {
      this.loungeEl.setAttribute("lounge", loungeConfig);
      return false;
    }

    if (this.loungeEl) {
      this.loungeEl.remove();
    }

    this.loungeEl = document.createElement("a-entity");
    this.loungeEl.setAttribute("id", "lounge");
    this.loungeEl.setAttribute("lounge", loungeConfig);
    this.root.appendChild(this.loungeEl);

    return true;
  },
  updateObjects(room) {
    if (!Array.isArray(room.objects)) return;
    if (!this.loungeEl) return;

    const floorY = -room.height / 2;
    const nextIds = new Set();

    room.objects.forEach((obj, index) => {
      const safeObj = this.normalizeObjectForRoom(obj, room, index);
      const id = this.getStableObjectId(safeObj, index);

      nextIds.add(id);

      let el = this.loungeEl.querySelector(`#${CSS.escape(id)}`);

      if (!el) {
        el = this.createObjectElement(safeObj, index, floorY);
        if (!el) return;

        el.setAttribute("id", id);
        el.setAttribute("data-rendered-object", "true");
        this.loungeEl.appendChild(el);
      } else {
        this.updateObjectElement(el, safeObj, floorY);
      }
    });

    this.loungeEl
      .querySelectorAll("[data-rendered-object='true']")
      .forEach((el) => {
        if (!nextIds.has(el.id)) el.remove();
      });
  },

  getStableObjectId(obj, index) {
    const rawName =
      obj.name ||
      obj.id ||
      `${obj.model || obj.primitive || "object"}-${index}`;

    return `scene-object-${String(rawName)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")}`;
  },

  createObjectElement(obj, index, floorY) {
    if (obj.primitive && ALLOWED_PRIMITIVES.includes(obj.primitive)) {
      const primitivesManager =
        this.el.sceneEl.querySelector("[primitives-manager]")
          ?.components["primitives-manager"];

      if (!primitivesManager) {
        console.warn("No se encontró primitives-manager");
        return null;
      }

      const primitiveEl = primitivesManager.createPrimitive(obj, floorY, index);
      if (primitiveEl) {
        primitiveEl.setAttribute("data-object-type", "primitive");
      }

      return primitiveEl;
    }

    const modelKey = obj.model ? this.resolveModelKey(obj.model) : null;

    if (modelKey && OBJECT_CATALOG[modelKey]) {
      const entity = document.createElement("a-entity");
      entity.setAttribute("data-object-type", "model");
      this.updateObjectElement(entity, obj, floorY);
      return entity;
    }

    console.warn("Objeto no soportado:", obj);
    return null;
  },

  updateObjectElement(el, obj, floorY) {
    if (obj.name) {
      el.setAttribute("data-name", obj.name);
    }

    if (obj.primitive && ALLOWED_PRIMITIVES.includes(obj.primitive)) {
      this.updatePrimitiveElement(el, obj, floorY);
      return;
    }

    if (obj.model && OBJECT_CATALOG[obj.model]) {
      this.updateModelElement(el, obj, floorY);
    }
  },

  updatePrimitiveElement(el, obj, floorY) {
    const pos = this.getSafePosition(obj, this.activeRoom);
    const rot = obj.rotation || { x: 0, y: 0, z: 0 };
    const scale = obj.scale || { x: 3, y: 3, z: 3 };

    const y = floorY + (pos.y || 0);

    el.setAttribute("position", `${pos.x} ${y} ${pos.z}`);
    el.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
    el.setAttribute("scale", `${scale.x} ${scale.y} ${scale.z}`);

    if (obj.color) {
      el.setAttribute("color", obj.color);
      el.setAttribute("material", "color", obj.color);
    }
  },

  getPrimitiveVisualHeight(type, scale) {
    switch (type) {
      case "sphere":
      case "box":
      case "cylinder":
      case "cone":
      case "torus":
        return scale.y || 1;

      case "plane":
      case "circle":
        return 0.02;

      default:
        return scale.y || 1;
    }
  },

  getPrimitiveHeight(type, scale) {
    switch (type) {
      case "sphere":
        return scale.y;
      case "box":
        return scale.y;
      case "cylinder":
        return scale.y;
      case "cone":
        return scale.y;
      case "torus":
        return scale.y;
      case "plane":
      case "circle":
        return 0.02;
      default:
        return scale.y || 1;
    }
  },

  updateModelElement(el, obj, floorY) {
    const modelKey = this.resolveModelKey(obj.model);
    const catalogEntry = OBJECT_CATALOG[modelKey];

    if (!catalogEntry) {
      console.warn("Modelo no encontrado en OBJECT_CATALOG:", obj.model);
      return;
    }

    if (
      el.getAttribute("data-model") !== modelKey ||
      !el.getAttribute("gltf-model")
    ) {
      el.setAttribute("gltf-model", `url(${catalogEntry.src})`);
      el.setAttribute("data-model", modelKey);
    }

    const pos = this.getSafePosition(obj, this.activeRoom);
    const rot = obj.rotation || { x: 0, y: 0, z: 0 };
    const requestedScale = obj.scale || { x: 1, y: 1, z: 1 };
    const baseScale = catalogEntry.scale || { x: 1, y: 1, z: 1 };
    const floorOffset = catalogEntry.floorOffset || 0;

    el.setAttribute(
      "position",
      `${pos.x} ${floorY + floorOffset + pos.y} ${pos.z}`
    );

    el.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);

    el.setAttribute(
      "scale",
      `${baseScale.x * requestedScale.x} ${baseScale.y * requestedScale.y} ${baseScale.z * requestedScale.z}`
    );
  },

  resolveModelKey(model) {
    const aliases = {
      mesa: "table_red",
      table: "table_red",
      silla: "chair_basic",
      chair: "chair_basic",
      lampara: "lamp_floor",
      lámpara: "lamp_floor",
      lamp: "lamp_floor",
      coche: "car_1",
      moto: "motorbike"
    };

    return aliases[model] || model;
  },

  normalizeObjectForRoom(obj, room, index) {
    const normalized = structuredClone(obj);

    normalized.position = this.getSafePosition(normalized, room, index);

    return normalized;
  },

  getSafePosition(obj, room, index = 0) {
    const margin = 3;

    const minX = -room.width / 2 + margin;
    const maxX = room.width / 2 - margin;
    const minZ = -room.depth / 2 + margin;
    const maxZ = room.depth / 2 - margin;

    const pos = obj.position || this.getDefaultDistributedPosition(index, room);

    return {
      x: this.clamp(Number(pos.x || 0), minX, maxX),
      y: Number(pos.y || 0),
      z: this.clamp(Number(pos.z || 0), minZ, maxZ)
    };
  },

  getDefaultDistributedPosition(index, room) {
    const spacing = 8;
    const columns = 3;

    const col = index % columns;
    const row = Math.floor(index / columns);

    const x = (col - 1) * spacing;
    const z = row * spacing;

    return {
      x,
      y: 0,
      z
    };
  },

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  syncPlayerRig(room) {
    const rig = document.getElementById("playerRig");
    const camera = document.getElementById("mainCamera");
    if (!rig || !camera) return;

    const floorY = -room.height / 2;
    const entry = room.entryPoint || { x: 0, z: 0 };

    rig.setAttribute("position", {
      x: entry.x || 0,
      y: floorY,
      z: entry.z || 0
    });

    camera.setAttribute("position", { x: 0, y: 1.6, z: 0 });
  },
  syncPlayerHeightOnly(room) {
    const rig = document.getElementById("playerRig");
    if (!rig) return;

    const floorY = -room.height / 2;
    const currentPos = rig.getAttribute("position") || { x: 0, y: 0, z: 0 };

    rig.setAttribute("position", {
      x: currentPos.x,
      y: floorY,
      z: currentPos.z
    });
  }
});