AFRAME.registerComponent("error-push-panel", {
  init() {
    this.currentPanel = null;
    this.hideTimeout = null;
    this.hud = document.getElementById("hud");

    this.onShowErrorPush = (e) => {
      const message =
        e.detail?.message ||
        "❌ No se ha podido guardar el escenario en GitHub.";
      this.renderErrorPushPanel(message);
    };

    this.el.sceneEl.addEventListener(
      "show-error-push-panel",
      this.onShowErrorPush
    );
  },

  remove() {
    if (this.el.sceneEl) {
      this.el.sceneEl.removeEventListener(
        "show-error-push-panel",
        this.onShowErrorPush
      );
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

  renderErrorPushPanel(message) {
    const cameraEl = this.el.sceneEl.querySelector("[camera]");

    if (!cameraEl) {
      console.warn("error-push-panel: cámara no encontrada");
      return;
    }

    this.clearPanel();
    if (this.hud) {
      this.hud.setAttribute("visible", false);
    }

    const panel = document.createElement("a-plane");
    panel.setAttribute("width", "2.8");
    panel.setAttribute("height", "1.2");
    panel.setAttribute("color", "#ff4444");
    panel.setAttribute("opacity", "0.85");
    panel.setAttribute(
      "material",
      "shader: flat; side: double; transparent: true"
    );
    panel.setAttribute("position", "0 0 -3");
    panel.setAttribute("rotation", "0 0 0");

    const text = document.createElement("a-text");
    text.setAttribute("value", message);
    text.setAttribute("color", "#ffffff");
    text.setAttribute("align", "center");
    text.setAttribute("anchor", "center");
    text.setAttribute("wrap-count", "28");
    text.setAttribute("position", "0 0 0.01");
    text.setAttribute("scale", "0.45 0.45 0.45");

    panel.appendChild(text);
    cameraEl.appendChild(panel);

    this.currentPanel = panel;

    this.hideTimeout = setTimeout(() => {
      if (this.currentPanel === panel) {
        this.clearPanel();
      }
    }, 5000);
  }
});