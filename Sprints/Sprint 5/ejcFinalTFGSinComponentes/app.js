/*************************************************
 * CONFIG
 *************************************************/
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const MODEL = "openrouter/auto";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let statusDiv;
let yamlOutput;

/*************************************************
 * ESTADO GLOBAL
 *************************************************/
let currentRoom = {
  room: {
    width: 200,
    depth: 300,
    height: 100,
    ceiling: true,
    walls: { north: "barrier", east: "glass", south: "wall", west: "wall" },
    textures: {
      floor: "../assets/floor-texture.jpg",
      wall: "../assets/jeroglifico.jpg",
      ceiling: "../assets/jeroglifico.jpg"
    },
    entryPoint: { x: -10, y: 2, z: 20 },
    environment: { skyColor: "#000000", stars: true },
    lights: [
      { type: "ambient", color: "#ffffff", intensity: 0.85 },
      { type: "ambient", color: "#ebd9e9", intensity: 0.3 }
    ],
    objects: []
  }
};

/*************************************************
 * CATÁLOGO 3D
 *************************************************/
const OBJECT_CATALOG = {
  chair_basic: { src: "../assets/models/furniture/chair_basic.glb", type: "floor", floorOffset: 8 },
  table_red: { src: "../assets/models/furniture/table_red.glb", type: "floor", floorOffset: -6 },
  lamp_floor: { src: "../assets/models/furniture/lamp_floor.glb", type: "floor", floorOffset: 7, scale: { x: 6, y: 6, z: 6 } },
  statue_liberty: { src: "../assets/models/statues/statue_liberty.glb", type: "floor", floorOffset: 2, scale: { x: 6, y: 6, z: 6 } },
  statue_venus: { src: "../assets/models/statues/statue_venus.glb", type: "floor", floorOffset: 17, scale: { x: 15, y: 15, z: 15 } }
};

const ALLOWED_3D_MODELS = Object.keys(OBJECT_CATALOG);
const ALLOWED_PRIMITIVES = ["box","sphere","cylinder","cone","plane","circle","torus"];

/*************************************************
 * INICIALIZACIÓN
 *************************************************/
window.addEventListener("DOMContentLoaded", () => {
  statusDiv = document.getElementById("status");
  yamlOutput = document.getElementById("yamlOutput");
  startBtn = document.getElementById("start");
  stopBtn = document.getElementById("stop");
  console.log("✅ DOM cargado");
  startBtn.addEventListener("click", startListening);
  stopBtn.addEventListener("click", stopListening);
  loadVosk();
  renderDesdeYAML(jsyaml.dump(currentRoom));
});

/*************************************************
 * VOZ OFFLINE CON VOSK
 *************************************************/
let model;
let recognizer;
let audioCtx;
let micSource;
let processor;

async function loadVosk() {
  try {
    statusDiv.textContent = "🔄 Cargando modelo Vosk...";
    const modelUrl = "./ejcFinalTFG/model/vosk-model-small-es-0.42.tar.gz";
    model = await Vosk.createModel(modelUrl);
    statusDiv.textContent = "✅ Modelo listo";
    console.log("✅ Vosk listo");
  } catch (e) {
    console.error(e);
    statusDiv.textContent = "❌ Error cargando Vosk";
  }
}

let accumulatedText = "";
let lastResultText = "";

/*************************************************
 * START LISTENING
 *************************************************/
async function startListening() {
  if (!model) { statusDiv.textContent = "⚠️ Modelo aún cargando..."; return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    audioCtx = new AudioContext();
    micSource = audioCtx.createMediaStreamSource(stream);
    recognizer = new model.KaldiRecognizer(audioCtx.sampleRate);

    recognizer.on("partialresult", (msg) => {
      const partial = msg.result?.partial;
      if (partial) statusDiv.textContent = "🎤 " + partial;
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
    statusDiv.textContent = "🎤 Escuchando...";

  } catch (err) {
    console.error(err);
    statusDiv.textContent = "❌ Error micrófono";
  }
}

/*************************************************
 * STOP LISTENING
 *************************************************/
async function stopListening() {
  if (!processor) return;
  processor.disconnect();
  micSource.disconnect();
  await audioCtx.close();

  statusDiv.textContent = "⏹️ Parado. Procesando texto...";
  console.log("📝 Texto final acumulado:", accumulatedText);

  recognizer = null;
  processor = null;
  audioCtx = null;

  lastResultText = "";
  let finalText = accumulatedText.trim();
  accumulatedText = "";

  if (finalText) generarYamlHabitacion(finalText);
  else statusDiv.textContent = "⚠️ No se detectó voz";
}

/*************************************************
 * NORMALIZACIÓN YAML
 *************************************************/
function normalizarYAML(yaml) { return yaml.replace(/```yaml/g,"").replace(/```/g,"").replace(/\t/g,"  ").trim(); }

/*************************************************
 * GENERAR YAML CON LLM
 *************************************************/
async function generarYamlHabitacion(descripcion) {
  statusDiv.textContent = "🤖 Generando YAML...";
  console.log("📢 Enviando descripción al LLM:", descripcion);
  const lower = descripcion.toLowerCase();

  if (
    lower.includes("qué puedo hacer") ||
    lower.includes("que puedo hacer") ||
    lower.includes("muestra un panel de ayuda")
  ) {
    statusDiv.textContent = "ℹ️ Mostrando ayuda";
    const lounge = document.getElementById("lounge");
    if (lounge) {
      // renderHelpPanel(lounge, currentRoom.room, -currentRoom.room.height / 2);
      renderHelpPanel(document.querySelector("a-scene"));
    }
    return;
  }

//   const prompt = `Eres un asistente que convierte comandos de VOZ sobre habitaciones 3D en YAML para A-Frame.

// ## PASO 1: CLASIFICACIÓN OBLIGATORIA
// Si el comando NO menciona NINGUNO de estos temas, responde EXACTAMENTE:
// #ERROR: Instruccion no valida. No se puede generar YAML.

// Temas válidos: cualquier tema relacionado con dimensiones de la habitación, tipo de paredes, color del cielo, estrellas, objetos 3D disponibles, primitivas A-Frame, o propiedades de los objetos (color, posición, rotación, tamaño).
// ## SIEMPRE PERMITE CAMBIAR:
// - **width, depth, height** de la habitación
// - **walls** (north, east, south, west → barrier|wall|glass)
// - **environment.skyColor** y **stars**
// - **objects** (agregar, mover, modificar)

// ## PASO 2: ESTADO ACTUAL
// ${jsyaml.dump({
//   width: currentRoom.room.width,  
//   depth: currentRoom.room.depth,
//   height: currentRoom.room.height,
//   walls: currentRoom.room.walls,
//   skyColor: currentRoom.room.environment.skyColor,
//   stars: currentRoom.room.environment.stars,
//   objects: currentRoom.room.objects.slice(0, 20) // 20 objetos
// })}

// width: ${currentRoom.room.width}    # ← CAMBIA si usuario dice "300x400" o las dimensiones que sean

// ## PASO 3: REGLAS OBLIGATORIAS
// - NÚMEROS SIN COMILLAS: 0, 1.5, -10 (NO "0", NO '1.5')
// - Coordenadas SIEMPRE dentro de límites:
//   * x: ${Math.floor(currentRoom.room.width / 2 - 10)} a +${Math.floor(currentRoom.room.width/2 - 10)} (width=${currentRoom.room.width})
//   * z: ${Math.floor(currentRoom.room.depth / 2 - 10)} a +${Math.floor(currentRoom.room.depth/2 - 10)} (depth=${currentRoom.room.depth})  
//   * y: 0 a 5 (suelo=0)
// - Mantén TODAS las propiedades actuales que no mencione el usuario
// - Si objeto no existe, créalo en centro (x:0, z:0, y:0)
// - Si dice "encima" o "apila", suma y: +2 por nivel y ponlo en la misma posicion.

// ## PASO 3.1: COLOCACIÓN ALEATORIA DINÁMICA
// **LÍMITES REALES de esta habitación:**
// - x: -${Math.floor(currentRoom.room.width/2 - 10)} a +${Math.floor(currentRoom.room.width/2 - 10)}
// - z: -${Math.floor(currentRoom.room.depth/2 - 10)} a +${Math.floor(currentRoom.room.depth/2 - 10)}

// **SI usuario NO especifica posición:**
// - **NUNCA** todos en x:0 z:0
// - Distribuye en **4 zonas lógicas** (${Math.floor(currentRoom.room.width/2 - 10)}x${Math.floor(currentRoom.room.depth/2 - 10)}):

// ## PASO 4: OBJETOS DISPONIBLES
// **3D (model):** chair_basic, table_red, lamp_floor, statue_liberty, statue_venus
// **Primitivas (primitive):** box, sphere, cylinder, cone, plane, circle, torus

// ## PASO 5: DEVUELVE SOLO YAML VÁLIDO
// Estructura EXACTA:
// room:
//   width: ${currentRoom.room.width}
//   depth: ${currentRoom.room.depth}
//   height: ${currentRoom.room.height}
//   ceiling: ${currentRoom.room.ceiling}
//   walls:
//     north: ${currentRoom.room.walls.north}
//     east: ${currentRoom.room.walls.east}
//     south: ${currentRoom.room.walls.south}
//     west: ${currentRoom.room.walls.west}
//   textures: ${JSON.stringify(currentRoom.room.textures)}
//   entryPoint: ${JSON.stringify(currentRoom.room.entryPoint)}
//   environment:
//     skyColor: "${currentRoom.room.environment.skyColor}"
//     stars: ${currentRoom.room.environment.stars}
//   lights: ${JSON.stringify(currentRoom.room.lights)}
//     objects:
//     - name: string
//       model: chair_basic|table_red|lamp_floor|box|sphere|cylinder|cone|plane|circle|torus  # claves del catálogo o primitivas
//       position:
//         x: number  # dentro de los límites anteriores
//         y: 0       # suelo del lounge salvo casos explícitos
//         z: number  # dentro de los límites anteriores
//       rotation:
//         x: 0
//         y: number
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
// En caso de los objetos primitivos de aframe pon el scale a 3 3 3 por defecto para que se vean bien, a menos que el usuario especifique otro tamaño.

// ## PASO 6: REGLAS ACTUALIZACIÓN OBJETOS EXISTENTES
// 1. **"pon un cubo encima de otro"**: 
//    - NO crear nuevos
//    - Buscar TODOS primitive: "box"
//    - Apilar: y = índice + 2 (misma x,z)

// 2. **"cambia color esfera rosa"**:
//    - Modificar ÚNICO objeto primitive: "sphere"
//    - color: "#ff69b4"

// 3. **"silla dentro habitación"**:
//    - Buscar model: "chair_basic"
//    - Si no existe → crear en centro
//    - Si existe fuera límites → mover a x:0 z:0

// ## EJEMPLOS COMPLETOS:

// habitación 300x400x80:
// room:
//   width: 300
//   depth: 400  
//   height: 80
//   # resto igual...

// **"Pon una silla, mesa roja y lámpara":**
// objects:

//   name: "silla"
//   model: "chair_basic"
//   position: {x: -40, y: 0, z: -80}
//   rotation: {x: 0, y: 0, z: 0}
//   scale: {x: 1, y: 1, z: 1}

//   name: "mesa roja"
//   model: "table_red"
//   position: {x: 30, y: 0, z: -70}
//   rotation: {x: 0, y: 45, z: 0}
//   scale: {x: 1, y: 1, z: 1}

//   name: "lámpara"
//   model: "lamp_floor"
//   position: {x: 0, y: 0, z: -90}

// **"5 cubos rojos grandes":**
// objects:

// name: "cubo_1", primitive: "box", color: "#ff0000", scale: {x: 7, y: 7, z: 7}, position: {x: -40, y: 1, z: -80}

// name: "cubo_2", primitive: "box", color: "#ff0000", scale: {x: 7, y: 7, z: 7}, position: {x: 0, y: 1, z: -70}
// ...


// **"Mueve mesa izquierda, hazla 2x más grande":**
// Busca table_red existente, cambia:
// position: {x: -60, y: 0, z: -70}
// scale: {x: 2, y: 2, z: 2}

// Estructura exacta:
// room:
//   width: number
//   depth: number
//   height: number
//   ceiling: boolean
//   walls:
//     north: barrier|wall|glass
//     east: barrier|wall|glass
//     south: barrier|wall|glass
//     west: barrier|wall|glass
//   textures:
//     floor: string
//     wall: string
//     ceiling: string
//   entryPoint:
//     x: number
//     y: number
//     z: number
//   environment:
//     skyColor: string
//     stars: boolean
//   lights:
//     - type: ambient
//       color: string
//       intensity: number
//   objects:
//     - name: string
//       model: chair_basic|table_red|lamp_floor  # claves del catálogo
//       position:
//         x: number  # dentro de los límites anteriores
//         y: 0       # suelo del lounge salvo casos explícitos
//         z: number  # dentro de los límites anteriores
//       rotation:
//         x: 0
//         y: number
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
// Ejemplo entrada: "Quiero una habitacion de dimensiones 20 x 20 x 20"
// Salida:
// room:
//   width: 20
//   depth: 20
//   height: 20
//   ceiling: true
//   walls:
//     north: barrier
//     east: glass
//     south: wall
//     west: wall
//   textures:
//     floor: ../../assets/floor-texture.jpg
//     wall: ../../assets/jeroglifico.jpg
//     ceiling: ../../assets/jeroglifico.jpg
//   entryPoint:
//     x: -10
//     y: 2
//     z: 20
//   environment:
//     skyColor: "#000000"
//     stars: true
//   lights:
//     - type: ambient
//       color: "#ffffff"
//       intensity: 0.85
//     - type: ambient
//       color: "#ebd9e9"
//       intensity: 0.3

// Ejemplo entrada: "Pon una silla, mesa roja y lámpara en la habitación"
// Salida:
// room:
//   width: 200
//   depth: 300
//   height: 100
//   ceiling: true
//   walls:
//     north: barrier
//     east: glass
//     south: wall
//     west: wall
//   textures:
//     floor: ../../assets/floor-texture.jpg
//     wall: ../../assets/jeroglifico.jpg
//     ceiling: ../../assets/jeroglifico.jpg
//   entryPoint:
//     x: -10
//     y: 2
//     z: 20
//   environment:
//     skyColor: "#000000"
//     stars: true
//   lights:
//     - type: ambient
//       color: "#ffffff"
//       intensity: 0.85
//     - type: ambient
//       color: "#ebd9e9"
//       intensity: 0.3
//   objects:
//     - name: "silla"
//       model: "chair_basic"
//       position:
//         x: 0
//         y: 0
//         z: -50
//       rotation:
//         x: 0
//         y: 0
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//     - name: "mesa roja"
//       model: "table_red"
//       position:
//         x: 20
//         y: 0
//         z: -50
//       rotation:
//         x: 0
//         y: 45
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//     - name: "lámpara"
//       model: "lamp_floor"
//       position:
//         x: -20
//         y: 0
//         z: -60
//       rotation:
//         x: 0
//         y: 0
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//   Si el usuario quiere figuras A-Frame, crea objetos con esta estructura:

//   - name: "nombre único"
//     primitive: box|sphere|cylinder|cone|plane|circle|torus
//     color: "#rrggbb" (opcional)
//     position:
//       x: number  # dentro de los límites anteriores
//       y: 1       
//       z: number  # dentro de los límites anteriores
//     rotation:
//       x: 0
//       y: 0
//       z: 0
//     scale:
//       x: 3
//       y: 3
//       z: 3

//   Si el usuario dice cantidad, crea múltiples objetos con nombres únicos:
//   Ejemplo: "Quiero 5 cubos rojos"
//   Salida:
//   - name: "cubo_1", primitive: "box", color: "#ff0000", ...
//   - name: "cubo_2", primitive: "box", color: "#ff0000", ...
//   ...
//   REGLAS DE ACTUALIZACIÓN DE OBJETOS EXISTENTES:

// - Si el usuario dice "pon un cubo encima de otro" o "apila los cubos":
//   - No crees cubos nuevos.
//   - Busca TODOS los objetos existentes con primitive: "box".
//   - Ordénalos por nombre o por posición.x.
//   - Coloca cada cubo encima del anterior:
//     - Usa la misma x y z.
//     - Usa y = índice * ALTURA_CUBO.
//   - ALTURA_CUBO = 2.

// Ejemplo si ya existían:

// objects:
//   - name: "cubo_1"
//     primitive: "box"
//     position: { x: 0, y: 1, z: 0 }
//   - name: "cubo_2"
//     primitive: "box"
//     position: { x: 5, y: 1, z: 0 }

// Y el usuario dice: "pon un cubo encima de otro"

// Entonces debes devolver:

// objects:
//   - name: "cubo_1"
//     primitive: "box"
//     position: { x: 0, y: 1, z: 0 }
//   - name: "cubo_2"
//     primitive: "box"
//     position: { x: 0, y: 3, z: 0 }
//   - y asi aumenta el valor de y con +2 para cada cubo adicional.

// - Si el usuario dice "cambia el color de la esfera a rosa":
//   - No crees una nueva esfera.
//   - Modifica el objeto existente con primitive: "sphere".
//   - Pon color: "#ff69b4" (rosa).

// - Si el usuario dice "quiero la silla dentro de la habitación":
//   - Busca el objeto con model: "chair_basic".
//   - Si no existe, créalo cerca del centro (x: 0, z: 0).
//   - Si existe y está fuera de los límites, muévelo a una posición válida (por ejemplo x: 0, z: 0, y: 0).


// Entrada del usuario: "${descripcion}"

// **DEVUELVE SOLO YAML VÁLIDO, indentación 2 espacios.**`;

// `;
// -----------------------------------------------
  

//   const prompt = `
// Eres un sistema que convierte descripciones de habitaciones en YAML.
// Si el comando NO menciona NINGUNO de estos temas, responde EXACTAMENTE:
// #ERROR: Instruccion no valida. No se puede generar YAML.

// Temas válidos: cualquier tema relacionado con dimensiones de la habitación, tipo de paredes, color del cielo, estrellas, objetos 3D disponibles, primitivas A-Frame, o propiedades de los objetos (color, posición, rotación, tamaño).
// ## SIEMPRE PERMITE CAMBIAR:
// - **width, depth, height** de la habitación
// - **walls** (north, east, south, west → barrier|wall|glass)
// - **environment.skyColor** y **stars**
// - **objects** (agregar, mover, modificar)

// Estado actual:
// ${jsyaml.dump(currentRoom)}

// - Actualizar SOLO room.objects en función de la instrucción del usuario.
// - Si el usuario no cambia algo, lo DEJAS igual.
// - Si ya hay objetos, los reutilizas o modificas, no los elimines salvo que el usuario lo pida.
// - El campo "lights" debe estar SIEMPRE al mismo nivel que "environment"
// - Nunca anides "lights" dentro de "environment"
// - No añadas campos que no estén definidos en el esquema
// - Las coordenadas del entrypoint x, y, z no pueden ir entre comillas simples ni dobles. Importante esto
// - Respeta las tabulaciones y indentaciones de los ejemplos

// Debes generar SIEMPRE un YAML con la siguiente estructura exacta:

// room:
//   width: number
//   depth: number
//   height: number
//   ceiling: boolean

//   walls:
//     north: barrier|wall|glass
//     east: barrier|wall|glass
//     south: barrier|wall|glass
//     west: barrier|wall|glass

//   textures:
//     floor: string
//     wall: string
//     ceiling: string

//   entryPoint:
//     x: number
//     y: number
//     z: number

//   environment:
//     skyColor: string
//     stars: boolean

//   lights:
//     - type: ambient
//       color: string
//       intensity: number
//   objects:
//   - name: string
//     model: chair_basic|table_red|lamp_floor  # claves del catálogo
//     position:
//       x: number  # dentro de los límites anteriores
//       y: 0       # suelo del lounge salvo casos explícitos
//       z: number  # dentro de los límites anteriores
//     rotation:
//       x: 0
//       y: number
//       z: 0
//     scale:
//       x: 1
//       y: 1
//       z: 1

// Ejemplo:

// Entrada:
// Habitación rectangular con techo, 200x300x100, pared norte como barrera, pared este de cristal, suelo de madera, paredes decoradas, cielo oscuro con estrellas y dos luces ambientales.

// Salida:
// room:
//   width: 200
//   depth: 300
//   height: 100
//   ceiling: true

//   walls:
//     north: barrier
//     east: glass
//     south: wall
//     west: wall

//   textures:
//     floor: assets/floor-texture.jpg
//     wall: assets/jeroglifico.jpg
//     ceiling: assets/jeroglifico.jpg

//   entryPoint:
//     x: -10
//     y: 2
//     z: 20

//   environment:
//     skyColor: "#000000"
//     stars: true

//   lights:
//     - type: ambient
//       color: "#ffffff"
//       intensity: 0.85
//     - type: ambient
//       color: "#ebd9e9"
//       intensity: 0.3

// Otra entrada, si no te especifican nada de la habitacion, devuelve este yaml literal:
// room:
//   width: 200
//   depth: 300
//   height: 100
//   ceiling: true

//   walls:
//     north: barrier
//     east: glass
//     south: wall
//     west: wall

//   textures:
//     floor: assets/floor-texture.jpg
//     wall: assets/jeroglifico.jpg
//     ceiling: assets/jeroglifico.jpg

//   entryPoint:
//     x: -10
//     y: 2
//     z: 20

//   environment:
//     skyColor: "#000000"
//     stars: true

//   lights:
//     - type: ambient
//       color: "#ffffff"
//       intensity: 0.85
//     - type: ambient
//       color: "#ebd9e9"
//       intensity: 0.3

// Si alguna información no se menciona, usa valores razonables por defecto.

// COORDENADAS IMPORTANTES (para estar siempre dentro del lounge):
// - El centro de la habitación es (0, 0, 0) en X y Z.
// - El suelo del lounge está en y = 0.
// - La habitación va de -width/2 a +width/2 en X, y de -depth/2 a +depth/2 en Z.
// - TODOS los objetos deben tener:
//   -y entre 0 y 5
//   -x entre -width/2 + 10 y +width/2 - 10
//   -z entre -depth/2 + 10 y +depth/2 - 10

// Nunca uses valores de x o z fuera de esos rangos.

// IMPORTANTE:
// - NÚMEROS SIEMPRE SIN COMILLAS: 0, 1.5, -10 (NO '0', NO "1.5")
// - position.x, position.y, position.z SIN comillas simples ni dobles
// - rotation.x, rotation.y, rotation.z SIN comillas
// - scale.x, scale.y, scale.z SIN comillas
// "pon una silla" → model: "chair_basic", type: "floor"



// Ejemplo entrada: "Pon una silla, mesa roja y lámpara en la habitación"
// Salida:
// room:
//   width: 200
//   depth: 300
//   height: 100
//   ceiling: true
//   walls:
//     north: barrier
//     east: glass
//     south: wall
//     west: wall
//   textures:
//     floor: ../../assets/floor-texture.jpg
//     wall: ../../assets/jeroglifico.jpg
//     ceiling: ../../assets/jeroglifico.jpg
//   entryPoint:
//     x: -10
//     y: 2
//     z: 20
//   environment:
//     skyColor: "#000000"
//     stars: true
//   lights:
//     - type: ambient
//       color: "#ffffff"
//       intensity: 0.85
//     - type: ambient
//       color: "#ebd9e9"
//       intensity: 0.3
//   objects:
//     - name: "silla"
//       model: "chair_basic"
//       position:
//         x: 0
//         y: 0
//         z: -50
//       rotation:
//         x: 0
//         y: 0
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//     - name: "mesa roja"
//       model: "table_red"
//       position:
//         x: 20
//         y: 0
//         z: -50
//       rotation:
//         x: 0
//         y: 45
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//     - name: "lámpara"
//       model: "lamp_floor"
//       position:
//         x: -20
//         y: 0
//         z: -60
//       rotation:
//         x: 0
//         y: 0
//         z: 0
//       scale:
//         x: 1
//         y: 1
//         z: 1
//   Si el usuario quiere figuras A-Frame, crea objetos con esta estructura:

//   - name: "nombre único"
//     primitive: box|sphere|cylinder|cone|plane|circle|torus
//     color: "#rrggbb" (opcional)
//     position:
//       x: number  # dentro de los límites anteriores
//       y: 2.5      
//       z: number  # dentro de los límites anteriores
//     rotation:
//       x: 0
//       y: 0
//       z: 0
//     scale:
//       x: 3
//       y: 3
//       z: 3

//   Si el usuario dice cantidad, crea múltiples objetos con nombres únicos:
//   Ejemplo: "Quiero 5 cubos rojos"
//   Salida:
//   - name: "cubo_1", primitive: "box", color: "#ff0000", ...
//   - name: "cubo_2", primitive: "box", color: "#ff0000", ...
//   ...
//   REGLAS DE ACTUALIZACIÓN DE OBJETOS EXISTENTES:

// - Si el usuario dice "pon un cubo encima de otro" o "apila los cubos":
//   - No crees cubos nuevos.
//   - Busca TODOS los objetos existentes con primitive: "box".
//   - Ordénalos por nombre o por posición.x.
//   - Coloca cada cubo encima del anterior:
//     - Usa la misma x y z.
//     - Usa y = índice * ALTURA_CUBO.
//   - ALTURA_CUBO = 2.

// Ejemplo si ya existían:

// objects:
//   - name: "cubo_1"
//     primitive: "box"
//     position: { x: 0, y: 1, z: 0 }
//   - name: "cubo_2"
//     primitive: "box"
//     position: { x: 5, y: 1, z: 0 }

// Y el usuario dice: "pon un cubo encima de otro"

// Entonces debes devolver:

// objects:
//   - name: "cubo_1"
//     primitive: "box"
//     position: { x: 0, y: 1, z: 0 }
//   - name: "cubo_2"
//     primitive: "box"
//     position: { x: 0, y: 3, z: 0 }
//   - y asi aumenta el valor de y con +2 para cada cubo adicional.

// - Si el usuario dice "cambia el color de la esfera a rosa":
//   - No crees una nueva esfera.
//   - Modifica el objeto existente con primitive: "sphere".
//   - Pon color: "#ff69b4" (rosa).

// - Si el usuario dice "quiero la silla dentro de la habitación":
//   - Busca el objeto con model: "chair_basic".
//   - Si no existe, créalo cerca del centro (x: 0, z: 0).
//   - Si existe y está fuera de los límites, muévelo a una posición válida (por ejemplo x: 0, z: 0, y: 0).


// Entrada: "${descripcion}"
// Devuelve SOLO YAML válido, indentación 2 espacios.
// `;
// ----------------------------
  const prompt = `
Eres un sistema que convierte comandos de voz sobre una habitación 3D en YAML válido para A-Frame.

Tu tarea es **actualizar el estado actual de la habitación** en función de la instrucción del usuario.

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

Debes **modificar SOLO lo necesario** según la instrucción.

Reglas:

- Si el usuario **no menciona algo → se mantiene igual**
- **NO elimines objetos existentes**
- **Reutiliza objetos cuando sea posible**
- Solo elimina objetos si el usuario lo pide explícitamente.

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

Los objetos deben generarse **SIEMPRE dentro de estos límites**.



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

--------------------------------------------------
REGLA 5 — OBJETOS DISPONIBLES
--------------------------------------------------

Modelos 3D:

chair_basic  
table_red  
lamp_floor  
statue_liberty  
statue_venus  

Primitivas A-Frame:

box  
sphere  
cylinder  
cone  
plane  
circle  
torus

--------------------------------------------------
REGLA 6 — REGLAS DE OBJETOS
--------------------------------------------------

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

--------------------------------------------------
REGLA 7 — PRIMITIVAS A-FRAME
--------------------------------------------------

Para primitivas usa:

primitive: box | sphere | cylinder | cone | plane | circle | torus

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

Las primitivas deben tener **scale 3 3 3 por defecto** salvo que el usuario indique otro tamaño.

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

cubo_1 → y: 1  
cubo_2 → y: 3  
cubo_3 → y: 5 

Todos en la misma posicion x, posicion z.

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

--------------------------------------------------
REGLA 12 — RESTRICCIONES IMPORTANTES
--------------------------------------------------

MUY IMPORTANTE:

Números **NUNCA entre comillas**

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

El campo **lights** debe estar SIEMPRE al mismo nivel que **environment**.

Nunca anides lights dentro de environment.

--------------------------------------------------
REGLA FINAL
--------------------------------------------------

Devuelve **SOLO YAML válido**.

Sin explicaciones.  
Sin texto adicional.  
Indentación: **2 espacios**.

--------------------------------------------------

Entrada del usuario:

"${descripcion}"
`;


  try {
    const response = await fetch(OPENROUTER_URL, {
      method:"POST",
      headers:{
        Authorization:`Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        model:MODEL,
        messages:[{role:"user",content:prompt}]
      })
    });

    const data = await response.json();
    let yamlGenerado = normalizarYAML(data.choices[0].message.content);
    if (yamlGenerado.includes("#ERROR")) {
      statusDiv.textContent = "ERROR: Instruccion no valida"
      renderErrorPanel(lounge, "ERROR: Intruccion no valida. Di 'que puedo hacer' o 'muestra un panel de ayuda' para ver opciones.");
      return;
    }
    let newRoom = jsyaml.load(yamlGenerado);
    console.log("WIDTH:", newRoom.room.width);
    console.log("DEPTH:", newRoom.room.depth);
    console.log("HEIGHT:", newRoom.room.height);
    currentRoom = newRoom;
    currentRoom.room.objects = newRoom.room.objects || [];
    yamlOutput.textContent = jsyaml.dump(currentRoom);
    renderDesdeYAML(jsyaml.dump(currentRoom));
    statusDiv.textContent = "✅ Escena actualizada";
  } catch (err) {
    console.error("❌ Error generando YAML:", err);
    statusDiv.textContent = "❌ Error LLM";
  }
}

function renderErrorPanel(loungeEl, message) {
  const loungeWidth  = currentRoom.room.width  || 200;
  const loungeHeight = currentRoom.room.height || 100;
  const loungeDepth  = currentRoom.room.depth  || 300;
  const fy = -currentRoom.room.height / 2 || 0;

  const panelWidth  = loungeWidth * 0.6;
  const panelHeight = loungeHeight * 0.6;

  const panel = document.createElement("a-plane");
  panel.setAttribute("width", panelWidth);
  panel.setAttribute("height", panelHeight);
  panel.setAttribute("color", "#ff4444");
  panel.setAttribute("opacity", "0.85");
  panel.setAttribute("material", "shader: flat; side: double; transparent: true");
  const panelZ = -(loungeDepth / 2) + 50;
  const panelY = fy + loungeHeight / 2;
  panel.setAttribute("position", `0 ${panelY} ${panelZ}`);
  panel.setAttribute("rotation", "0 0 0");
  loungeEl.appendChild(panel);
  
  const text = document.createElement("a-text");
  text.setAttribute("value", message);
  text.setAttribute("color", "#ffffff");
  text.setAttribute("align", "left");
  text.setAttribute("anchor", "center");
  text.setAttribute("wrap-count", 30);
  // z-offset para evitar z-fighting con el panel
  text.setAttribute("z-offset", "0.01");
  const textZ = panelZ + 1; // delante del plano
  text.setAttribute("position", `0 ${panelY} ${textZ}`);

  const textScale = panelHeight / 5;
  text.setAttribute("scale", `${textScale} ${textScale} ${textScale}`);
  
  loungeEl.appendChild(text);
  
  setTimeout(() => {
    panel.remove();
    text.remove();
  }, 5000);
}

/*************************************************
 * RENDER
 *************************************************/
function renderDesdeYAML(yamlString) {
  let data;
  try { data = jsyaml.load(yamlString); } 
  catch(e){ console.error("❌ YAML inválido en render:", e); return; }
  if(!data || !data.room){ console.error("❌ YAML sin room"); return; }
  const room = data.room;

  const root = document.getElementById("scene-root");
  root.innerHTML = "";

  renderEntorno(root, room);
  renderLuces(root, room);
  renderCajaRoom(root, room);
  renderCamera(root, room);
}

/*************************************************
 * LUCES
 *************************************************/
function renderLuces(root, room) {
  (room.lights||[]).forEach(light=>{
    const e = document.createElement("a-entity");
    e.setAttribute("light", `type:${light.type}; color:${light.color}; intensity:${light.intensity}`);
    root.appendChild(e);
  });
}

/*************************************************
 * LOUNGE
 *************************************************/
function renderCajaRoom(root, r){
  const lounge = document.createElement("a-entity");
  lounge.setAttribute("id","lounge");
  lounge.setAttribute("lounge",`
    width:${r.width};
    depth:${r.depth};
    height:${r.height};
    ceiling:${r.ceiling};
    north:${r.walls.north};
    east:${r.walls.east};
    south:${r.walls.south};
    west:${r.walls.west};
    floorTexture:${r.textures.floor};
    wallTexture:${r.textures.wall};
    ceilingTexture:${r.textures.ceiling};
  `);
  lounge.addEventListener("loaded",()=>{ renderObjectsInsideLounge(lounge,r,-r.height/2); });
  root.appendChild(lounge);
}

/*************************************************
 * OBJETOS (GLB + PRIMITIVAS)
 *************************************************/
async function renderObjectsInsideLounge(loungeEl, room, floorY) {
  if(!room.objects || !Array.isArray(room.objects)) return;

  for (let index = 0; index < room.objects.length; index++) {
    const obj = room.objects[index];
    
    // PRIMITIVAS
    if (obj.primitive && ALLOWED_PRIMITIVES.includes(obj.primitive)) {
      const el = document.createElement(`a-${obj.primitive}`);
      const pos = obj.position || {x:0, y:0, z:0};
      const rot = obj.rotation || {x:0, y:0, z:0};
      const scale = obj.scale || {x:3, y:3, z:3};

      el.setAttribute("position", `${pos.x} ${floorY + pos.y} ${pos.z}`);
      el.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
      el.setAttribute("scale", `${scale.x} ${scale.y} ${scale.z}`);
      if (obj.color) el.setAttribute("color", obj.color);

      loungeEl.appendChild(el);
      continue;
    }

    // MODELOS GLB
    if (obj.model && OBJECT_CATALOG[obj.model]) {
      const entity = document.createElement("a-entity");
      entity.setAttribute("id", `object-${index}`);
      
      const catalogEntry = OBJECT_CATALOG[obj.model];
      entity.setAttribute("gltf-model", `url(${catalogEntry.src})`);
      
      const pos = obj.position || {x:0, y:0, z:0};
      const rot = obj.rotation || {x:0, y:0, z:0};
      const finalScale = catalogEntry.scale || obj.scale || {x:1, y:1, z:1};
      
      // USA floorOffset del catálogo
      const floorOffset = catalogEntry.floorOffset || 0;
      entity.setAttribute("position", `${pos.x} ${floorY + floorOffset} ${pos.z}`);
      
      entity.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
      entity.setAttribute("scale", `${finalScale.x} ${finalScale.y} ${finalScale.z}`);
      
      loungeEl.appendChild(entity);
    }
  }
}

/*************************************************
 * CÁMARA
 *************************************************/
function renderCamera(root,r){
  const cam = document.createElement("a-entity");
  cam.setAttribute("camera","");
  cam.setAttribute("look-controls","");
  cam.setAttribute("wasd-controls","");
  cam.setAttribute("position",`${r.entryPoint.x} ${-r.height/2+5} ${r.entryPoint.z}`);
  root.appendChild(cam);
}

/*************************************************
 * ENTORNO
 *************************************************/
function renderEntorno(root,room){
  const env = room.environment||{};
  if(env.skyColor){ const sky=document.createElement("a-sky"); sky.setAttribute("color",env.skyColor); root.appendChild(sky); }
  if(env.stars){ const stars=document.createElement("a-entity"); stars.setAttribute("star-sky",""); root.appendChild(stars); }
}

/*************************************************
 * PANEL 3D DE AYUDA
 *************************************************/
function renderHelpPanel(loungeEl, roomConfig, floorY) {
  const textValue = getHelpText();

  const loungeWidth  = currentRoom.room.width  || 200;
  const loungeHeight = currentRoom.room.height || 100;
  const loungeDepth  = currentRoom.room.depth  || 300;
  const fy = floorY || 0;

  const panelWidth  = loungeWidth * 0.6;
  const panelHeight = loungeHeight * 0.6;

  // PANEL de fondo
  const panel = document.createElement("a-plane");
  panel.setAttribute("width", panelWidth);
  panel.setAttribute("height", panelHeight);
  panel.setAttribute("color", "#111");
  panel.setAttribute("opacity", "0.85");
  panel.setAttribute("material", "shader: flat; side: double; transparent: true");
  const panelZ = -(loungeDepth / 2) + 70;
  const panelY = fy + loungeHeight / 6;
  panel.setAttribute("position", `0 ${panelY} ${panelZ}`);
  panel.setAttribute("rotation", "0 0 0");
  loungeEl.appendChild(panel);

  // TEXTO
  const textEl = document.createElement("a-text");
  textEl.setAttribute("value", textValue.trim());
  textEl.setAttribute("color", "#FFFFFF");
  textEl.setAttribute("align", "left");
  textEl.setAttribute("anchor", "center");
  textEl.setAttribute("wrap-count", 60);
  // z-offset para evitar z-fighting con el panel
  textEl.setAttribute("z-offset", "0.01");

  const textZ = panelZ + 1; // delante del plano
  textEl.setAttribute("position", `0 ${panelY} ${textZ}`);

  const textScale = panelHeight / 4;
  textEl.setAttribute("scale", `${textScale} ${textScale} ${textScale}`);

  loungeEl.appendChild(textEl);
  setTimeout(() => {
    panel.remove();
    textEl.remove();
  }, 10000);
}


function getHelpText() {
  return `
Puedes hacer lo siguiente:
  HABITACION:
- Cambiar las dimensiones de la habitacion
- Cambiar un tipo de pared que elijas en la habitacion
- Cambiar el color del cielo
- Activar o desactivar las estrellas

Modelos 3D disponibles:
${Object.keys(OBJECT_CATALOG).join(", ")}

Objetos A-Frame:
box, sphere, cylinder, cone, plane, circle, torus.

Para los objetos 3D y objetos A-Frame puedes definir:
- color
- posicion (x, y, z)
- rotacion (x, y, z)
- scale (x, y, z)
`.trim();
}

//cada una de estas cosas puede ser una componente, en la descripcion incluyo como hacerlo para pasarselo al prompt segun lo que necesite cada componente. Le paso el componente y la descripcion del componente.
//todo se convierte en skills, un skill que cambie las dimensiones de la habitacion, otro skill que cambie el techo de la habitacion
