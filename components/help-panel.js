import { OBJECT_CATALOG } from "./objects-catalog.js";

AFRAME.registerComponent("help-panel", {
  init() {
    this.currentPanel = null;
    this.hideTimeout = null;
    this.hud = document.getElementById("hud");
    this.onShowHelp = () => {
      this.renderHelpPanel();
    };

    this.el.sceneEl.addEventListener("show-help-panel", this.onShowHelp);
  },

  remove() {
    if (this.el.sceneEl) {
      this.el.sceneEl.removeEventListener("show-help-panel", this.onShowHelp);
    }
    this.clearPanel();
  },

  clearPanel() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.currentPanel && this.currentPanel.parentNode) {
      this.currentPanel.parentNode.removeChild(this.currentPanel);
    }

    const vrPartial = document.getElementById("vrPartial");
    if (vrPartial) {
      vrPartial.setAttribute("value", "");
    }

    this.currentPanel = null;
    if (this.hud && this.el.sceneEl && this.el.sceneEl.is("vr-mode")) {
      this.hud.setAttribute("visible", true);
    }
  },

  getHelpText() {
    return `
CREA ESCENAS CON TU VOZ

Manten pulsado el boton de detras del mando derecho para hablar y sueltalo para generar la escena.

Ejemplos:
  - "Pon un cubo rojo"
  - "Quiero una habitacion de dimensiones 50x50x50"
  - "Pon una silla"
  - "Cambia el color del cielo a azul"

Puedes:
  - Crear objetos en la escena
  - Generar una habitacion
  - Modificar sus propiedades (color, tamanyo, posicion...)
  - Guardar el escenario en GitHub con el comando "Guarda el escenario"

La escena se genera automaticamente`
  },

  renderHelpPanel() {
    const cameraEl = this.el.sceneEl.querySelector("[camera]");

    if (!cameraEl) {
      console.warn("help-panel: cámara no encontrada");
      return;
    }

    this.clearPanel();
    if (this.hud) {
      this.hud.setAttribute("visible", false);
    }

    const panel = document.createElement("a-plane");
    panel.setAttribute("width", "1.6");
    panel.setAttribute("height", "1.8");
    panel.setAttribute("color", "#111111");
    panel.setAttribute("opacity", "0.85");
    panel.setAttribute(
      "material",
      "shader: flat; side: double; transparent: true"
    );
    panel.setAttribute("position", "0 0 -2.2");
    panel.setAttribute("rotation", "0 0 0");

    const textEl = document.createElement("a-text");
    textEl.setAttribute("value", this.getHelpText());
    textEl.setAttribute("color", "#FFFFFF");
    textEl.setAttribute("align", "left");
    textEl.setAttribute("anchor", "left");
    textEl.setAttribute("wrap-count", "35");
    textEl.setAttribute("baseline", "top");
    textEl.setAttribute("position", "-0.6 0.7 0.01");
    textEl.setAttribute("scale", "0.23 0.23 0.23");

    panel.appendChild(textEl);
    cameraEl.appendChild(panel);

    this.currentPanel = panel;

    this.hideTimeout = setTimeout(() => {
      this.clearPanel();
    }, 10000);
  }
});