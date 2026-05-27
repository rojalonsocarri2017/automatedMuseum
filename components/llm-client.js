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
    this.OPENROUTER_API_KEY = localStorage.getItem("openrouter_api_key") || this.data.openrouterApikey;
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
    let clean = String(yaml || "")
      .replace(/```yaml/g, "")
      .replace(/```/g, "")
      .replace(/\t/g, "  ")
      .trim();

    const startIndex = clean.indexOf("room:");
    if (startIndex !== -1) {
      clean = clean.slice(startIndex);
    }

    const stopTokens = [
      "</assistant>",
      "<assistant>",
      "</user>",
      "<user>",
      "</system>",
      "<system>",
      "</tool_call>",
      "<tool_call>",
      "</arg_value>",
      "<arg_value>"
    ];

    for (const token of stopTokens) {
      const index = clean.indexOf(token);
      if (index !== -1) {
        clean = clean.slice(0, index);
      }
    }

    return clean.trim();
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

Si la instrucción NO tiene relación con escenas 3D, YAML o A-Frame, responde EXACTAMENTE:


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
  REGLA 4 — GENERACIÓN VISUAL Y ESPACIAL
  --------------------------------------------------

  La habitación usa estos ejes:
  - x = izquierda / derecha
  - z = delante / detrás
  - y = altura

  El centro de la habitación es:
  x = 0
  z = 0

  Límites válidos:

  x: -width/2 a +width/2
  z: -depth/2 a +depth/2

  Para evitar paredes:

  x: entre -width/2 + 10 y +width/2 - 10
  z: entre -depth/2 + 10 y +depth/2 - 10

  Usa estos límites dinámicamente:

  x_min = -${currentRoom.room.width}/2 + 10
  x_max = +${currentRoom.room.width}/2 - 10

  z_min = -${currentRoom.room.depth}/2 + 10
  z_max = +${currentRoom.room.depth}/2 - 10

  --------------------------------------------------
  REGLAS DE DISTRIBUCIÓN
  --------------------------------------------------

  - NUNCA coloques objetos fuera de la habitación.
  - NUNCA coloques todos los objetos en x:0 z:0.
  - Distribuye los elementos por distintas zonas.
  - Evita escenas excesivamente simétricas.
  - No superpongas objetos grandes en la misma posición.
  - Si un objeto existente queda fuera tras cambiar el tamaño de la habitación, recolócalo automáticamente dentro.
  - Si el objeto tiene que estar en el suelo, su posicion debe empezar en el suelo para ser mas visual

  --------------------------------------------------
  REGLAS DE COMPOSICIÓN VISUAL
  --------------------------------------------------

  El usuario puede pedir cualquier escena, ambiente u objeto.

  Si no existe un modelo exacto en el catálogo:
  - representa la escena usando primitivas A-Frame.
  - construye objetos complejos usando varias primitivas.
  - genera escenas visualmente reconocibles.
  - usa distintas alturas, tamaños y rotaciones.
  - usa nombres descriptivos y únicos.
  - Los detalles decorativos pequeños deben sobresalir ligeramente
    hacia fuera para ser visibles y no quedar ocultos dentro de otra geometría.

  Piensa primero:
  1. Qué zonas tendrá la escena.
  2. Qué elementos principales contiene.
  3. Cómo distribuirlos.
  4. Qué primitivas representan cada parte.

  --------------------------------------------------
  REGLAS DE ORIENTACIÓN Y TAMAÑO
  --------------------------------------------------

  - Usa el eje y únicamente para altura real.
  - Usa x y z para distribución horizontal.
  - Los objetos anchos deben crecer principalmente en x.
  - Los objetos largos deben crecer principalmente en z.
  - Los objetos altos deben crecer principalmente en y.

  La escala debe ser coherente con el elemento representado:
  - un río debe ser ancho y visible
  - una playa debe ocupar una zona amplia
  - un bosque debe contener múltiples árboles repartidos
  - una carretera debe tener anchura suficiente
  - un edificio debe ser claramente más grande que una persona
  - Para superficies grandes como campos, suelos, pistas, carreteras, alfombras o paredes decorativas, NO uses scale 3 3 3. Adapta las dimensiones de los planos segun sea necesario.

  Los elementos principales deben ser claramente visibles, pero manteniendo proporciones coherentes con el resto de la escena.

  --------------------------------------------------
  REGLAS PARA PLANES
  --------------------------------------------------

  Un plane representa una superficie 2D.

  En planes:
  - scale.x controla el ancho
  - scale.y controla el largo/alto visible
  - scale.z debe ser 1

  Para superficies horizontales:
  - usa rotation.x = -90

  Para superficies grandes:
  - NO uses scale 3 3 3
  - usa dimensiones amplias y proporcionales
  - evita superficies finas o difíciles de percibir visualmente

  Ejemplo:

  primitive: plane
  position:
    x: 0
    y: 0.05
    z: 0
  rotation:
    x: -90
    y: 0
    z: 0
  scale:
    x: 160
    y: 80
    z: 1

  --------------------------------------------------
  REGLA — TEXTURAS DISPONIBLES
  --------------------------------------------------

  Texturas disponibles:

  - ladrillo -> ../assets/brick.jpg
  - piedra -> ../assets/stone.jpg
  - jeroglifico -> ../assets/jeroglifico.jpg

  Si el usuario cambia el estilo visual de la habitación:
  - puedes modificar automáticamente wall, floor o ceiling
  - usa texturas coherentes con la escena

  --------------------------------------------------
  REGLA — DETALLES VISIBLES EN OBJETOS COMPUESTOS
  --------------------------------------------------

  Los detalles pequeños visibles como ojos, nariz, boca, botones,
  ventanas, puertas, ruedas o decoración deben ir SIEMPRE por fuera
  de la pieza principal.

  Para detalles frontales sobre una pieza principal:

  detalle.position.z =
  pieza_principal.position.z + pieza_principal.scale.z + 0.5

  Nunca pongas detalles frontales con el mismo z que la pieza principal.

  Ejemplo:
  Si una cabeza tiene:
  position:
    x: 0
    y: 40
    z: 100
  scale:
    x: 5
    y: 5
    z: 5

  Entonces ojos, nariz y boca deben ir aproximadamente en:
  z: 105.5

  Los ojos deben mantener una y cercana a la cabeza:
  y: 40 o 41

  Nunca coloques ojos, nariz o boca dentro del cuerpo ni dentro de la cabeza.
  Si dudas entre colocar un detalle dentro o fuera, colócalo más hacia fuera para que sea visible.
  `.trim();
  },

  getPromptObjectsCatalog() {
    const models = Object.keys(OBJECT_CATALOG || {});
    if (!models.length) return "";

    return `
  --------------------------------------------------
  REGLA 5 — MODELOS 3D DISPONIBLES
  --------------------------------------------------

  Modelos disponibles:

  ${models.join("\n")}

  Usa modelos del catálogo solo si encajan claramente con lo pedido.
  Si no encajan, usa primitivas A-Frame.

  Ejemplos:
  - silla -> chair_basic
  - mesa -> table_red
  - lámpara -> lamp_floor
  - coche -> car_1
  - moto -> motorbike
  Manten la escala de los objetos que estan defnidos en el catálogo, ya que están ajustados para ser visualmente coherentes en la escena. Si el usuario pide un objeto específico del catálogo, úsalo con su escala definida para asegurar que se vea correctamente en la habitación.
  `.trim();
  },

  getPromptPrimitives() {
    if (!Array.isArray(ALLOWED_PRIMITIVES) || !ALLOWED_PRIMITIVES.length) {
      return "";
    }

    return `
  --------------------------------------------------
  REGLA 6 — PRIMITIVAS A-FRAME
  --------------------------------------------------

  Primitivas disponibles:

  ${ALLOWED_PRIMITIVES.join("\n")}

  Para primitivas usa:

  primitive: ${ALLOWED_PRIMITIVES.join(" | ")}

  Ejemplo:

  - name: string
    primitive: box
    color: "#rrggbb"
    position:
      x: number
      y: number
      z: number
    rotation:
      x: number
      y: number
      z: number
    scale:
      x: number
      y: number
      z: number
  `.trim();
  },

  getPromptMultipleObjects() {
    return `
  --------------------------------------------------
  REGLA 7 — MÚLTIPLES OBJETOS
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
  REGLA 8 — APILAR OBJETOS
  --------------------------------------------------

  Si el usuario dice:
  - "pon un cubo encima de otro"
  - "apila los cubos"

  No crees nuevos.

  Busca todos:
  primitive: box

  Ordena por nombre.

  Coloca cada cubo encima del anterior.

  Ejemplo:
  cubo_1 -> y: 1
  cubo_2 -> y: 3
  cubo_3 -> y: 5
  `.trim();
  },

  getPromptModifyObjects() {
    return `
  --------------------------------------------------
  REGLA 9 — MODIFICAR OBJETOS
  --------------------------------------------------

  Ejemplos:

  "Cambia el color de la esfera a rosa"
   modifica color

  "Haz la mesa el doble de grande"
   modifica scale

  "Mueve la silla a la izquierda"
   modifica position.x
  `.trim();
  },

  getPromptRelativeRules() {
    return `
  --------------------------------------------------
  REGLA 10 — RELACIONES ESPACIALES
  --------------------------------------------------

  Relaciones soportadas:
  - derecha de
  - izquierda de
  - delante de
  - detrás de
  - encima de

  Busca el objeto por:
  - name
  - primitive
  - model

  Separaciones por defecto:

  SEPARACION_HORIZONTAL = 8
  SEPARACION_VERTICAL = 4

  Ejemplos:
  - derecha => x + 8
  - izquierda => x - 8
  - delante => z - 8
  - detrás => z + 8
  - encima => y + 4

  Si el usuario no indica distancia:
  usa desplazamiento 8.
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
        model: chair_basic|table_red|lamp_floor|statue_liberty|statue_venus|car_1|car_2|car_3|motorbike
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
      - name: string
        primitive: box|sphere|cylinder|cone|plane|circle|torus
            color: "#rrggbb"
            position:
              x: number
              y: number
              z: number
            rotation:
              x: number
              y: number
              z: number
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