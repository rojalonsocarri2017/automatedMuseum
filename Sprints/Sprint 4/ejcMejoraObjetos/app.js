/*************************************************
 * CONFIG
 *************************************************/
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const MODEL = "openrouter/auto";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const GROQ_WHISPER_API = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_API_KEY = "<GROQ_API_KEY_AQUI>";

let statusDiv;
let yamlOutput;

/*************************************************
 * CATÁLOGO DE OBJETOS 3D (SIN yOffset)
 *************************************************/
const OBJECT_CATALOG = {
  chair_basic: {
    src: "../assets/models/furniture/chair_basic.glb",
    type: "floor",
    floorOffset: 8
  },
  table_red: {
    src: "../assets/models/furniture/table_red.glb",
    type: "floor",
    floorOffset: -6
  },
  lamp_floor: {
    src: "../assets/models/furniture/lamp_floor.glb",
    type: "floor",
    floorOffset: 7,
    scale: { x: 6, y: 6, z: 6 }
  },
  statue_liberty: {
    src: "../assets/models/statues/statue_liberty.glb",
    type: "floor",
    floorOffset: 2,
    scale: { x: 6, y: 6, z: 6 }
  },

  statue_venus: {
    src: "../assets/models/statues/statue_venus.glb",
    type: "floor",
    floorOffset: 17,
    scale: { x: 15, y: 15, z: 15 }
  },
  painting_modern: {
    src: "../assets/models/furniture/painting_modern.glb",
    type: "wall",
    wallSide: "east",
    wallHeight: 1,
    scale: { x: 15, y: 15, z: 10 }
  }
};

/*************************************************
 * ESTADO GLOBAL DE LA HABITACIÓN
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
 * SANITIZAR NÚMEROS DEL YAML
 *************************************************/
function sanitizeYamlNumbers(data) {
  if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (typeof data[key] === 'string' && !isNaN(data[key]) && data[key].trim() !== '') {
        data[key] = parseFloat(data[key]);
      } else if (Array.isArray(data[key])) {
        data[key] = data[key].map(sanitizeYamlNumbers);
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        data[key] = sanitizeYamlNumbers(data[key]);
      }
    }
  }
  return data;
}

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
      statusDiv.textContent = "❌ Micrófono no soportado";
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
    formData.append("model", "whisper-large-v3");

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
    return data.text;
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
  const n = yaml
    .replace(/```yaml/g, "")
    .replace(/```/g, "")
    .replace(/\t/g, "  ")
    .trim();
  console.log("🧹 YAML tras quitar markdown/tabs:\n", n);
  return n;
}

/*************************************************
 * RESOLVER URL DEL MODELO 3D
 *************************************************/
function resolveModelUrl(object) {
  if (object.model && /^https?:\/\//.test(object.model)) {
    return object.model;
  }

  if (object.model && OBJECT_CATALOG[object.model]) {
    return OBJECT_CATALOG[object.model].src;
  }

  const baseName = object.name || object.model || "object";
  const normalizedName = baseName
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `../assets/dynamic/${normalizedName}.glb`;
}

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
    floor: ../assets/floor-texture.jpg
    wall: ../assets/jeroglifico.jpg
    ceiling: ../assets/jeroglifico.jpg
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
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }] })
    });

    const data = await response.json();
    let yamlGenerado = data.choices[0].message.content;
    yamlGenerado = normalizarYAML(yamlGenerado);

    let newRoom;
    try {
      newRoom = jsyaml.load(yamlGenerado);
      newRoom = sanitizeYamlNumbers(newRoom);
    } catch (err) {
      console.error("❌ YAML inválido:", yamlGenerado);
      statusDiv.textContent = "❌ YAML inválido";
      return;
    }

    currentRoom = newRoom;
    yamlOutput.textContent = jsyaml.dump(currentRoom);
    renderDesdeYAML(jsyaml.dump(currentRoom));
    statusDiv.textContent = "✅ Escena actualizada";

  } catch (err) {
    console.error("❌ Error LLM:", err);
    statusDiv.textContent = "❌ Error LLM";
  }
}

/*************************************************
 * RENDER A-FRAME COMPLETO
 *************************************************/
function renderDesdeYAML(yamlString) {
  let data;
  try {
    data = jsyaml.load(yamlString);
    data = sanitizeYamlNumbers(data);
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
  renderEntorno(root, room);
  renderLuces(root, room);
  renderCajaRoom(root, room);  // Objetos se meten DENTRO del lounge
  renderCamera(root, room);
}

/*************************************************
 * LUCES
 *************************************************/
function renderLuces(root, room) {
  (room.lights || []).forEach(light => {
    const e = document.createElement("a-entity");
    e.setAttribute("light", `type: ${light.type}; color: ${light.color}; intensity: ${light.intensity}`);
    root.appendChild(e);
  });
}

/*************************************************
 * HABITACIÓN LOUNGE + OBJETOS DENTRO
 *************************************************/
function renderCajaRoom(root, r) {
  console.log("🏠 Lounge height:", r.height, "→ suelo en Y=", -r.height/2);
  
  const lounge = document.createElement("a-entity");
  lounge.setAttribute("id", "lounge");
  lounge.setAttribute("position", "0 0 0"); // lounge centrado
  
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
  
  // ⭐ VERSIÓN SIMPLIFICADA - sin wallPositions
  lounge.addEventListener("loaded", () => {
    const floorY = -r.height / 2;
    console.log("✅ Suelo lounge en Y=", floorY);
    renderObjectsInsideLounge(lounge, r, floorY);  // Solo pasa room, NO wallPositions
  });
  
  root.appendChild(lounge);
}


/*************************************************
* renderWallObject usando paredes REALES
*************************************************/
function renderWallObject(entity, room, obj, pos) {  // ← room otra vez
  const name = obj.name || "cuadro";
  const wallSide = obj.wallSide || "north";
  const wallHeight = (obj.wallHeight || 0.6);
  
  // COORDENADAS LOCALES del lounge (funciona porque es HIJO)
  const localWallPositions = {
    north: { x: 0, z: -room.depth/2 },
    east:  { x: room.width/2, z: 0 },
    south: { x: 0, z: room.depth/2 },
    west:  { x: -room.width/2, z: 0 }
  };
  
  const wallPos = localWallPositions[wallSide];
  const finalY = wallHeight * room.height * 0.1; 
  // const finalY = 20;
  
  const finalPosition = `${wallPos.x + ((pos.x+1) || 0)} ${finalY} ${wallPos.z}`;
  
  entity.setAttribute("position", finalPosition);
  entity.setAttribute("rotation", {
    north: "0 0 0", east: "0 90 0", south: "0 180 0", west: "0 -90 0"
  }[wallSide]);
  

  console.log(`🖼️ ${name} LOCAL [${wallSide}] → ${finalPosition}`);
}



/*************************************************
 * OBJETOS DENTRO DEL LOUNGE (y=0 = SUELO)
 *************************************************/
function renderObjectsInsideLounge(loungeEl, room, floorY, wallPositions) {
  if (!room.objects || !Array.isArray(room.objects)) return;

  room.objects.forEach((obj, index) => {
    const entity = document.createElement("a-entity");
    entity.setAttribute("id", `object-${index}`);
    entity.setAttribute("gltf-model", `url(${resolveModelUrl(obj)})`);

    const pos = {
      x: obj.position?.x || 0,
      y: obj.position?.y || 0,
      z: obj.position?.z || 0
    };
    
    const rot = obj.rotation || { x: 0, y: 0, z: 0 };
    const catalogEntry = OBJECT_CATALOG[obj.model];
    const finalScale = catalogEntry?.scale || obj.scale || { x: 1, y: 1, z: 1 };

    if (catalogEntry?.type === "wall") {
      renderWallObject(entity, room, obj, pos);
    } else {
      const objectOffset = catalogEntry?.floorOffset || 0.1;
      const objectY = floorY + objectOffset;
      entity.setAttribute("position", `${pos.x} ${objectY} ${pos.z}`);
    }

    entity.setAttribute("rotation", `${rot.x} ${rot.y} ${rot.z}`);
    entity.setAttribute("scale", `${finalScale.x} ${finalScale.y} ${finalScale.z}`);
    loungeEl.appendChild(entity);
  });
}


/*************************************************
 * CÁMARA
 *************************************************/
function renderCamera(root, r) {
  const floorY = -r.height / 2;
  const eyeHeight = 15; // altura ojos
  const camY = floorY + eyeHeight;
  
  console.log("📷 Suelo:", floorY, "Cámara:", camY);
  
  const cam = document.createElement("a-entity");
  cam.setAttribute("camera", "");
  cam.setAttribute("look-controls", "");
  cam.setAttribute("wasd-controls", "");
  cam.setAttribute("position", `${r.entryPoint.x} ${camY} ${r.entryPoint.z}`);
  root.appendChild(cam);
}

/*************************************************
 * ENTORNO
 *************************************************/
function renderEntorno(root, room) {
  const env = room.environment || {};

  if (env.skyColor) {
    const sky = document.createElement("a-sky");
    sky.setAttribute("color", env.skyColor);
    root.appendChild(sky);
  }

  if (env.stars) {
    const stars = document.createElement("a-entity");
    stars.setAttribute("star-sky", "");
    root.appendChild(stars);
  }
}
