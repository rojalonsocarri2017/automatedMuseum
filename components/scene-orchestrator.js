AFRAME.registerComponent("scene-orchestrator", {
  schema: {
    initialRoom: { default: null },
    inputEvent: { type: "string", default: "yaml-generated" }
  },

  init() {
    this.currentRoom = this.data.initialRoom || {
      room: {
        width: 200,
        depth: 300,
        height: 100,
        ceiling: true,
        walls: { north: "barrier", east: "glass", south: "wall", west: "wall" },
        textures: {
          floor: "../assets/floor-texture.jpg",
          wall: "../assets/jeroglifico.jpg",
          ceiling: "../assets/jeroglifico.jpg"
        },
        entryPoint: { x: -10, y: 2, z: 20 },
        environment: { skyColor: "#000000", stars: true },
        lights: [
          { type: "ambient", color: "#ffffff", intensity: 0.85 },
          { type: "ambient", color: "#ebd9e9", intensity: 0.3 }
        ],
        objects: []
      }
    };

    this.onYamlGenerated = (e) => {
      const room = e.detail?.room;
      if (!room) return;

      this.currentRoom = structuredClone(room);
      console.log("Estado sincronizado en scene-orchestrator", this.currentRoom);
    };

    this.el.sceneEl.addEventListener(this.data.inputEvent, this.onYamlGenerated);
    setTimeout(() => {
      this.el.sceneEl.emit(this.data.inputEvent, {
        room: structuredClone(this.currentRoom),
        source: "scene-orchestrator-initial"
      });
    }, 0);
  },

  remove() {
    this.el.sceneEl.removeEventListener(this.data.inputEvent, this.onYamlGenerated);
  }
});