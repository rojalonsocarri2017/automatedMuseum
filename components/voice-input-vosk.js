let model;
let recognizer;
let audioCtx;
let micSource;
let processor;

let accumulatedText = "";
let lastResultText = "";

AFRAME.registerComponent("voice-input-vosk", {
  init() {

    console.log("🎤 voice-input inicializado");

    this.statusDiv = document.getElementById("status");
    this.yamlOutput = document.getElementById("yamlOutput");

    this.startBtn = document.getElementById("start");
    this.stopBtn = document.getElementById("stop");

    if (this.startBtn)
      this.startBtn.addEventListener("click", () => this.startListening());

    if (this.stopBtn)
      this.stopBtn.addEventListener("click", () => this.stopListening());

    this.loadVosk();

  },

  /*************************************************
   * CARGA MODELO
   *************************************************/
  async loadVosk(){
    this.statusDiv.textContent = "🔄 Cargando modelo Vosk...";
    const modelUrl =  "./ejcConComponentes/model/vosk-model-small-es-0.42.tar.gz"
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
			const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
			audioCtx = new AudioContext();
			micSource = audioCtx.createMediaStreamSource(stream);
			recognizer = new model.KaldiRecognizer(audioCtx.sampleRate);

			recognizer.on("partialresult", (msg) => {
				const partial = msg.result?.partial;
				if (partial) this.statusDiv.textContent = "🎤 " + partial;
			});

			recognizer.on("result", (msg) => {
				const text = msg.result?.text?.trim();
				if (!text) return;
				if (text !== lastResultText) {
					accumulatedText += (accumulatedText ? " " : "") + text;
					lastResultText = text;
					console.log("📝 Texto acumulado:", accumulatedText);
				}
			});

			processor = audioCtx.createScriptProcessor(4096, 1, 1);
			processor.onaudioprocess = (e) => { try { recognizer.acceptWaveform(e.inputBuffer); } catch (err) { console.warn("acceptWaveform error", err); } };
			micSource.connect(processor);
			processor.connect(audioCtx.destination);

			accumulatedText = "";
			lastResultText = "";
			this.statusDiv.textContent = "🎤 Escuchando...";

		} catch (err) {
			console.error(err);
			this.statusDiv.textContent = "❌ Error micrófono";
		}
	},

  /*************************************************
   * STOP LISTENING
   *************************************************/
	async stopListening() {
		if (!processor) return;
		processor.disconnect();
		micSource.disconnect();
		await audioCtx.close();

		this.statusDiv.textContent = "⏹️ Parado. Procesando texto...";
		console.log("📝 Texto final acumulado:", accumulatedText);

		recognizer = null;
		processor = null;
		audioCtx = null;

		lastResultText = "";
		let finalText = accumulatedText.trim();
		accumulatedText = "";

		if (finalText) {

			console.log("📤 Enviando comando al LLM:", finalText);

			this.el.sceneEl.emit("user-command", {
        text: finalText,
        source: "voice"
			});
		}
		else {
			this.statusDiv.textContent = "⚠️ No se detectó voz";
		}
	}
});
