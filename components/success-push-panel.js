AFRAME.registerComponent("success-push-panel", {
  init() {
    this.currentPanel = null;
    this.hideTimeout = null;

    this.onShowSuccess = (e) => {
      const message =
        e.detail?.message || "✅ Escenario guardado correctamente en GitHub.";
      this.renderSuccessPanel(message);
    };

    this.el.sceneEl.addEventListener(
      "show-success-push-panel",
      this.onShowSuccess
    );
  },

  remove() {
    if (this.el.sceneEl) {
      this.el.sceneEl.removeEventListener(
        "show-success-push-panel",
        this.onShowSuccess
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

    this.currentPanel = null;
  },

  renderSuccessPanel(message) {
    const cameraEl = this.el.sceneEl.querySelector("[camera]");

    if (!cameraEl) {
      console.warn("success-push-panel: cámara no encontrada");
      return;
    }

    this.clearPanel();

    const panel = document.createElement("a-plane");
    panel.setAttribute("width", "2.8");
    panel.setAttribute("height", "1.2");
    panel.setAttribute("color", "#22c55e");
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

