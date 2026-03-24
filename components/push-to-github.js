AFRAME.registerComponent("push-to-github", {
  schema: {
    owner: { type: "string", default: "rojalonsocarri2017" },
    repo: { type: "string", default: "automatedMuseum" },
    filePath: { type: "string", default: "room.yaml" },
    branch: { type: "string", default: "main" },
    token: { type: "string", default: "" },
    inputEvent: { type: "string", default: "save-scene-command" },
    stateSelector: { type: "string", default: "[scene-orchestrator]" },
    statusSelector: { type: "string", default: "#status" },
    outputSelector: { type: "string", default: "#yamlOutput" }
  },

  init() {
    this.scene = this.el.sceneEl;
    this.statusDiv = document.querySelector(this.data.statusSelector);
    this.yamlOutput = document.querySelector(this.data.outputSelector);
    this.GITHUB_PAT = this.data.token;

    this.onSaveScene = async () => {
      try {
        this.status("💾 Preparando room.yaml...");

        const yamlContent = this.getCurrentRoomYaml();
        if (!yamlContent) {
          throw new Error("No hay escenario actual para guardar");
        }

        if (this.yamlOutput) {
          this.yamlOutput.textContent = yamlContent;
        }

        await this.pushYamlToGithub(yamlContent);
      } catch (err) {
        console.error("❌ push-to-github:", err);
        this.status(`❌ Error GitHub: ${err.message}`);
      }
    };

    this.scene.addEventListener(this.data.inputEvent, this.onSaveScene);
  },

  remove() {
    this.scene.removeEventListener(this.data.inputEvent, this.onSaveScene);
  },

  status(message) {
    if (this.statusDiv) {
      this.statusDiv.textContent = message;
    }
  },

  normalizePathsForGithub(roomData) {
    if (!roomData?.room) return;

    const fixPath = (value) => {
      if (typeof value !== "string") return value;

      if (value.startsWith("../assets/")) {
        return value.replace("../assets/", "./assets/");
      }

      return value;
    };

    if (roomData.room.textures) {
      roomData.room.textures.floor = fixPath(roomData.room.textures.floor);
      roomData.room.textures.wall = fixPath(roomData.room.textures.wall);
      roomData.room.textures.ceiling = fixPath(roomData.room.textures.ceiling);
    }

    if (Array.isArray(roomData.room.objects)) {
      roomData.room.objects.forEach((obj) => {
        if (obj.src) obj.src = fixPath(obj.src);
        if (obj.texture) obj.texture = fixPath(obj.texture);
        if (obj.modelPath) obj.modelPath = fixPath(obj.modelPath);
      });
    }
  },

  getCurrentRoomYaml() {
    const orchestratorEl = document.querySelector(this.data.stateSelector);
    const orchestrator = orchestratorEl?.components["scene-orchestrator"];
    const currentRoom = orchestrator?.currentRoom;

    if (!currentRoom) {
      console.error("push-to-github: no se encontró currentRoom");
      return null;
    }

    const roomForGithub = structuredClone(currentRoom);
    this.normalizePathsForGithub(roomForGithub);

    return jsyaml.dump(roomForGithub, { indent: 2 });
  },

  async pushYamlToGithub(yamlContent) {
    if (!this.GITHUB_PAT) {
      this.status("❌ No hay token de GitHub configurado");
      this.el.sceneEl.emit("show-error-push-panel", {
        message: "❌ No hay token de GitHub configurado."
      });
      return;
    }

    const { owner, repo, filePath, branch } = this.data;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    try {
      const base64Content = btoa(unescape(encodeURIComponent(yamlContent)));

      this.status("📡 Consultando room.yaml en GitHub...");

      const getResponse = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
        method: "GET",
        headers: {
          Authorization: `token ${this.GITHUB_PAT}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "XR-Room-Saver"
        }
      });

      let sha;

      if (getResponse.status === 200) {
        const fileInfo = await getResponse.json();
        sha = fileInfo.sha;
      } else if (getResponse.status !== 404) {
        const errText = await getResponse.text();
        throw new Error(`GET ${getResponse.status}: ${errText}`);
      }

      this.status("🚀 Subiendo room.yaml a GitHub...");

      const body = {
        message: `Push automático: Guardar escenario XR (${new Date().toISOString()})`,
        content: base64Content,
        branch
      };

      if (sha) body.sha = sha;

      const putResponse = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `token ${this.GITHUB_PAT}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "XR-Room-Saver"
        },
        body: JSON.stringify(body)
      });

      if (!putResponse.ok) {
        const error = await putResponse.text();
        throw new Error(`PUT ${putResponse.status}: ${error}`);
      }

      const result = await putResponse.json();
      const fileUrl = result?.content?.html_url;

      this.status("✅ Escenario guardado en GitHub");
      this.el.sceneEl.emit("show-success-push-panel", {
        message: "✅ Escenario guardado correctamente en GitHub."
      });

      const previous = document.getElementById("github-room-link");
      if (previous) previous.remove();

      if (fileUrl && this.yamlOutput) {
        const link = document.createElement("div");
        link.id = "github-room-link";
        link.style.marginTop = "10px";
        link.innerHTML = `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer">📂 Ver room.yaml en GitHub</a>`;
        this.yamlOutput.insertAdjacentElement("afterend", link);
      }
    } catch (err) {
      console.error("Error en pushYamlToGithub:", err);
      this.status(`❌ GitHub Error: ${err.message}`);
      this.el.sceneEl.emit("show-error-push-panel", {
        message: "❌ No se ha ejecutado el push en GitHub."
      });
    }
  }
});
