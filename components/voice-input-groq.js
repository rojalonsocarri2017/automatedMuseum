AFRAME.registerComponent("voice-input-groq", {
  schema: {
    apiUrl: { default: "https://api.groq.com/openai/v1/audio/transcriptions" },
    apiKey: { default: "<YOUR_API_KEY>" },
    model: { default: "whisper-large-v3" }
  },

  init() {
    this.statusDiv = document.getElementById("status");
    this.startBtn = document.getElementById("start");
    this.stopBtn = document.getElementById("stop");

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;

    this.startHandler = () => this.startRecording();
    this.stopHandler = () => this.stopRecording();

    if (this.startBtn) this.startBtn.addEventListener("click", this.startHandler);
    if (this.stopBtn) this.stopBtn.addEventListener("click", this.stopHandler);
  },

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.statusDiv.textContent = "❌ Micrófono no soportado";
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstart = () => {
        this.statusDiv.textContent = "🎤 Grabando... pulsa detener para enviar";
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error("❌ Error al abrir micrófono:", err);
      this.statusDiv.textContent = "❌ Error de micrófono";
    }
  },

  async stopRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.onstop = async () => {
      try {
        this.statusDiv.textContent = "⏳ Procesando audio...";

        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const transcription = await this.enviarAGroq(audioBlob);

        if (transcription) {
          console.log("📝 Texto transcrito:", transcription);

          this.el.sceneEl.emit("user-command", {
            text: transcription,
            source: "groq-whisper"
          });
        }
      } finally {
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
      }
    };

    this.mediaRecorder.stop();
  },

  async enviarAGroq(audioBlob) {
    try {
      if (!this.data.apiKey) {
        this.statusDiv.textContent = "❌ Falta API key de Groq";
        return null;
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "voz.webm");
      formData.append("model", this.data.model);

      const response = await fetch(this.data.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.data.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ Error Groq Whisper:", errText);
        this.statusDiv.textContent = "❌ Error transcripción";
        return null;
      }

      const data = await response.json();
      return data.text || null;
    } catch (err) {
      console.error("❌ Fallo en envío a Groq:", err);
      this.statusDiv.textContent = "❌ Error Groq";
      return null;
    }
  },

  remove() {
    if (this.startBtn) this.startBtn.removeEventListener("click", this.startHandler);
    if (this.stopBtn) this.stopBtn.removeEventListener("click", this.stopHandler);

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }
});