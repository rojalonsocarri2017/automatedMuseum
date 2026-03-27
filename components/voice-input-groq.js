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

    this.vrStatus = document.getElementById("vrStatus");
    this.vrPartial = document.getElementById("vrPartial");
    this.scene = document.getElementById("vr-scene");

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.isStopping = false;

    this.startHandler = () => this.startRecording();
    this.stopHandler = () => this.stopRecording();

    if (this.startBtn) this.startBtn.addEventListener("click", this.startHandler);
    if (this.stopBtn) this.stopBtn.addEventListener("click", this.stopHandler);
  },

  isInVRMode() {
    return this.scene && this.scene.is("vr-mode");
  },

  setStatusText(text) {
    if (this.statusDiv) this.statusDiv.textContent = text;
    if (this.isInVRMode() && this.vrStatus) {
      this.vrStatus.setAttribute("value", text);
    }
  },

  setPartialText(text) {
    if (this.isInVRMode() && this.vrPartial) {
      this.vrPartial.setAttribute("value", text || "");
    }
  },

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setStatusText("❌ Micrófono no soportado");
      return;
    }

    if (this.isRecording) return;

    try {
      this.isRecording = true;
      this.isStopping = false;
      this.audioChunks = [];
      this.setStatusText("🎤 Escuchando...");
      this.setPartialText("");

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        }
      });

      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        this.setStatusText("🎤 Escuchando...");
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error("❌ Error al abrir micrófono:", err);
      this.isRecording = false;
      this.isStopping = false;
      this.setStatusText("❌ Error de micrófono");
      this.setPartialText("");
    }
  },

  async stopRecording() {
    if (!this.mediaRecorder || this.isStopping) return;

    this.isStopping = true;
    this.isRecording = false;

    this.mediaRecorder.onstop = async () => {
      try {
        this.setStatusText("⏳ Transcribiendo audio...");

        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const transcription = await this.enviarAGroq(audioBlob);

        if (transcription) {
          console.log("📝 Texto transcrito:", transcription);
          this.setStatusText("🤖 Generando YAML...");
          this.setPartialText(transcription);

          this.el.sceneEl.emit("user-command", {
            text: transcription,
            source: "groq-whisper"
          });
        } else {
          this.setStatusText("⚠️ No se ha detectado voz");
          this.setPartialText("");
        }
      } finally {
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }

        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isStopping = false;
      }
    };

    this.mediaRecorder.stop();
  },

  async enviarAGroq(audioBlob) {
    try {
      if (!this.data.apiKey) {
        this.setStatusText("❌ Falta API key de Groq");
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
        this.setStatusText("❌ Error transcripción");
        return null;
      }

      const data = await response.json();
      return data.text || null;
    } catch (err) {
      console.error("❌ Fallo en envío a Groq:", err);
      this.setStatusText("❌ Error Groq");
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