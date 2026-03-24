AFRAME.registerComponent("command-router", {
  schema: {
    inputEvent: { type: "string", default: "user-command" },
    helpEvent: { type: "string", default: "show-help-panel" },
    saveEvent: { type: "string", default: "save-scene-command" },
    editEvent: { type: "string", default: "scene-edit-command" },
    statusSelector: { type: "string", default: "#status" }
  },

  init() {
    this.statusEl = document.querySelector(this.data.statusSelector);

    this.onCommand = (e) => {
      const text = e.detail?.text?.trim();
      if (!text) return;

      const normalized = this.normalize(text);

      if (
        normalized.includes("que puedo hacer") ||
        normalized.includes("muestra un panel de ayuda")
      ) {
        this.setStatus("ℹ️ Mostrando ayuda");
        this.el.sceneEl.emit(this.data.helpEvent, {
          text,
          source: e.detail?.source || "router"
        });
        return;
      }

      if (
        normalized.includes("guarda este escenario") ||
        normalized.includes("guardar este escenario") ||
        normalized.includes("guarda el escenario") ||
        normalized.includes("guardar el escenario")
      ) {
        this.setStatus("💾 Guardando escenario en GitHub...");
        this.el.sceneEl.emit(this.data.saveEvent, {
          text,
          source: e.detail?.source || "router"
        });
        return;
      }

      this.el.sceneEl.emit(this.data.editEvent, {
        text,
        source: e.detail?.source || "router"
      });
    };

    this.el.sceneEl.addEventListener(this.data.inputEvent, this.onCommand);
  },

  remove() {
    this.el.sceneEl.removeEventListener(this.data.inputEvent, this.onCommand);
  },

  normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  },

  setStatus(message) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
  }
});