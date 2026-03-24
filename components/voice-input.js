AFRAME.registerComponent("voice-input", {
  schema: {
    engine: { default: "vosk" } // vosk | speechapi | groq
  },

  init() {
    const engine = (this.data.engine || "vosk").toLowerCase();

    if (engine === "vosk") {
      this.el.setAttribute("voice-input-vosk", "");
    } else if (engine === "speechapi") {
      this.el.setAttribute("voice-input-speechapi", "");
    } else if (engine === "groq") {
      this.el.setAttribute("voice-input-groq", "");
    } else {
      console.warn(`voice-input: motor no soportado: ${engine}`);
    }
  }
});