import { OBJECT_CATALOG } from "./objects-catalog.js";

AFRAME.registerComponent("help-panel", {
  init() {
    this.currentPanel = null;
    this.hideTimeout = null;

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

    this.currentPanel = null;
  },

  getHelpText() {
    return `
Puedes hacer lo siguiente:
HABITACION:
- Cambiar las dimensiones de la habitacion
- Cambiar un tipo de pared que elijas en la habitacion
- Cambiar el color del cielo
- Activar o desactivar las estrellas

Modelos 3D disponibles:
${Object.keys(OBJECT_CATALOG).join(", ")}

Objetos A-Frame:
box, sphere, cylinder, cone, plane, circle, torus.

Para los objetos 3D y objetos A-Frame puedes definir:
- color
- posicion (x, y, z)
- rotacion (x, y, z)
- scale (x, y, z)
`.trim();
  },

  renderHelpPanel() {
    const cameraEl = this.el.sceneEl.querySelector("[camera]");

    if (!cameraEl) {
      console.warn("help-panel: cámara no encontrada");
      return;
    }

    this.clearPanel();

    const textValue = this.getHelpText();

    const panel = document.createElement("a-plane");
    panel.setAttribute("width", "3.6");
    panel.setAttribute("height", "2.4");
    panel.setAttribute("color", "#111111");
    panel.setAttribute("opacity", "0.85");
    panel.setAttribute(
      "material",
      "shader: flat; side: double; transparent: true"
    );
    panel.setAttribute("position", "0 0 -3");
    panel.setAttribute("rotation", "0 0 0");

    const textEl = document.createElement("a-text");
    textEl.setAttribute("value", this.getHelpText());
    textEl.setAttribute("color", "#FFFFFF");
    textEl.setAttribute("align", "center");
    textEl.setAttribute("anchor", "center");
    textEl.setAttribute("wrap-count", "34");
    textEl.setAttribute("baseline", "center");
    textEl.setAttribute("position", "0 0 0.01");
    textEl.setAttribute("scale", "0.25 0.25 0.25");

    panel.appendChild(textEl);
    cameraEl.appendChild(panel);

    this.currentPanel = panel;

    this.hideTimeout = setTimeout(() => {
      this.clearPanel();
    }, 10000);
  }
});