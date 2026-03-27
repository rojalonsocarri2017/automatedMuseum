import { OBJECT_CATALOG } from "./objects-catalog.js";
import { ALLOWED_PRIMITIVES } from "./primitives-manager.js";

AFRAME.registerComponent("llm-client", {
  schema: {
    model: { type: "string", default: "openrouter/auto" },
    url: { type: "string", default: "https://openrouter.ai/api/v1/chat/completions" },
    openrouterApikey: { type: "string", default: "" },
    inputEvent: { type: "string", default: "scene-edit-command" },
    outputEvent: { type: "string", default: "yaml-generated" },
    stateSelector: { type: "string", default: "[scene-orchestrator]" },
    statusSelector: { type: "string", default: "#status" },
    outputSelector: { type: "string", default: "#yamlOutput" },
    autoDetectCapabilities: { type: "boolean", default: true },
    enableRoomRules: { type: "boolean", default: true },
    enableObjects: { type: "boolean", default: true },
    enablePrimitives: { type: "boolean", default: true },
    enableSpatialRules: { type: "boolean", default: true },
    enableStackingRules: { type: "boolean", default: true },
    enableRelativePositionRules: { type: "boolean", default: true }
  },

  init() {
    this.OPENROUTER_API_KEY = this.data.openrouterApikey;
    this.MODEL = this.data.model;
    this.OPENROUTER_URL = this.data.url;

    this.scene = this.el.sceneEl;
    this.yamlOutput = document.querySelector(this.data.outputSelector);
    this.statusDiv = document.querySelector(this.data.statusSelector);

    this.isGenerating = false;
    this.debounceTimer = null;
    this.lastCommand = "";
    this.lastCommandAt = 0;

    this.onSceneEdit = (e) => {
      const text = e.detail?.text?.trim();
      if (!text) return;

      clearTimeout(this.debounceTimer);

      this.debounceTimer = setTimeout(() => {
        const now = Date.now();

        if (text === this.lastCommand && now - this.lastCommandAt < 3000) {
          console.warn("Comando duplicado ignorado:", text);
          return;
        }

        this.lastCommand = text;
        this.lastCommandAt = now;

        this.generarYamlHabitacion(text);
      }, 800);
    };

    this.scene.addEventListener(this.data.inputEvent, this.onSceneEdit);
  },

  remove() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.scene && this.onSceneEdit) {
      this.scene.removeEventListener(this.data.inputEvent, this.onSceneEdit);
    }
  },

  getCurrentRoom() {
    const orchestrator = document.querySelector(this.data.stateSelector);
    return orchestrator?.components["scene-orchestrator"]?.currentRoom || null;
  },

  setStatus(message) {
    if (this.statusDiv) this.statusDiv.textContent = message;

    const vrStatus = document.getElementById("vrStatus");
    if (vrStatus && this.scene?.is("vr-mode")) {
      vrStatus.setAttribute("value", message);
    }
  },

  normalizarYAML(yaml) {
    return String(yaml || "")
      .replace(/```yaml/g, "")
      .replace(/```/g, "")
      .replace(/\t/g, "  ")
      .trim();
  },

  completarRoomDefaults(newRoom, currentRoom) {
    const base = structuredClone(currentRoom || { room: {} });
    const next = structuredClone(newRoom || { room: {} });

    base.room = base.room || {};
    next.room = next.room || {};

    return {
      room: {
        ...base.room,
        ...next.room,
        walls: {
          ...(base.room.walls || {}),
          ...(next.room.walls || {})
        },
        textures: {
      ...(base.room.textures || {}),
      ...(next.room.textures || {})
        },
        entryPoint: {
      ...(base.room.entryPoint || {}),
      ...(next.room.entryPoint || {})
        },
        environment: {
      ...(base.room.environment || {}),
      ...(next.room.environment || {})
        },
        lights: Array.isArray(next.room.lights)
          ? next.room.lights
          : base.room.lights || [],
        objects: Array.isArray(next.room.objects)
          ? next.room.objects
          : base.room.objects || []
      }
    };
  },

  resolveCapabilities() {
    if (!this.data.autoDetectCapabilities) {
      return {
        roomRules: this.data.enableRoomRules,
        objects: this.data.enableObjects,
        primitives: this.data.enablePrimitives,
        spatialRules: this.data.enableSpatialRules,
        stackingRules: this.data.enableStackingRules,
        relativePositionRules: this.data.enableRelativePositionRules
      };
    }

    const hasPrimitivesManager = !!this.scene.querySelector("[primitives-manager]");
    const hasObjectCatalog =
      !!OBJECT_CATALOG && Object.keys(OBJECT_CATALOG).length > 0;

    return {
      roomRules: this.data.enableRoomRules,
      objects: this.data.enableObjects && hasObjectCatalog,
      primitives: this.data.enablePrimitives && hasPrimitivesManager,
      spatialRules: this.data.enableSpatialRules,
      stackingRules: this.data.enableStackingRules && hasPrimitivesManager,
      relativePositionRules: this.data.enableRelativePositionRules
    };
  },

  getPromptIntro() {
    return `
Eres un sistema que convierte comandos de voz sobre una habitación 3D en YAML válido para A-Frame.

Tu tarea es actualizar el estado actual de la habitación en función de la instrucción del usuario.
`.trim();
  },

  getPromptClassificationAndState(currentRoom, descripcion) {
    return `
--------------------------------------------------
REGLA 1 — CLASIFICACIÓN
--------------------------------------------------

Si la instrucción NO tiene relación con:

- dimensiones de la habitación
- paredes
- entorno
- cielo
- estrellas
- objetos 3D
- primitivas A-Frame
- posición
- rotación
- tamaño
- color

Responde EXACTAMENTE:

#ERROR: Instruccion no valida. No se puede generar YAML.

--------------------------------------------------
REGLA 2 — ESTADO ACTUAL
--------------------------------------------------

Este es el estado actual de la habitación:

${jsyaml.dump(currentRoom)}

Debes modificar SOLO lo necesario según la instrucción.

Reglas:
- Si el usuario no menciona algo, se mantiene igual
- NO elimines objetos existentes
- Reutiliza objetos cuando sea posible
- Solo elimina objetos si el usuario lo pide explícitamente

--------------------------------------------------
ENTRADA DEL USUARIO
--------------------------------------------------

"${descripcion}"
`.trim();
  },

  getPromptAllowedChanges() {
    return `
--------------------------------------------------
REGLA 3 — CAMBIOS PERMITIDOS
--------------------------------------------------

El usuario puede modificar:

DIMENSIONES
- width
- depth
- height

PAREDES
- north
- east
- south
- west

Valores permitidos:
barrier | wall | glass

ENTORNO
- environment.skyColor
- environment.stars

OBJETOS
- crear
- mover
- rotar
- escalar
- cambiar color
- apilar
`.trim();
  },

  getPromptSpatialRules(currentRoom) {
    return `
--------------------------------------------------
REGLA 4 — COORDENADAS DEL LOUNGE
--------------------------------------------------

El centro de la habitación es:

x = 0
z = 0

Límites:

x: -width/2 a +width/2
z: -depth/2 a +depth/2

Para evitar paredes, usa siempre:

x: entre -width/2 + 10 y +width/2 - 10
z: entre -depth/2 + 10 y +depth/2 - 10

Altura:

y: entre 0 y 5

Suelo:

y = 0

--------------------------------------------------
REGLA 4.1 — COLOCACIÓN AUTOMÁTICA DE OBJETOS
--------------------------------------------------

Si el usuario crea objetos y NO especifica posición:

NUNCA coloques todos en x:0 z:0.

Distribuye los objetos dentro del lounge usando posiciones distintas.

Usa estos límites calculados dinámicamente:

x_min = -${currentRoom.room.width}/2 + 10
x_max = +${currentRoom.room.width}/2 - 10

z_min = -${currentRoom.room.depth}/2 + 10
z_max = +${currentRoom.room.depth}/2 - 10

Los objetos deben generarse SIEMPRE dentro de estos límites.

--------------------------------------------------
REGLA 4.2 — OBJETOS DENTRO DEL LOUNGE
--------------------------------------------------

NUNCA coloques objetos fuera de la habitación.

Reglas obligatorias:

x >= -${currentRoom.room.width}/2 + 10
x <= +${currentRoom.room.width}/2 - 10

z >= -${currentRoom.room.depth}/2 + 10
z <= +${currentRoom.room.depth}/2 - 10

y = 0 en objetos 3D
y = 2 en figuras aframe

Si un objeto existente está fuera de los límites, debes moverlo automáticamente a una posición válida dentro del lounge.
`.trim();
  },

  getPromptObjectsCatalog() {
    const models = Object.keys(OBJECT_CATALOG || {});
    if (!models.length) return "";

    return `
--------------------------------------------------
REGLA 5 — OBJETOS DISPONIBLES
--------------------------------------------------

Modelos 3D:

${models.join("\n")}

--------------------------------------------------
REGLA 6 — REGLAS DE OBJETOS
--------------------------------------------------
Por defecto, todos los objetos deben colocarse dentro de la habitacion. 

Si el usuario dice:

"pon una silla"

Crear:

model: chair_basic

Si dice:

"mesa roja"

Crear:

model: table_red

Si dice:

"lámpara"

Crear:

model: lamp_floor
`.trim();
  },

  getPromptPrimitives() {
    if (!Array.isArray(ALLOWED_PRIMITIVES) || !ALLOWED_PRIMITIVES.length) {
      return "";
    }

    return `
--------------------------------------------------
REGLA 7 — PRIMITIVAS A-FRAME
--------------------------------------------------
Por defecto, todos las primitivas A-Frame deben colocarse dentro de la habitacion. 
Primitivas A-Frame:

${ALLOWED_PRIMITIVES.join("\n")}

Para primitivas usa:

primitive: ${ALLOWED_PRIMITIVES.join(" | ")}

Estructura:

- name: string
  primitive: box
  color: "#rrggbb"
  position:
    x: number
    y: 2
    z: number
  rotation:
    x: 0
    y: number
    z: 0
  scale:
    x: 3
    y: 3
    z: 3

Regla:

Las primitivas deben tener scale 3 3 3 por defecto salvo que el usuario indique otro tamaño.
`.trim();
  },

  getPromptMultipleObjects() {
    return `
--------------------------------------------------
REGLA 8 — MULTIPLES OBJETOS
--------------------------------------------------

Si el usuario indica cantidad:

"5 cubos rojos"

Debes crear:

cubo_1
cubo_2
cubo_3
cubo_4
cubo_5

Todos con primitive: box.
`.trim();
  },

  getPromptStackingRules() {
    return `
--------------------------------------------------
REGLA 9 — APILAR OBJETOS
--------------------------------------------------

Si el usuario dice:

"pon un cubo encima de otro"
"apila los cubos"

No crees nuevos.

Busca todos:

primitive: box

Ordena por nombre.

Coloca cada cubo encima del anterior:

y = índice + 2

Ejemplo:

cubo_1 -> y: 1
cubo_2 -> y: 3
cubo_3 -> y: 5

Todos en la misma posicion x, posicion z.
`.trim();
  },

  getPromptModifyObjects() {
    return `
--------------------------------------------------
REGLA 10 — MODIFICAR OBJETOS EXISTENTES
--------------------------------------------------

Ejemplos:

"Cambia el color de la esfera a rosa"

Buscar:

primitive: sphere

Cambiar:

color: "#ff69b4"

---

"haz la mesa el doble de grande"

Buscar:

model: table_red

Cambiar:

scale: {x:2, y:2, z:2}

---

"mueve la silla a la izquierda"

Buscar:

model: chair_basic

Cambiar position.x.
`.trim();
  },

  getPromptRelativeRules() {
    return `
--------------------------------------------------
REGLA 10.1 — RELACIONES ESPACIALES RELATIVAS
--------------------------------------------------

Si el usuario dice:

- "a la derecha de X"
- "a la izquierda de X"
- "delante de X"
- "detrás de X"
- "encima de X"

Debes buscar el objeto X existente por:
- name
- primitive
- model

Usa estas separaciones por defecto:

SEPARACION_HORIZONTAL = 8
SEPARACION_VERTICAL = 4

Interpretación:

- derecha de X => nuevo.position.x = X.position.x + 8
- izquierda de X => nuevo.position.x = X.position.x - 8
- delante de X => nuevo.position.z = X.position.z - 8
- detrás de X => nuevo.position.z = X.position.z + 8
- encima de X => nuevo.position.y = X.position.y + 4

Si no se indica lo contrario:
- conserva el mismo z que X en izquierda/derecha
- conserva el mismo x que X en delante/detrás
- conserva x y z en encima de X

Ejemplo:
Si esfera_1 está en:
x: -8
y: 2
z: 0

y el usuario dice:
"pon un cubo azul a la derecha de la esfera"

entonces el nuevo cubo debe ir en:
x: 0
y: 2
z: 0

--------------------------------------------------
REGLA 10.2 — DESPLAZAMIENTOS POR DEFECTO
--------------------------------------------------

Si el usuario dice:
- "mueve X a la izquierda"
- "mueve X a la derecha"
- "mueve X hacia delante"
- "mueve X hacia atrás"

Y no indica distancia, usa DESPLAZAMIENTO = 8

Interpretación:
- izquierda => x = x - 8
- derecha => x = x + 8
- delante => z = z - 8
- detrás => z = z + 8
`.trim();
  },

  getPromptYamlFormat() {
    return `
--------------------------------------------------
REGLA 11 — FORMATO YAML OBLIGATORIO
--------------------------------------------------

Devuelve SIEMPRE esta estructura EXACTA:

room:
  width: number
  depth: number
  height: number
  ceiling: boolean

  walls:
    north: barrier|wall|glass
    east: barrier|wall|glass
    south: barrier|wall|glass
    west: barrier|wall|glass

  textures:
    floor: string
    wall: string
    ceiling: string

  entryPoint:
    x: number
    y: number
    z: number

  environment:
    skyColor: string
    stars: boolean

  lights:
    - type: ambient
      color: string
      intensity: number

  objects:
    - name: string
      model: chair_basic|table_red|lamp_floor|statue_liberty|statue_venus
      position:
        x: number
        y: number
        z: number
      rotation:
        x: 0
        y: number
        z: 0
      scale:
        x: number
        y: number
        z: number
`.trim();
  },

  getPromptRestrictions() {
    return `
--------------------------------------------------
REGLA 12 — RESTRICCIONES IMPORTANTES
--------------------------------------------------

MUY IMPORTANTE:

Números NUNCA entre comillas

Correcto:
x: 10
y: 0

Incorrecto:
x: "10"
y: '0'

También:
- position.x sin comillas
- position.y sin comillas
- position.z sin comillas
- rotation.x sin comillas
- rotation.y sin comillas
- rotation.z sin comillas
- scale.x sin comillas
- scale.y sin comillas
- scale.z sin comillas

--------------------------------------------------
REGLA 13 — LUCES
--------------------------------------------------

El campo lights debe estar SIEMPRE al mismo nivel que environment.

Nunca anides lights dentro de environment.

--------------------------------------------------
REGLA FINAL
--------------------------------------------------

Devuelve SOLO YAML válido.

Sin explicaciones.
Sin texto adicional.
Indentación: 2 espacios.
`.trim();
  },

  buildPrompt(currentRoom, descripcion) {
    const capabilities = this.resolveCapabilities();

    const parts = [
      this.getPromptIntro(),
      this.getPromptClassificationAndState(currentRoom, descripcion)
    ];

    if (capabilities.roomRules) {
      parts.push(this.getPromptAllowedChanges());
    }

    if (capabilities.spatialRules) {
      parts.push(this.getPromptSpatialRules(currentRoom));
    }

    if (capabilities.objects) {
      parts.push(this.getPromptObjectsCatalog());
      parts.push(this.getPromptModifyObjects());
    }

    if (capabilities.primitives) {
      parts.push(this.getPromptPrimitives());
      parts.push(this.getPromptMultipleObjects());
    }

    if (capabilities.stackingRules) {
      parts.push(this.getPromptStackingRules());
    }

    if (capabilities.relativePositionRules) {
      parts.push(this.getPromptRelativeRules());
    }

    parts.push(this.getPromptYamlFormat());
    parts.push(this.getPromptRestrictions());

    return parts.filter(Boolean).join("\n\n");
  },

  async fetchWithRetry(url, options, retries = 2, delayMs = 1500) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    if (retries <= 0) {
      return response;
    }

    console.warn(`HTTP 429. Reintentando en ${delayMs} ms...`);
    this.setStatus("⏳ Demasiadas peticiones. Reintentando...");

    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return this.fetchWithRetry(url, options, retries - 1, delayMs * 2);
  },

  async generarYamlHabitacion(descripcion) {
    if (this.isGenerating) {
      console.warn("LLM ocupado, ignorando nueva petición");
      this.setStatus("⏳ Espera, sigo generando la escena anterior...");
      return;
    }

    const currentRoom = this.getCurrentRoom();

    if (!currentRoom) {
      console.error("No se encontró currentRoom");
      this.setStatus("❌ No se encontró el estado actual");
      return;
    }

    const prompt = this.buildPrompt(currentRoom, descripcion);

    this.isGenerating = true;

    try {
      this.setStatus("🤖 Generando escena con LLM...");

      const response = await this.fetchWithRetry(
        this.OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.MODEL,
            messages: [{ role: "user", content: prompt }]
          })
        },
        2,
        1500
      );

      if (response.status === 429) {
        this.setStatus("❌ Demasiadas peticiones al LLM. Inténtalo en unos segundos.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content || "";
      const yamlGenerado = this.normalizarYAML(rawContent);

      if (yamlGenerado.includes("#ERROR")) {
        this.setStatus("ERROR: Instrucción no válida");
        this.scene.emit("show-error-panel", {
          message:
            "ERROR: Instruccion no valida. Di 'que puedo hacer' o 'muestra un panel de ayuda' para ver opciones."
        });
        return;
      }

      const parsed = jsyaml.load(yamlGenerado);
      const completedRoom = this.completarRoomDefaults(parsed, currentRoom);
      const yamlString = jsyaml.dump(completedRoom, { indent: 2 });

      if (this.yamlOutput) {
        this.yamlOutput.textContent = yamlString;
      }

      this.setStatus("✅ YAML generado");
      this.scene.emit(this.data.outputEvent, { room: completedRoom });
    } catch (err) {
      console.error("❌ Error LLM:", err);
      this.setStatus("❌ Error al generar YAML");
    } finally {
      this.isGenerating = false;
    }
  }
});