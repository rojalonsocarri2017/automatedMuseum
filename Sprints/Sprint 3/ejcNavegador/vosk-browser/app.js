/*************************************************
 * CONFIG
 *************************************************/
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const MODEL = "openrouter/auto";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let statusDiv;
let yamlOutput;

// Estado global de la habitación
let currentRoom = {
  room: {
    width: 200,
    depth: 300,
    height: 100,
    ceiling: true,
    walls: { north: "barrier", east: "glass", south: "wall", west: "wall" },
    textures: {
      floor: "../../assets/floor-texture.jpg",
      wall: "../../assets/jeroglifico.jpg",
      ceiling: "../../assets/jeroglifico.jpg"
    },
    entryPoint: { x: -10, y: 2, z: 20 },
    environment: { skyColor: "#000000", stars: true },
    lights: [
      { type: "ambient", color: "#ffffff", intensity: 0.85 },
      { type: "ambient", color: "#ebd9e9", intensity: 0.3 }
    ],
    objects: [] // ← inicial vacío, LLM añadirá aquí objetos
  }
};

/*************************************************
 * CATÁLOGO DE OBJETOS 3D
 *************************************************/
const OBJECT_CATALOG = {
  chair_basic: { src: "../../assets/models/furniture/chair_basic.glb", type: "floor", floorOffset: 8 },
  table_red: { src: "../../assets/models/furniture/table_red.glb", type: "floor", floorOffset: -6 },
  lamp_floor: { src: "../../assets/models/furniture/lamp_floor.glb", type: "floor", floorOffset: 7, scale: { x: 6, y: 6, z: 6 } },
  statue_liberty: { src: "../../assets/models/statues/statue_liberty.glb", type: "floor", floorOffset: 2, scale: { x: 6, y: 6, z: 6 } },
  statue_venus: { src: "../../assets/models/statues/statue_venus.glb", type: "floor", floorOffset: 17, scale: { x: 15, y: 15, z: 15 } },
  painting_modern: { src: "../../assets/models/furniture/painting_modern.glb", type: "wall", wallSide: "east", wallHeight: 1, scale: { x: 15, y: 15, z: 10 } }
};

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
    const modelUrl = "./ejcNavegador/Vosklet/model/vosk-model-small-es-0.42.tar.gz";
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

// ▶️ START
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

// ⏹️ STOP
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

  const prompt = `
Eres un sistema que convierte descripciones de habitaciones en YAML.
Estado actual:
${jsyaml.dump(currentRoom)}

IMPORTANTE:
- NÚMEROS SIEMPRE SIN COMILLAS: 0, 1.5, -10 (NO '0', NO "1.5")
- position.x, position.y, position.z SIN comillas simples ni dobles
- rotation.x, rotation.y, rotation.z SIN comillas
- scale.x, scale.y, scale.z SIN comillas
"pon una silla" → model: "chair_basic", type: "floor"
"quiero un cuadro en la pared norte" → model: "painting_modern", wallSide: "north"  
"cuadro moderno en pared este" → model: "painting_modern", wallSide: "east"

Estructura para objetos en PARED:
- type: "wall"
- model: "painting_modern"
- wallSide: "north"|"east"|"south"|"west" ← OBLIGATORIO (lo dice el usuario)
- wallHeight: 0-2 (altura en pared, 1=mitad)
- position.x: desplazamiento horizontal en pared (-50 a +50)

Si el usuario DICE "pared norte", "norte", "lado norte" → wallSide: "north"
Si dice "este", "pared este" → wallSide: "east"
Si NO menciona pared → type: "floor" (suelo)
Estructura exacta:
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
      model: chair_basic|table_red|lamp_floor  # claves del catálogo
      position:
        x: number
        y: 0  # ← SIEMPRE y=0 (suelo del lounge)
        z: number
      rotation:
        x: 0
        y: number
        z: 0
      scale:
        x: 1
        y: 1
        z: 1

Ejemplo entrada: "Pon una silla, mesa roja y lámpara en la habitación"
Salida:
room:
  width: 200
  depth: 300
  height: 100
  ceiling: true
  walls:
    north: barrier
    east: glass
    south: wall
    west: wall
  textures:
    floor: ../../assets/floor-texture.jpg
    wall: ../../assets/jeroglifico.jpg
    ceiling: ../../assets/jeroglifico.jpg
  entryPoint:
    x: -10
    y: 2
    z: 20
  environment:
    skyColor: "#000000"
    stars: true
  lights:
    - type: ambient
      color: "#ffffff"
      intensity: 0.85
    - type: ambient
      color: "#ebd9e9"
      intensity: 0.3
  objects:
    - name: "silla"
      model: "chair_basic"
      position:
        x: 0
        y: 0
        z: -50
      rotation:
        x: 0
        y: 0
        z: 0
      scale:
        x: 1
        y: 1
        z: 1
    - name: "mesa roja"
      model: "table_red"
      position:
        x: 20
        y: 0
        z: -50
      rotation:
        x: 0
        y: 45
        z: 0
      scale:
        x: 1
        y: 1
        z: 1
    - name: "lámpara"
      model: "lamp_floor"
      position:
        x: -20
        y: 0
        z: -60
      rotation:
        x: 0
        y: 0
        z: 0
      scale:
        x: 1
        y: 1
        z: 1


Entrada: "${descripcion}"
Devuelve SOLO YAML válido, indentación 2 espacios.
`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method:"POST",
      headers:{Authorization:`Bearer ${OPENROUTER_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:MODEL,messages:[{role:"user",content:prompt}]})
    });

    const data = await response.json();
    let yamlGenerado = normalizarYAML(data.choices[0].message.content);
    let newRoom = jsyaml.load(yamlGenerado);
    currentRoom = newRoom;
    yamlOutput.textContent = jsyaml.dump(currentRoom);
    renderDesdeYAML(jsyaml.dump(currentRoom));
    statusDiv.textContent = "✅ Escena actualizada";
  } catch (err) {
    console.error("❌ Error generando YAML:", err);
    statusDiv.textContent = "❌ Error LLM";
  }
}

/*************************************************
 * RENDER A-FRAME COMPLETO
 *************************************************/
function renderDesdeYAML(yamlString) {
  let data;
  try { data = jsyaml.load(yamlString); } 
  catch(e){ console.error("❌ YAML inválido en render:", e); return; }
  if(!data || !data.room){ console.error("❌ YAML sin room"); return; }
  const room = data.room;

  const root = document.getElementById("scene-root");
  if(!root){ console.error("❌ No existe #scene-root"); return; }
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
 * HABITACIÓN lounge + OBJETOS
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
 * OBJETOS DENTRO DEL LOUNGE
 *************************************************/
async function renderObjectsInsideLounge(loungeEl, room, floorY) {
  if(!room.objects||!Array.isArray(room.objects)) return;

  for (let index = 0; index < room.objects.length; index++) {
    const obj = room.objects[index];
    const entity = document.createElement("a-entity");
    entity.setAttribute("id",`object-${index}`);

    let modelUrl;

    try {
      modelUrl = await resolveModelUrl(obj);
    } catch (error) {
      console.error("❌ ERROR DE CATÁLOGO:", error.message);
      statusDiv.textContent = `❌ ${error.message}`;
      throw error;
    }

    // Asignamos GLB en A-Frame
    entity.setAttribute("gltf-model", `url(${modelUrl})`);

    // Posición, rotación y escala
    const pos = {x: obj.position?.x || 0, y: obj.position?.y || 0, z: obj.position?.z || 0};
    const rot = obj.rotation || {x:0,y:0,z:0};
    const catalogEntry = OBJECT_CATALOG[obj.model];
    const finalScale = catalogEntry?.scale || obj.scale || {x:1,y:1,z:1};

    if (catalogEntry?.type === "wall") {
      renderWallObject(entity, room, obj, pos);
    } else {
      entity.setAttribute("position", `${pos.x} ${floorY + (catalogEntry?.floorOffset||0.1)} ${pos.z}`);
    }

    entity.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
    entity.setAttribute("scale", `${finalScale.x} ${finalScale.y} ${finalScale.z}`);

    loungeEl.appendChild(entity);
  }
}

/*************************************************
 * OBJETO PARED
 *************************************************/
function renderWallObject(entity, room, obj, pos){
  const wallPositions = { north:{x:0,z:-room.depth/2}, east:{x:room.width/2,z:0}, south:{x:0,z:room.depth/2}, west:{x:-room.width/2,z:0} };
  const wallSide = obj.wallSide||"north";
  const wallHeight = (obj.wallHeight||0.6);
  const wallPos = wallPositions[wallSide];
  const finalY = wallHeight*room.height*0.1;
  entity.setAttribute("position",`${wallPos.x+(pos.x||0)} ${finalY} ${wallPos.z}`);
  entity.setAttribute("rotation",{north:"0 0 0", east:"0 90 0", south:"0 180 0", west:"0 -90 0"}[wallSide]);
}


function normalizeModelName(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "");
}



/*************************************************
 * RESOLVER URL DEL MODELO 3D (SOLO CATÁLOGO LOCAL)
 *************************************************/
async function resolveModelUrl(object) {

  if (!object.model) {
    throw new Error("Objeto sin propiedad 'model'");
  }

  const normalizedModel = object.model
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"_")
    .replace(/[^a-z0-9_]+/g,"");

  const catalogEntry = OBJECT_CATALOG[normalizedModel];

  if (!catalogEntry) {
    throw new Error(`Modelo no disponible en catálogo: ${object.model}`);
  }

  return catalogEntry.src;
}
/*************************************************
 * CÁMARA
 *************************************************/
function renderCamera(root,r){
  const cam = document.createElement("a-entity");
  cam.setAttribute("camera","");
  cam.setAttribute("look-controls","");
  cam.setAttribute("wasd-controls","");
  cam.setAttribute("position",`${r.entryPoint.x} ${-r.height/2+15} ${r.entryPoint.z}`);
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