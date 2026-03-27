let model;
let recognizer;
let audioCtx;
let micSource;
let processor;
let stream;

let accumulatedText = "";
let lastResultText = "";
let currentPartialText = "";

let isListening = false;
let isStopping = false;

AFRAME.registerComponent("voice-input-vosk", {
  init() {

    console.log("🎤 voice-input inicializado");

    this.statusDiv = document.getElementById("status");
    this.yamlOutput = document.getElementById("yamlOutput");

    this.startBtn = document.getElementById("start");
    this.stopBtn = document.getElementById("stop");

    this.vrStatus = document.getElementById("vrStatus");
    this.vrPartial = document.getElementById("vrPartial");
    this.scene = document.getElementById("vr-scene");

    if (this.startBtn)
      this.startBtn.addEventListener("click", () => this.startListening());

    if (this.stopBtn)
      this.stopBtn.addEventListener("click", () => this.stopListening());

    this.loadVosk();

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

  /*************************************************
   * CARGA MODELO
   *************************************************/
  async loadVosk(){
    this.statusDiv.textContent = "🔄 Cargando modelo Vosk...";
    const base = window.location.pathname.includes("automatedMuseum")
	  ? "/automatedMuseum"
	  : "";
	
	const modelUrl = `${base}/TFG/model/vosk-model-small-es-0.42.tar.gz`;
    model = await Vosk.createModel(modelUrl);
    this.statusDiv.textContent = "✅ Modelo listo";
    console.log("✅ Vosk listo");

  },

  /*************************************************
   * START LISTENING
   *************************************************/
	async startListening() {
		if (!model) { this.statusDiv.textContent = "⚠️ Modelo aún cargando..."; return; }

		try {
      isListening = true;
      isStopping = false;
      accumulatedText = "";
      lastResultText = "";
      currentPartialText = "";
      this.setStatusText("🎤 Escuchando...");
      this.setPartialText("");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      audioCtx = new AudioContext();
      micSource = audioCtx.createMediaStreamSource(stream);
      recognizer = new model.KaldiRecognizer(audioCtx.sampleRate);

      recognizer.on("partialresult", (msg) => {
        if (!isListening || isStopping) return;
        const partial = msg.result?.partial?.trim() || "";
        currentPartialText = partial;

        if (partial) {
          this.setStatusText("🎤 " + partial);
        }
      });

			recognizer.on("result", (msg) => {
        if (!isListening || isStopping) return;
				const text = msg.result?.text?.trim();
				if (!text) return;
				if (text !== lastResultText) {
					accumulatedText += (accumulatedText ? " " : "") + text;
					lastResultText = text;
					console.log("📝 Texto acumulado:", accumulatedText);
				}
        currentPartialText = "";
        this.setStatusText("🎤 " + accumulatedText);
			});

			processor = audioCtx.createScriptProcessor(2048, 1, 1);
			processor.onaudioprocess = (e) => { try { recognizer.acceptWaveform(e.inputBuffer); } catch (err) { console.warn("acceptWaveform error", err); } };
			micSource.connect(processor);
			processor.connect(audioCtx.destination);

		} catch (err) {
			console.error(err);
      isListening = false;
      isStopping = false;
			this.statusDiv.textContent = "❌ Error micrófono";
		}
	},

  /*************************************************
   * STOP LISTENING
   *************************************************/
  async stopListening() {
    if (!processor) return;
    isStopping = true;
    isListening = false;

    // this.setStatusText("⏹️ Parando...");

    let finalText = accumulatedText.trim();
    const partial = currentPartialText.trim();

    if (partial) {
      if (!finalText) {
        finalText = partial;
      } else if (!finalText.endsWith(partial)) {
        finalText = `${finalText} ${partial}`.trim();
      }
    }
    this.setPartialText(finalText);

    processor.disconnect();
    micSource.disconnect();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    await audioCtx.close();

    recognizer = null;
    processor = null;
    micSource = null;
    audioCtx = null;

    lastResultText = "";
    accumulatedText = "";
    currentPartialText = "";

    console.log("📝 Texto final enviado:", finalText);

    if (finalText) {
      // this.setStatusText("🤖 Generando YAML...");

      this.el.sceneEl.emit("user-command", {
        text: finalText,
        source: "voice"
      });
    } else {
      this.setStatusText("⚠️ No se ha detectado voz");
      this.setPartialText("");
    }
    isStopping = false;
  }
});
