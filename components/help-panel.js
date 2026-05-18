import { OBJECT_CATALOG } from "./objects-catalog.js";

AFRAME.registerComponent("help-panel", {
  schema: {
    showOnStart: { type: "boolean", default: true }
  },

  init() {
    this.currentPanel = null;
    this.hud = document.getElementById("hud");

    this.onShowHelp = () => {
      this.renderHelpPanel();
    };

    this.el.sceneEl.addEventListener("show-help-panel", this.onShowHelp);

    if (this.data.showOnStart) {
      this.el.sceneEl.addEventListener(
        "loaded",
        () => {
          setTimeout(() => this.renderHelpPanel(), 500);
        },
        { once: true }
      );
    }
  },

  remove() {
    if (this.el.sceneEl) {
      this.el.sceneEl.removeEventListener("show-help-panel", this.onShowHelp);
    }

    this.clearPanel();
  },

  clearPanel() {
    if (this.currentPanel && this.currentPanel.parentNode) {
      this.currentPanel.parentNode.removeChild(this.currentPanel);
    }
    this.currentPanel = null;
    const vrStatus = document.getElementById("vrStatus");
    const vrPartial = document.getElementById("vrPartial");

    if (vrStatus) vrStatus.setAttribute("value", "");
    if (vrPartial) vrPartial.setAttribute("value", "");

    if (this.hud) {
      this.hud.setAttribute("visible", false);
    }

    this.el.sceneEl.emit("help-panel-closed");
  },

  getHelpText() {
    return `
BIENVENIDO AL SISTEMA DE CREACION DE ESCENAS XR CON LENGUAJE NATURAL

Este sistema permite crear y editar escenas XR usando lenguaje natural.

Puedes interactuar de dos formas:
  - Voz: en VR manten pulsado el boton de atras del mando derecho y habla. En escritorio pulsa el boton 'Hablar' desde el panel 'Control de habitacion'.
  - Texto: escribe un comando desde el panel 'Control de habitacion'

Puedes pedir:
  - Crear escenas completas mediante figuras geometricas.
  - Cambiar las dimensiones de la habitacion.
  - Insertar objetos en 3D y figuras de A-Frame.
  - Modificar propiedades de los objetos.
  - Guardar el escenario en GitHub.

Ejemplos:
  - "Crea una playa con sombrillas"
  - "Crea un bosque con arboles y un rio"
  - "Pon una esfera roja"
  - "Guarda el escenario"

Di "muestra un panel de ayuda" para volver a abrir este panel.
`.trim();
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

    const container = document.createElement("a-entity");
    container.setAttribute("position", "0 0 -2.2");
    container.setAttribute("rotation", "0 0 0");

    const panel = document.createElement("a-plane");
    panel.setAttribute("width", "2.2");
    panel.setAttribute("height", "1.9");
    panel.setAttribute("color", "#111111");
    panel.setAttribute("opacity", "0.9");
    panel.setAttribute(
      "material",
      "shader: flat; side: double; transparent: true"
    );

    const closeBg = document.createElement("a-circle");
    closeBg.setAttribute("radius", "0.11");
    closeBg.setAttribute("color", "#ff4444");
    closeBg.setAttribute("position", "0.78 0.82 0.02");
    closeBg.setAttribute("class", "clickable");
    closeBg.setAttribute("material", "shader: flat");

    const closeText = document.createElement("a-text");
    closeText.setAttribute("value", "X");
    closeText.setAttribute("color", "#ffffff");
    closeText.setAttribute("align", "center");
    closeText.setAttribute("anchor", "center");
    closeText.setAttribute("baseline", "center");
    closeText.setAttribute("position", "0.78 0.82 0.03");
    closeText.setAttribute("scale", "0.28 0.28 0.28");
    closeText.setAttribute("class", "clickable");
    closeText.setAttribute("material", "shader: flat");

    closeBg.addEventListener("click", () => this.clearPanel());
    closeText.addEventListener("click", () => this.clearPanel());

    const textEl = document.createElement("a-text");
    textEl.setAttribute("value", this.getHelpText());
    textEl.setAttribute("color", "#FFFFFF");
    textEl.setAttribute("align", "left");
    textEl.setAttribute("anchor", "left");
    textEl.setAttribute("baseline", "top");
    textEl.setAttribute("material", "shader: flat");
    textEl.setAttribute("width", "6");
    textEl.setAttribute("wrap-count", "70");
    textEl.setAttribute("scale", "0.33 0.33 0.33");
    textEl.setAttribute("position", "-0.98 0.68 0.02");

    container.appendChild(panel);
    container.appendChild(closeBg);
    container.appendChild(closeText);
    container.appendChild(textEl);

    cameraEl.appendChild(container);

    this.currentPanel = container;
    this.el.sceneEl.emit("help-panel-opened");
  }
});