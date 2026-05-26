/*************************************************
 * CONFIG
 *************************************************/
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const MODEL = "openrouter/auto";
// const MODEL = "arcee-ai/trinity-mini:free";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const GROQ_WHISPER_API = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_API_KEY = "<GROQ_API_KEY_AQUI>";

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
    ]
  }
};

/*************************************************
 * INICIALIZACIÓN
 *************************************************/
window.addEventListener("DOMContentLoaded", () => {
  statusDiv = document.getElementById("status");
  yamlOutput = document.getElementById("yamlOutput");
  console.log("✅ DOM cargado");
  initPushToTalk();
  renderDesdeYAML(jsyaml.dump(currentRoom));
});

/*************************************************
 * PUSH-TO-TALK CON GROQ WHISPER
 *************************************************/
function initPushToTalk() {
  const startBtn = document.getElementById("start");
  const stopBtn = document.getElementById("stop");

  let mediaRecorder;
  let audioChunks = [];

  startBtn.onclick = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      statusDiv.textContent = "❌ Microfono no soportado";
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstart = () => {
      statusDiv.textContent = "🎤 Grabando... suelta el botón para enviar";
    };

    mediaRecorder.start();
  };

  stopBtn.onclick = async () => {
    if (!mediaRecorder) return;

    mediaRecorder.stop();

    mediaRecorder.onstop = async () => {
      statusDiv.textContent = "⏳ Procesando audio...";
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const transcription = await enviarAGroq(audioBlob);
      if (transcription) {
        console.log("📝 Texto transcrito:", transcription);
        generarYamlHabitacion(transcription);
      }
    };
  };
}

/*************************************************
 * ENVÍO DEL AUDIO A GROQ
 *************************************************/
async function enviarAGroq(audioBlob) {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "voz.webm");
    formData.append("model", "whisper-large-v3"); // modelo Whisper de Groq

    const response = await fetch(GROQ_WHISPER_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Error Groq Whisper:", errText);
      statusDiv.textContent = "❌ Error transcripción";
      return null;
    }

    const data = await response.json();
    return data.text; // Groq devuelve { text: "..." }

  } catch (err) {
    console.error("❌ Fallo en envío a Groq:", err);
    statusDiv.textContent = "❌ Error Groq";
    return null;
  }
}

/*************************************************
 * NORMALIZACIÓN YAML
 *************************************************/
function normalizarYAML(yaml) {
  const n = yaml.replace(/```yaml/g, "").replace(/```/g, "").replace(/\t/g, "  ").trim();
  console.log("🧹 YAML tras quitar markdown/tabs:\n", n);
  return n;
}

/*************************************************
 * GENERAR YAML CON LLM (INCREMENTAL)
 *************************************************/
async function generarYamlHabitacion(descripcion) {
  statusDiv.textContent = "🤖 Generando YAML...";
  console.log("📢 Enviando descripción al LLM:", descripcion);

  const prompt = `
Eres un sistema que convierte descripciones de habitaciones en YAML.
Tienes el estado actual de la habitación:
${jsyaml.dump(currentRoom)}

Si la entrada NO describe una habitación o un espacio físico,
devuelve exactamente este YAML y nada más:
error:
  message: "La descripción no corresponde a una habitación"

IMPORTANTE:
- El campo "lights" debe estar SIEMPRE al mismo nivel que "environment"
- Nunca anides "lights" dentro de "environment"
- No añadas campos que no estén definidos en el esquema
- Las coordenadas del entrypoint x, y, z no pueden ir entre comillas simples ni dobles. Importante esto
- Respeta las tabulaciones y indentaciones de los ejemplos

Debes generar SIEMPRE un YAML con la siguiente estructura exacta:

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

Ejemplo:

Entrada:
Habitación rectangular con techo, 200x300x100, pared norte como barrera, pared este de cristal, suelo de madera, paredes decoradas, cielo oscuro con estrellas y dos luces ambientales.

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

Otra entrada, si no te especifican nada de la habitacion, devuelve este yaml literal:
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

Si alguna información no se menciona, usa valores razonables por defecto.
Ahora convierte la siguiente descripción.
Devuelve SOLO el YAML, sin explicaciones.

Entrada: "${descripcion}"

Modifica la habitación para agregar o cambiar elementos según la descripción,
pero NO BORRES lo que ya existía a menos que se indique explícitamente.
Devuelve SOLO YAML válido con la misma estructura que antes, indentación 2 espacios, nada de explicaciones.
`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] })
    });

    const data = await response.json();
    let yamlGenerado = data.choices[0].message.content;
    console.log("📄 YAML crudo recibido del LLM:\n", yamlGenerado);

    yamlGenerado = normalizarYAML(yamlGenerado);

    let newRoom;
    try {
      newRoom = jsyaml.load(yamlGenerado);
    } catch (err) {
      console.error("❌ YAML inválido tras normalizar:", yamlGenerado);
      statusDiv.textContent = "❌ YAML inválido generado";
      return;
    }

    currentRoom = newRoom; // actualizar estado global
    yamlOutput.textContent = jsyaml.dump(currentRoom);
    console.log("✅ Estado global actualizado:", currentRoom);

    renderDesdeYAML(jsyaml.dump(currentRoom));
    statusDiv.textContent = "✅ Escena actualizada";

  } catch (err) {
    console.error("❌ Error generando YAML:", err);
    statusDiv.textContent = "❌ Error LLM";
  }
}

/*************************************************
 * RENDER A-FRAME CON aframe-lounge
 *************************************************/
function renderDesdeYAML(yamlString) {
  let data;
  try {
    data = jsyaml.load(yamlString);
  } catch (e) {
    console.error("❌ YAML inválido en render:", e);
    return;
  }

  if (!data || !data.room) {
    console.error("❌ YAML sin room");
    return;
  }

  const room = data.room;
  console.log("🎬 Renderizando room:", room);

  const root = document.getElementById("scene-root");
  if (!root) {
    console.error("❌ No existe #scene-root");
    return;
  }

  root.innerHTML = "";

  // Render en orden correcto
  renderEntorno(root, room);  // cielo primero
  renderLuces(root, room);    // luces
  renderCajaRoom(root, room); // lounge
  renderCamera(root, room);   // cámara
}

/*************************************************
 * LUCES
 *************************************************/
function renderLuces(root, room) {
  (room.lights || []).forEach(light => {
    console.log("💡 Renderizando luz:", light);
    const e = document.createElement("a-entity");
    e.setAttribute("light", `type: ${light.type}; color: ${light.color}; intensity: ${light.intensity}`);
    root.appendChild(e);
  });
}

/*************************************************
 * HABITACIÓN lounge
 *************************************************/
function renderCajaRoom(root, r) {
  console.log("🏠 Renderizando lounge con dimensiones:", r.width, r.depth, r.height);
  const lounge = document.createElement("a-entity");
  lounge.setAttribute("id", "lounge");
  lounge.setAttribute("lounge", `
    width: ${r.width};
    depth: ${r.depth};
    height: ${r.height};
    ceiling: ${r.ceiling};
    north: ${r.walls.north};
    east: ${r.walls.east};
    south: ${r.walls.south};
    west: ${r.walls.west};
    floorTexture: ${r.textures.floor};
    wallTexture: ${r.textures.wall};
    ceilingTexture: ${r.textures.ceiling};
  `);
  root.appendChild(lounge);
}

/*************************************************
 * CÁMARA
 *************************************************/
function renderCamera(root, r) {
  console.log("📷 Posicionando cámara en:", r.entryPoint);
  const cam = document.createElement("a-entity");
  cam.setAttribute("camera", "");
  cam.setAttribute("look-controls", "");
  cam.setAttribute("wasd-controls", "");
  cam.setAttribute("position", `${r.entryPoint.x} ${r.entryPoint.y} ${r.entryPoint.z}`);
  root.appendChild(cam);
}

/*************************************************
 * ENTORNO
 *************************************************/
function renderEntorno(root, room) {
  console.log("🌌 Renderizando entorno...");

  const env = room.environment || {};
  
  // Cielo
  if (env.skyColor) {
    const sky = document.createElement("a-sky");
    sky.setAttribute("color", env.skyColor);
    root.appendChild(sky);
    console.log("✅ Sky creado con color:", env.skyColor);
  }

  // Estrellas
  if (env.stars) {
    const stars = document.createElement("a-entity");
    stars.setAttribute("star-sky", ""); // tu componente personalizado
    root.appendChild(stars);
    console.log("✨ Star-sky agregado");
  }
}