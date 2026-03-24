AFRAME.registerComponent("voice-input-speechapi", {
  init() {
    this.statusDiv = document.getElementById("status");
    this.startBtn = document.getElementById("start");
    this.stopBtn = document.getElementById("stop");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("❌ SpeechRecognition no soportado en este navegador");
      if (this.statusDiv) {
        this.statusDiv.textContent = "Estado: No soportado en este navegador";
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;

    let textoAcumulado = "";
    let silencioTimeout = null;
    const TIEMPO_SILENCIO_MS = 2000;

    recognition.onstart = () => {
      if (this.statusDiv) {
        this.statusDiv.textContent = "Estado: Escuchando...";
      }
      console.log("🎤 Escuchando...");
    };

    recognition.onresult = (event) => {
      let textoParcial = "";
      console.log(" onresult - Resultado recibido:", event);

      for (let i = event.resultIndex; i < event.results.length; i++) {
        textoParcial += event.results[i][0].transcript;
      }

      textoAcumulado = textoParcial.trim();

      console.clear();
      console.log("🎙️ Texto parcial:");
      console.log(textoAcumulado);

      if (this.statusDiv) {
        this.statusDiv.textContent = "Estado: Escuchando...";
      }

      if (silencioTimeout) clearTimeout(silencioTimeout);

      silencioTimeout = setTimeout(() => {
        console.log("⏱️ Silencio detectado (2s)");
        recognition.stop();

        if (textoAcumulado) {
          this.el.sceneEl.emit("user-command", {
            text: textoAcumulado,
            source: "speechapi"
          });
        }

        textoAcumulado = "";
      }, TIEMPO_SILENCIO_MS);
    };

    recognition.onerror = (event) => {
      console.error("❌ Error reconocimiento:", event.error);
      if (this.statusDiv) {
        this.statusDiv.textContent = `Error: ${event.error}`;
      }
    };

    recognition.onend = () => {
      if (this.statusDiv) {
        this.statusDiv.textContent = "Estado: Inactivo";
      }
      console.log("🛑 Reconocimiento detenido");
    };

    if (this.startBtn) {
      this.startBtn.onclick = () => {
        try {
          recognition.start();
        } catch (err) {
          console.warn("No se pudo iniciar recognition:", err);
        }
      };
    }

    if (this.stopBtn) {
      this.stopBtn.onclick = () => {
        try {
          recognition.stop();
        } catch (err) {
          console.warn("No se pudo detener recognition:", err);
        }
      };
    }

    this.recognition = recognition;
  },

  remove() {
    if (this.startBtn) {
      this.startBtn.onclick = null;
    }

    if (this.stopBtn) {
      this.stopBtn.onclick = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
  }
});