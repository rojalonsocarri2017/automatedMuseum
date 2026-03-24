AFRAME.registerComponent("text-input", {
  init() {
    const input = document.getElementById("text-input");
    const sendBtn = document.getElementById("text-send");
    const statusDiv = document.getElementById("status");
    const scene = this.el.sceneEl;

    if (!input || !sendBtn) {
      console.warn("text-input: no se encontraron #text-input o #text-send");
      return;
    }

    const sendCommand = () => {
      const text = input.value.trim();
      if (!text) return;

      statusDiv.textContent = `⌨️ Comando enviado: ${text}`;
      scene.emit("user-command", { text });
      input.value = "";
    };

    sendBtn.addEventListener("click", sendCommand);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendCommand();
      }
    });
  }
});